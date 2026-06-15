"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase-server"
import { writeAuditLog } from "@/lib/audit"
import { resolveUserOnSignIn } from "@/lib/onboarding"
import { addMemberToOpenCycles } from "@/lib/ensure-cycle"
import { canEditContributions, isAdminOrOwner } from "@/lib/permissions"
import { computeEligibility, computeLendingPoolAvailable, finalInstallmentDate, generateAmortizationSchedule, roundCurrency } from "@/lib/loans"
import { toISODate } from "@/lib/cycles"
import { formatCurrency } from "@/lib/format"
import type { ActionResult, LoanSettings } from "@/lib/types"

const PLAN_LIMITS: Record<string, number> = { free: 20, pro: 100, premium: 9999 }

function getMemberLimit(plan: string): number {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
}

export type CreateFundCircleOptions = {
  loanSettings?: LoanSettings
  startDate?: string | null
  endDate?: string | null
}

export async function createFundCircle(name: string, description: string, amount: number, frequency: string, userId: string, plan: string = "free", cycleDueDay: number | null = null, options?: CreateFundCircleOptions): Promise<ActionResult<{ circleId: string }>> {
  if (!name || !amount || !userId) return { success: false, error: "Missing required fields" }

  const loanSettings = options?.loanSettings
  if (loanSettings && Math.round((loanSettings.assetAllocationPct + loanSettings.loanAllocationPct) * 100) !== 10000) {
    return { success: false, error: "Asset and loan allocation percentages must add up to 100" }
  }

  const startDate = options?.startDate || null
  const endDate = options?.endDate || null
  if (startDate && endDate && endDate < startDate) {
    return { success: false, error: "End date must be on or after start date" }
  }

  const supabase = createAdminSupabaseClient()
  const maxMembers = getMemberLimit(plan)
  const { data: circle, error: circleError } = await supabase.from("fund_circles").insert({
    name,
    description,
    contribution_amount: amount,
    contribution_frequency: frequency || "monthly",
    cycle_due_day: cycleDueDay,
    subscription_plan: plan,
    max_members: maxMembers,
    start_date: startDate,
    end_date: endDate,
    ...(loanSettings && {
      asset_allocation_pct: loanSettings.assetAllocationPct,
      loan_allocation_pct: loanSettings.loanAllocationPct,
      loan_interest_rate_pct: loanSettings.loanInterestRatePct,
      max_loan_pct_of_contribution: loanSettings.maxLoanPctOfContribution,
      max_loan_pct_of_lending_pool: loanSettings.maxLoanPctOfLendingPool,
      contribution_late_fee: loanSettings.contributionLateFee,
      contribution_grace_days: loanSettings.contributionGraceDays,
      loan_late_fee: loanSettings.loanLateFee,
      loan_grace_days: loanSettings.loanGraceDays,
    }),
  }).select("id").single()
  if (circleError || !circle) return { success: false, error: "Failed to create fund circle" }
  await supabase.from("fund_circle_members").insert({ fund_circle_id: circle.id, user_id: userId, role: "owner", active: true })
  await writeAuditLog({ circleId: circle.id, userId, action: "fund_circle_created", entityType: "fund_circle", entityId: circle.id, newValue: { name, amount, frequency, plan, cycleDueDay, startDate, endDate, loanSettings } })
  revalidatePath("/circles")
  return { success: true, data: { circleId: circle.id } }
}

async function getSiteOrigin(): Promise<string> {
  const headersList = await headers()
  const host = headersList.get("host") ?? "localhost:3000"
  const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"
  return `${protocol}://${host}`
}

async function sendCircleInviteEmail(email: string, circleName: string, fullName: string): Promise<boolean> {
  const supabase = createAdminSupabaseClient()
  const origin = await getSiteOrigin()
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/invite`,
    data: { full_name: fullName || undefined, invited_circle_name: circleName },
  })
  return !error
}

export async function lookupCircleMemberByEmail(circleId: string, email: string): Promise<ActionResult<{
  exists: boolean
  name: string | null
  avatarUrl: string | null
  alreadyMember: boolean
  invitePending: boolean
}>> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!circleId || !normalizedEmail) return { success: false, error: "Email is required" }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return { success: false, error: "Enter a valid email address" }

  const supabase = createAdminSupabaseClient()

  const { data: profile } = await supabase.from("profiles").select("id, name, avatar_url").eq("email", normalizedEmail).maybeSingle()

  let alreadyMember = false
  if (profile) {
    const { data: membership } = await supabase.from("fund_circle_members").select("active").eq("fund_circle_id", circleId).eq("user_id", profile.id).maybeSingle()
    alreadyMember = !!membership?.active
  }

  const { data: invite } = await supabase.from("org_invites").select("id").eq("fund_circle_id", circleId).eq("email", normalizedEmail).eq("status", "pending").maybeSingle()

  return {
    success: true,
    data: {
      exists: !!profile,
      name: profile?.name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      alreadyMember,
      invitePending: !!invite,
    },
  }
}

export async function addCircleMember(params: { circleId: string; email: string; fullName?: string; role: "admin" | "member"; actorUserId: string }): Promise<ActionResult<{ status: "linked" | "invited"; emailSent?: boolean }>> {
  const { circleId, role, actorUserId } = params
  const email = params.email.trim().toLowerCase()
  const fullName = params.fullName?.trim() ?? ""
  if (!circleId || !email || !role || !actorUserId) return { success: false, error: "Missing required fields" }
  if (!["admin", "member"].includes(role)) return { success: false, error: "Invalid role" }

  const supabase = createAdminSupabaseClient()

  const { data: actorMembership } = await supabase.from("fund_circle_members").select("role").eq("fund_circle_id", circleId).eq("user_id", actorUserId).eq("active", true).maybeSingle()
  if (!actorMembership || !isAdminOrOwner(actorMembership.role)) return { success: false, error: "You don't have permission to add members to this circle." }

  const { data: circle } = await supabase.from("fund_circles").select("name, subscription_plan, max_members").eq("id", circleId).single()
  if (!circle) return { success: false, error: "Circle not found" }

  const { count: memberCount } = await supabase.from("fund_circle_members").select("*", { count: "exact", head: true }).eq("fund_circle_id", circleId).eq("active", true)
  if (memberCount != null && memberCount >= (circle.max_members ?? 20)) return { success: false, error: `Member limit reached (${circle.max_members ?? 20} per circle).` }

  const { data: existingProfile } = await supabase.from("profiles").select("id, name").eq("email", email).maybeSingle()

  if (existingProfile) {
    const { data: existingMembership } = await supabase.from("fund_circle_members").select("active").eq("fund_circle_id", circleId).eq("user_id", existingProfile.id).maybeSingle()
    if (existingMembership?.active) return { success: false, error: "This person is already a member of this circle." }

    const { error: memberError } = await supabase.from("fund_circle_members").upsert({ fund_circle_id: circleId, user_id: existingProfile.id, role, active: true }, { onConflict: "fund_circle_id, user_id" })
    if (memberError) return { success: false, error: "Failed to add member to circle" }

    await addMemberToOpenCycles(circleId, existingProfile.id)

    await supabase.from("org_invites").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("fund_circle_id", circleId).eq("email", email).eq("status", "pending")

    await writeAuditLog({ circleId, userId: existingProfile.id, action: "member_added_to_circle", entityType: "fund_circle_member", newValue: { email, name: existingProfile.name, role } })
    revalidatePath(`/circles/${circleId}/members`)
    return { success: true, data: { status: "linked" } }
  }

  const { data: existingInvite } = await supabase.from("org_invites").select("id").eq("fund_circle_id", circleId).eq("email", email).eq("status", "pending").maybeSingle()

  if (existingInvite) {
    const { error: updateError } = await supabase.from("org_invites").update({ role, invited_name: fullName || null, invited_by: actorUserId }).eq("id", existingInvite.id)
    if (updateError) return { success: false, error: "Failed to update invite" }
  } else {
    const { error: inviteError } = await supabase.from("org_invites").insert({ email, role, fund_circle_id: circleId, status: "pending", invited_name: fullName || null, invited_by: actorUserId })
    if (inviteError) return { success: false, error: "Failed to send invite" }
  }

  const emailSent = await sendCircleInviteEmail(email, circle.name, fullName)

  await writeAuditLog({ circleId, userId: actorUserId, action: "invite_sent", entityType: "org_invites", newValue: { email, role, circleName: circle.name } })
  revalidatePath(`/circles/${circleId}/members`)
  return { success: true, data: { status: "invited", emailSent } }
}

export async function revokeInvite(circleId: string, inviteId: string, actorUserId: string): Promise<ActionResult> {
  if (!circleId || !inviteId || !actorUserId) return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()

  const { data: actorMembership } = await supabase.from("fund_circle_members").select("role").eq("fund_circle_id", circleId).eq("user_id", actorUserId).eq("active", true).maybeSingle()
  if (!actorMembership || !isAdminOrOwner(actorMembership.role)) return { success: false, error: "You don't have permission to manage invites for this circle." }

  const { data: invite } = await supabase.from("org_invites").select("email, role").eq("id", inviteId).eq("fund_circle_id", circleId).single()
  if (!invite) return { success: false, error: "Invite not found" }

  const { error } = await supabase.from("org_invites").update({ status: "revoked" }).eq("id", inviteId)
  if (error) return { success: false, error: "Failed to revoke invite" }

  await writeAuditLog({ circleId, userId: actorUserId, action: "invite_revoked", entityType: "org_invites", entityId: inviteId, previousValue: { email: invite.email, role: invite.role } })
  revalidatePath(`/circles/${circleId}/members`)
  return { success: true, data: undefined }
}

export async function resendCircleInvite(circleId: string, inviteId: string, actorUserId: string): Promise<ActionResult<{ emailSent: boolean }>> {
  if (!circleId || !inviteId || !actorUserId) return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()

  const { data: actorMembership } = await supabase.from("fund_circle_members").select("role").eq("fund_circle_id", circleId).eq("user_id", actorUserId).eq("active", true).maybeSingle()
  if (!actorMembership || !isAdminOrOwner(actorMembership.role)) return { success: false, error: "You don't have permission to manage invites for this circle." }

  const { data: invite } = await supabase.from("org_invites").select("email, role, invited_name").eq("id", inviteId).eq("fund_circle_id", circleId).eq("status", "pending").single()
  if (!invite) return { success: false, error: "Invite not found" }

  const { data: circle } = await supabase.from("fund_circles").select("name").eq("id", circleId).single()

  const emailSent = await sendCircleInviteEmail(invite.email, circle?.name ?? "your fund circle", invite.invited_name ?? "")

  await writeAuditLog({ circleId, userId: actorUserId, action: "invite_sent", entityType: "org_invites", newValue: { email: invite.email, role: invite.role, resent: true } })
  return { success: true, data: { emailSent } }
}

export async function completeInviteSession(): Promise<ActionResult<{ redirectTo: string }>> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return { success: false, error: "We couldn't verify your invite session. Please sign in again." }

  await resolveUserOnSignIn(user.id, user.email, user.user_metadata as Record<string, string>)
  return { success: true, data: { redirectTo: "/circles" } }
}

export async function removeCircleMember(circleId: string, userId: string, actorUserId: string): Promise<ActionResult> {
  if (!circleId || !userId) return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from("fund_circle_members").update({ active: false }).eq("fund_circle_id", circleId).eq("user_id", userId)
  if (error) return { success: false, error: "Failed to remove member" }
  await writeAuditLog({ circleId, userId: actorUserId, action: "member_removed_from_circle", entityType: "fund_circle_member", newValue: { userId } })
  revalidatePath(`/circles/${circleId}/members`)
  return { success: true, data: undefined }
}

export async function changeCircleMemberRole(circleId: string, userId: string, role: string, actorUserId: string): Promise<ActionResult> {
  if (!circleId || !userId || !role) return { success: false, error: "Missing required fields" }
  if (!["owner", "admin", "member"].includes(role)) return { success: false, error: "Invalid role" }
  const supabase = createAdminSupabaseClient()
  const { data: current } = await supabase.from("fund_circle_members").select("role").eq("fund_circle_id", circleId).eq("user_id", userId).single()
  if (!current) return { success: false, error: "Member not found in circle" }
  if (current.role === "owner" && role !== "owner") {
    const { count } = await supabase.from("fund_circle_members").select("*", { count: "exact", head: true }).eq("fund_circle_id", circleId).eq("role", "owner").eq("active", true)
    if (count === 1) return { success: false, error: "Cannot demote the only circle owner." }
  }
  const { error } = await supabase.from("fund_circle_members").update({ role }).eq("fund_circle_id", circleId).eq("user_id", userId)
  if (error) return { success: false, error: "Failed to update role" }
  await writeAuditLog({ circleId, userId: actorUserId, action: "circle_member_role_changed", entityType: "fund_circle_member", entityId: userId, previousValue: { role: current.role }, newValue: { role } })
  revalidatePath(`/circles/${circleId}/members`)
  return { success: true, data: undefined }
}

export async function closeCycle(cycleId: string, userId: string, circleId: string): Promise<ActionResult> {
  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from("contribution_cycles").update({ status: "closed" }).eq("id", cycleId)
  if (error) return { success: false, error: "Failed to close cycle" }
  await writeAuditLog({ circleId, userId, action: "cycle_closed", entityType: "contribution_cycle", entityId: cycleId })
  revalidatePath(`/circles/${circleId}/cycles/${cycleId}`)
  return { success: true, data: undefined }
}

export async function recordPayment(contributionId: string, amount: number, notes: string, userId: string, circleId: string): Promise<ActionResult> {
  if (!contributionId || !amount || !userId || !circleId) return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()
  const { data: membership } = await supabase.from("fund_circle_members").select("role").eq("fund_circle_id", circleId).eq("user_id", userId).eq("active", true).maybeSingle()
  if (!membership || !canEditContributions(membership.role)) return { success: false, error: "You don't have permission to record payments for this circle." }
  const { data: contrib } = await supabase.from("contributions").select("paid_amount, expected_amount, contribution_cycle_id").eq("id", contributionId).single()
  if (!contrib) return { success: false, error: "Contribution not found" }
  const { data: cycle } = await supabase.from("contribution_cycles").select("status, fund_circle_id").eq("id", contrib.contribution_cycle_id).single()
  if (!cycle || cycle.fund_circle_id !== circleId) return { success: false, error: "Contribution not found" }
  if (cycle.status === "closed") return { success: false, error: "Cycle is closed" }
  const previousPaid = Number(contrib.paid_amount); const newPaid = previousPaid + Number(amount)
  const { data: payment, error: paymentError } = await supabase.from("contribution_payments").insert({ contribution_id: contributionId, amount: Number(amount), recorded_by: userId, notes }).select("id").single()
  if (paymentError || !payment) return { success: false, error: "Failed to record payment" }
  const { error: updateError } = await supabase.from("contributions").update({ paid_amount: newPaid, payment_date: new Date().toISOString().split("T")[0] }).eq("id", contributionId)
  if (updateError) return { success: false, error: "Failed to update contribution" }
  await writeAuditLog({
    circleId,
    userId,
    action: "payment_recorded",
    entityType: "contribution",
    entityId: contributionId,
    previousValue: { paid_amount: previousPaid },
    newValue: { paid_amount: newPaid, payment_amount: Number(amount) },
  })
  revalidatePath(`/circles/${circleId}/cycles`)
  return { success: true, data: undefined }
}

export async function closeCycleFormAction(formData: FormData): Promise<void> {
  const cycleId = formData.get("cycleId") as string; const userId = formData.get("userId") as string; const circleId = formData.get("circleId") as string
  await closeCycle(cycleId, userId, circleId)
}

export type LoanEligibility = {
  totalContributionsPaid: number
  lendingPoolAvailable: number
  maxByContribution: number
  maxByPool: number
  eligibleAmount: number
}

export async function getLoanEligibility(circleId: string, userId: string): Promise<ActionResult<LoanEligibility>> {
  const supabase = createAdminSupabaseClient()

  const { data: circle, error: circleError } = await supabase
    .from("fund_circles")
    .select("loan_allocation_pct, max_loan_pct_of_contribution, max_loan_pct_of_lending_pool")
    .eq("id", circleId)
    .single()
  if (circleError || !circle) return { success: false, error: "Fund circle not found" }

  const { data: cycles } = await supabase
    .from("contribution_cycles")
    .select("id")
    .eq("fund_circle_id", circleId)

  const cycleIds = (cycles ?? []).map((c) => c.id)

  let totalContributionsCollected = 0
  let totalContributionsPaid = 0
  if (cycleIds.length > 0) {
    const { data: contributions } = await supabase
      .from("contributions")
      .select("user_id, paid_amount")
      .in("contribution_cycle_id", cycleIds)

    for (const c of contributions ?? []) {
      const paid = Number(c.paid_amount)
      totalContributionsCollected += paid
      if (c.user_id === userId) totalContributionsPaid += paid
    }
  }

  const { data: activeLoans } = await supabase
    .from("loans")
    .select("id, user_id")
    .eq("fund_circle_id", circleId)
    .eq("status", "active")

  const loanIds = (activeLoans ?? []).map((l) => l.id)
  const loanUserById = new Map((activeLoans ?? []).map((l) => [l.id, l.user_id]))

  let totalPrincipalOutstanding = 0
  let outstandingPrincipal = 0
  if (loanIds.length > 0) {
    const { data: installments } = await supabase
      .from("loan_installments")
      .select("loan_id, principal_component, paid_amount, total_due")
      .in("loan_id", loanIds)

    for (const installment of installments ?? []) {
      if (Number(installment.paid_amount) >= Number(installment.total_due)) continue
      const principal = Number(installment.principal_component)
      totalPrincipalOutstanding += principal
      if (loanUserById.get(installment.loan_id) === userId) outstandingPrincipal += principal
    }
  }

  const lendingPoolAvailable = computeLendingPoolAvailable({
    totalContributionsCollected,
    loanAllocationPct: Number(circle.loan_allocation_pct),
    totalPrincipalOutstanding,
  })

  const { maxByContribution, maxByPool, eligibleAmount } = computeEligibility({
    totalContributionsPaid,
    maxLoanPctOfContribution: Number(circle.max_loan_pct_of_contribution),
    lendingPoolAvailable,
    maxLoanPctOfLendingPool: Number(circle.max_loan_pct_of_lending_pool),
    outstandingPrincipal,
  })

  return {
    success: true,
    data: { totalContributionsPaid, lendingPoolAvailable, maxByContribution, maxByPool, eligibleAmount },
  }
}

export async function requestLoan(circleId: string, userId: string, amount: number, termMonths: number, purpose: string): Promise<ActionResult<{ loanId: string }>> {
  if (!amount || amount <= 0) return { success: false, error: "Enter a loan amount greater than zero" }
  if (!termMonths || termMonths <= 0) return { success: false, error: "Enter a loan term of at least 1 month" }

  const supabase = createAdminSupabaseClient()

  const { data: circle, error: circleError } = await supabase
    .from("fund_circles")
    .select("end_date")
    .eq("id", circleId)
    .single()
  if (circleError || !circle) return { success: false, error: "Fund circle not found" }

  const eligibility = await getLoanEligibility(circleId, userId)
  if (!eligibility.success) return { success: false, error: eligibility.error }
  if (amount > eligibility.data.eligibleAmount) {
    return { success: false, error: `This amount exceeds your loan eligibility of ${formatCurrency(eligibility.data.eligibleAmount)}` }
  }

  if (circle.end_date) {
    const lastInstallment = toISODate(finalInstallmentDate(new Date(), termMonths))
    if (lastInstallment > circle.end_date) {
      return { success: false, error: "This term would push the final repayment past the circle's end date" }
    }
  }

  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .insert({
      fund_circle_id: circleId,
      user_id: userId,
      status: "pending_request",
      requested_amount: amount,
      requested_term_months: termMonths,
      purpose: purpose || null,
      requested_by: userId,
    })
    .select("id")
    .single()
  if (loanError || !loan) return { success: false, error: "Failed to submit loan request" }

  await writeAuditLog({
    circleId,
    userId,
    action: "loan_request_created",
    entityType: "loan",
    entityId: loan.id,
    newValue: { requestedAmount: amount, requestedTermMonths: termMonths, purpose },
  })

  revalidatePath(`/circles/${circleId}/loans`)
  return { success: true, data: { loanId: loan.id } }
}

export async function cancelLoanRequest(loanId: string, userId: string, circleId: string): Promise<ActionResult> {
  const supabase = createAdminSupabaseClient()

  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("user_id, status")
    .eq("id", loanId)
    .single()
  if (loanError || !loan) return { success: false, error: "Loan request not found" }
  if (loan.user_id !== userId) return { success: false, error: "You can only cancel your own loan requests" }
  if (loan.status !== "pending_request") return { success: false, error: "Only pending requests can be cancelled" }

  const { error: updateError } = await supabase
    .from("loans")
    .update({ status: "cancelled" })
    .eq("id", loanId)
  if (updateError) return { success: false, error: "Failed to cancel loan request" }

  await writeAuditLog({
    circleId,
    userId,
    action: "loan_request_cancelled",
    entityType: "loan",
    entityId: loanId,
    previousValue: { status: "pending_request" },
    newValue: { status: "cancelled" },
  })

  revalidatePath(`/circles/${circleId}/loans`)
  return { success: true, data: undefined }
}

export async function reviewLoanRequest(
  loanId: string,
  circleId: string,
  actorUserId: string,
  decision: "approve" | "reject",
  approvedAmount?: number,
  approvedTermMonths?: number
): Promise<ActionResult> {
  const supabase = createAdminSupabaseClient()

  const { data: membership } = await supabase
    .from("fund_circle_members")
    .select("role")
    .eq("fund_circle_id", circleId)
    .eq("user_id", actorUserId)
    .eq("active", true)
    .maybeSingle()
  if (!membership || !isAdminOrOwner(membership.role)) {
    return { success: false, error: "You don't have permission to review loan requests for this circle." }
  }

  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("id, fund_circle_id, user_id, status, requested_amount, requested_term_months")
    .eq("id", loanId)
    .single()
  if (loanError || !loan || loan.fund_circle_id !== circleId) return { success: false, error: "Loan request not found" }
  if (loan.status !== "pending_request") return { success: false, error: "Only pending requests can be reviewed" }
  if (loan.user_id === actorUserId) return { success: false, error: "You cannot review your own loan request" }

  if (decision === "reject") {
    const { error: updateError } = await supabase
      .from("loans")
      .update({ status: "rejected", reviewed_by: actorUserId, reviewed_at: new Date().toISOString() })
      .eq("id", loanId)
    if (updateError) return { success: false, error: "Failed to reject loan request" }

    await writeAuditLog({
      circleId,
      userId: actorUserId,
      action: "loan_rejected",
      entityType: "loan",
      entityId: loanId,
      previousValue: { status: "pending_request" },
      newValue: { status: "rejected" },
    })

    revalidatePath(`/circles/${circleId}/loans`)
    return { success: true, data: undefined }
  }

  const amount = approvedAmount ?? Number(loan.requested_amount)
  const termMonths = approvedTermMonths ?? loan.requested_term_months
  if (!amount || amount <= 0) return { success: false, error: "Enter an approved amount greater than zero" }
  if (!termMonths || termMonths <= 0) return { success: false, error: "Enter an approved term of at least 1 month" }

  const { data: circle, error: circleError } = await supabase
    .from("fund_circles")
    .select("loan_interest_rate_pct, end_date")
    .eq("id", circleId)
    .single()
  if (circleError || !circle) return { success: false, error: "Fund circle not found" }

  const eligibility = await getLoanEligibility(circleId, loan.user_id)
  if (!eligibility.success) return { success: false, error: eligibility.error }
  if (amount > eligibility.data.eligibleAmount) {
    return { success: false, error: `This amount exceeds the member's loan eligibility of ${formatCurrency(eligibility.data.eligibleAmount)}` }
  }

  const issueDate = new Date()
  if (circle.end_date) {
    const lastInstallment = toISODate(finalInstallmentDate(issueDate, termMonths))
    if (lastInstallment > circle.end_date) {
      return { success: false, error: "This term would push the final repayment past the circle's end date" }
    }
  }

  const interestRatePct = Number(circle.loan_interest_rate_pct)
  const schedule = generateAmortizationSchedule(amount, interestRatePct, termMonths, issueDate)

  const { error: updateError } = await supabase
    .from("loans")
    .update({
      status: "active",
      approved_amount: amount,
      approved_term_months: termMonths,
      interest_rate_pct: interestRatePct,
      reviewed_by: actorUserId,
      reviewed_at: issueDate.toISOString(),
      issued_at: issueDate.toISOString(),
    })
    .eq("id", loanId)
  if (updateError) return { success: false, error: "Failed to approve loan request" }

  const { error: installmentsError } = await supabase.from("loan_installments").insert(
    schedule.map((row) => ({
      loan_id: loanId,
      installment_number: row.installmentNumber,
      due_date: row.dueDate,
      principal_component: row.principalComponent,
      interest_component: row.interestComponent,
      total_due: row.totalDue,
    }))
  )
  if (installmentsError) return { success: false, error: "Failed to generate repayment schedule" }

  await writeAuditLog({
    circleId,
    userId: actorUserId,
    action: "loan_approved",
    entityType: "loan",
    entityId: loanId,
    previousValue: { status: "pending_request" },
    newValue: { status: "active", approvedAmount: amount, approvedTermMonths: termMonths, interestRatePct },
  })

  revalidatePath(`/circles/${circleId}/loans`)
  return { success: true, data: undefined }
}

export async function recordLoanPayment(loanInstallmentId: string, amount: number, notes: string, actorUserId: string, circleId: string): Promise<ActionResult> {
  if (!loanInstallmentId || !amount || amount <= 0) return { success: false, error: "Enter a payment amount greater than zero" }

  const supabase = createAdminSupabaseClient()

  const { data: membership } = await supabase
    .from("fund_circle_members")
    .select("role")
    .eq("fund_circle_id", circleId)
    .eq("user_id", actorUserId)
    .eq("active", true)
    .maybeSingle()
  if (!membership || !isAdminOrOwner(membership.role)) {
    return { success: false, error: "You don't have permission to record loan payments for this circle." }
  }

  const { data: installment, error: installmentError } = await supabase
    .from("loan_installments")
    .select("id, loan_id, due_date, total_due, paid_amount, late_fee_applied")
    .eq("id", loanInstallmentId)
    .single()
  if (installmentError || !installment) return { success: false, error: "Installment not found" }

  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("id, fund_circle_id, status")
    .eq("id", installment.loan_id)
    .single()
  if (loanError || !loan || loan.fund_circle_id !== circleId) return { success: false, error: "Loan not found" }
  if (loan.status !== "active") return { success: false, error: "Payments can only be recorded for active loans" }

  const { data: circle } = await supabase
    .from("fund_circles")
    .select("loan_late_fee, loan_grace_days")
    .eq("id", circleId)
    .single()

  const previousPaid = Number(installment.paid_amount)
  const previousTotalDue = Number(installment.total_due)
  let totalDue = previousTotalDue
  let lateFeeApplied = Number(installment.late_fee_applied)

  if (lateFeeApplied === 0 && circle && Number(circle.loan_late_fee) > 0) {
    const graceDeadline = new Date(installment.due_date)
    graceDeadline.setDate(graceDeadline.getDate() + Number(circle.loan_grace_days))
    if (toISODate(new Date()) > toISODate(graceDeadline)) {
      lateFeeApplied = Number(circle.loan_late_fee)
      totalDue = roundCurrency(totalDue + lateFeeApplied)
    }
  }

  const newPaid = roundCurrency(previousPaid + amount)

  const { error: updateInstallmentError } = await supabase
    .from("loan_installments")
    .update({ paid_amount: newPaid, total_due: totalDue, late_fee_applied: lateFeeApplied })
    .eq("id", loanInstallmentId)
  if (updateInstallmentError) return { success: false, error: "Failed to update installment" }

  const { error: paymentError } = await supabase
    .from("loan_payments")
    .insert({ loan_installment_id: loanInstallmentId, amount, recorded_by: actorUserId, notes: notes || null })
  if (paymentError) return { success: false, error: "Failed to record payment" }

  await writeAuditLog({
    circleId,
    userId: actorUserId,
    action: "loan_payment_recorded",
    entityType: "loan_installment",
    entityId: loanInstallmentId,
    previousValue: { paidAmount: previousPaid, totalDue: previousTotalDue, lateFeeApplied: Number(installment.late_fee_applied) },
    newValue: { paidAmount: newPaid, totalDue, lateFeeApplied, paymentAmount: amount },
  })

  const { data: allInstallments } = await supabase
    .from("loan_installments")
    .select("paid_amount, total_due")
    .eq("loan_id", loan.id)

  const allPaid = (allInstallments ?? []).every((i) => Number(i.paid_amount) >= Number(i.total_due))
  if (allPaid) {
    const { error: closeError } = await supabase.from("loans").update({ status: "closed" }).eq("id", loan.id)
    if (!closeError) {
      await writeAuditLog({
        circleId,
        userId: actorUserId,
        action: "loan_closed",
        entityType: "loan",
        entityId: loan.id,
        previousValue: { status: "active" },
        newValue: { status: "closed" },
      })
    }
  }

  revalidatePath(`/circles/${circleId}/loans`)
  revalidatePath(`/circles/${circleId}/loans/${loan.id}`)
  return { success: true, data: undefined }
}

export async function extendCircleEndDate(circleId: string, newEndDate: string, actorUserId: string): Promise<ActionResult> {
  if (!newEndDate) return { success: false, error: "Enter a valid end date" }

  const supabase = createAdminSupabaseClient()

  const { data: membership } = await supabase
    .from("fund_circle_members")
    .select("role")
    .eq("fund_circle_id", circleId)
    .eq("user_id", actorUserId)
    .eq("active", true)
    .maybeSingle()
  if (!membership || !isAdminOrOwner(membership.role)) {
    return { success: false, error: "You don't have permission to change this circle's dates." }
  }

  const { data: circle, error: circleError } = await supabase
    .from("fund_circles")
    .select("start_date, end_date")
    .eq("id", circleId)
    .single()
  if (circleError || !circle) return { success: false, error: "Fund circle not found" }

  if (circle.start_date && newEndDate < circle.start_date) {
    return { success: false, error: "End date cannot be before the circle's start date" }
  }
  if (circle.end_date && newEndDate <= circle.end_date) {
    return { success: false, error: "New end date must be later than the current end date" }
  }

  const { error: updateError } = await supabase
    .from("fund_circles")
    .update({ end_date: newEndDate })
    .eq("id", circleId)
  if (updateError) return { success: false, error: "Failed to update the circle's end date" }

  await writeAuditLog({
    circleId,
    userId: actorUserId,
    action: "circle_extended",
    entityType: "fund_circle",
    entityId: circleId,
    previousValue: { endDate: circle.end_date },
    newValue: { endDate: newEndDate },
  })

  revalidatePath(`/circles/${circleId}/settings`)
  return { success: true, data: undefined }
}

export async function updateLoanSettings(circleId: string, settings: LoanSettings, actorUserId: string): Promise<ActionResult> {
  if (Math.round((settings.assetAllocationPct + settings.loanAllocationPct) * 100) !== 10000) {
    return { success: false, error: "Asset and loan allocation percentages must add up to 100%" }
  }

  const supabase = createAdminSupabaseClient()

  const { data: membership } = await supabase
    .from("fund_circle_members")
    .select("role")
    .eq("fund_circle_id", circleId)
    .eq("user_id", actorUserId)
    .eq("active", true)
    .maybeSingle()
  if (!membership || !isAdminOrOwner(membership.role)) {
    return { success: false, error: "You don't have permission to edit loan settings for this circle." }
  }

  const { data: circle, error: circleError } = await supabase
    .from("fund_circles")
    .select(
      "asset_allocation_pct, loan_allocation_pct, loan_interest_rate_pct, max_loan_pct_of_contribution, max_loan_pct_of_lending_pool, contribution_late_fee, contribution_grace_days, loan_late_fee, loan_grace_days"
    )
    .eq("id", circleId)
    .single()
  if (circleError || !circle) return { success: false, error: "Fund circle not found" }

  const previousValue: LoanSettings = {
    assetAllocationPct: Number(circle.asset_allocation_pct),
    loanAllocationPct: Number(circle.loan_allocation_pct),
    loanInterestRatePct: Number(circle.loan_interest_rate_pct),
    maxLoanPctOfContribution: Number(circle.max_loan_pct_of_contribution),
    maxLoanPctOfLendingPool: Number(circle.max_loan_pct_of_lending_pool),
    contributionLateFee: Number(circle.contribution_late_fee),
    contributionGraceDays: circle.contribution_grace_days,
    loanLateFee: Number(circle.loan_late_fee),
    loanGraceDays: circle.loan_grace_days,
  }

  const { error: updateError } = await supabase
    .from("fund_circles")
    .update({
      asset_allocation_pct: settings.assetAllocationPct,
      loan_allocation_pct: settings.loanAllocationPct,
      loan_interest_rate_pct: settings.loanInterestRatePct,
      max_loan_pct_of_contribution: settings.maxLoanPctOfContribution,
      max_loan_pct_of_lending_pool: settings.maxLoanPctOfLendingPool,
      contribution_late_fee: settings.contributionLateFee,
      contribution_grace_days: settings.contributionGraceDays,
      loan_late_fee: settings.loanLateFee,
      loan_grace_days: settings.loanGraceDays,
    })
    .eq("id", circleId)
  if (updateError) return { success: false, error: "Failed to update loan settings" }

  await writeAuditLog({
    circleId,
    userId: actorUserId,
    action: "loan_settings_updated",
    entityType: "fund_circle",
    entityId: circleId,
    previousValue,
    newValue: settings,
  })

  revalidatePath(`/circles/${circleId}/settings`)
  return { success: true, data: undefined }
}
