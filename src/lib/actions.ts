"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase-server"
import { writeAuditLog } from "@/lib/audit"
import { resolveUserOnSignIn } from "@/lib/onboarding"
import { addMemberToOpenCycles } from "@/lib/ensure-cycle"
import { canEditContributions, isAdminOrOwner } from "@/lib/permissions"
import { calculateAccruedInterest, calculateDailyAccruedInterest, calculateOutstandingPrincipal, computeAssetsValue, computeEligibility, computeLendingPoolAvailable, finalInstallmentDate, generateAmortizationSchedule, monthsToPayOff, roundCurrency } from "@/lib/loans"
import { computeMemberShare } from "@/lib/settlement"
import { toISODate } from "@/lib/cycles"
import { formatCurrency } from "@/lib/format"
import type { ActionResult, AssetType, LoanSettings } from "@/lib/types"

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

export async function lookupUserByEmail(email: string): Promise<ActionResult<{
  exists: boolean
  name: string | null
  avatarUrl: string | null
}>> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) return { success: false, error: "Email is required" }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return { success: false, error: "Enter a valid email address" }

  const supabase = createAdminSupabaseClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar_url")
    .eq("email", normalizedEmail)
    .maybeSingle()

  return {
    success: true,
    data: {
      exists: !!profile,
      name: profile?.name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    },
  }
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

export async function submitContributionPayment(
  contributionId: string,
  amount: number,
  notes: string,
  userId: string,
  circleId: string
): Promise<ActionResult> {
  if (!contributionId || !amount || amount <= 0 || !userId || !circleId)
    return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()
  const { data: contrib } = await supabase
    .from("contributions")
    .select("user_id, paid_amount, contribution_cycle_id")
    .eq("id", contributionId)
    .single()
  if (!contrib) return { success: false, error: "Contribution not found" }
  if (contrib.user_id !== userId) return { success: false, error: "You can only submit payments for your own contributions." }
  const { data: cycle } = await supabase
    .from("contribution_cycles")
    .select("status, fund_circle_id")
    .eq("id", contrib.contribution_cycle_id)
    .single()
  if (!cycle || cycle.fund_circle_id !== circleId) return { success: false, error: "Contribution not found" }
  if (cycle.status === "closed") return { success: false, error: "Cycle is closed" }
  const { data: existing } = await supabase
    .from("contribution_payments")
    .select("id")
    .eq("contribution_id", contributionId)
    .eq("status", "pending")
    .maybeSingle()
  if (existing) return { success: false, error: "A payment is already pending verification for this contribution." }
  const { error } = await supabase.from("contribution_payments").insert({
    contribution_id: contributionId,
    amount,
    recorded_by: userId,
    submitted_by: userId,
    status: "pending",
    notes: notes || null,
  })
  if (error) return { success: false, error: "Failed to submit payment" }
  await writeAuditLog({
    circleId,
    userId,
    action: "payment_submitted",
    entityType: "contribution",
    entityId: contributionId,
    previousValue: { paid_amount: Number(contrib.paid_amount) },
    newValue: { submitted_amount: amount },
  })
  revalidatePath(`/circles/${circleId}/cycles`)
  return { success: true, data: undefined }
}

export async function verifyContributionPayment(
  paymentId: string,
  userId: string,
  circleId: string
): Promise<ActionResult> {
  if (!paymentId || !userId || !circleId) return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()
  const { data: membership } = await supabase
    .from("fund_circle_members")
    .select("role")
    .eq("fund_circle_id", circleId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle()
  if (!membership || !canEditContributions(membership.role))
    return { success: false, error: "You don't have permission to verify payments." }
  const { data: payment } = await supabase
    .from("contribution_payments")
    .select("id, contribution_id, amount, status")
    .eq("id", paymentId)
    .single()
  if (!payment) return { success: false, error: "Payment not found" }
  if (payment.status !== "pending") return { success: false, error: "Payment is not pending verification." }
  const { data: contrib } = await supabase
    .from("contributions")
    .select("paid_amount, contribution_cycle_id")
    .eq("id", payment.contribution_id)
    .single()
  if (!contrib) return { success: false, error: "Contribution not found" }
  const { data: cycle } = await supabase
    .from("contribution_cycles")
    .select("status, fund_circle_id")
    .eq("id", contrib.contribution_cycle_id)
    .single()
  if (!cycle || cycle.fund_circle_id !== circleId) return { success: false, error: "Contribution not found" }
  if (cycle.status === "closed") return { success: false, error: "Cycle is closed" }
  const previousPaid = Number(contrib.paid_amount)
  const newPaid = roundCurrency(previousPaid + Number(payment.amount))
  const { error: updateContribError } = await supabase
    .from("contributions")
    .update({ paid_amount: newPaid, payment_date: new Date().toISOString().split("T")[0] })
    .eq("id", payment.contribution_id)
  if (updateContribError) return { success: false, error: "Failed to update contribution" }
  const { error: updatePaymentError } = await supabase
    .from("contribution_payments")
    .update({ status: "verified", verified_by: userId, verified_at: new Date().toISOString() })
    .eq("id", paymentId)
  if (updatePaymentError) return { success: false, error: "Failed to verify payment" }
  await writeAuditLog({
    circleId,
    userId,
    action: "payment_verified",
    entityType: "contribution",
    entityId: payment.contribution_id,
    previousValue: { paid_amount: previousPaid },
    newValue: { paid_amount: newPaid, payment_amount: Number(payment.amount) },
  })
  revalidatePath(`/circles/${circleId}/cycles`)
  return { success: true, data: undefined }
}

export async function rejectContributionPayment(
  paymentId: string,
  reason: string,
  userId: string,
  circleId: string
): Promise<ActionResult> {
  if (!paymentId || !userId || !circleId) return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()
  const { data: membership } = await supabase
    .from("fund_circle_members")
    .select("role")
    .eq("fund_circle_id", circleId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle()
  if (!membership || !canEditContributions(membership.role))
    return { success: false, error: "You don't have permission to reject payments." }
  const { data: payment } = await supabase
    .from("contribution_payments")
    .select("id, contribution_id, amount, status")
    .eq("id", paymentId)
    .single()
  if (!payment) return { success: false, error: "Payment not found" }
  if (payment.status !== "pending") return { success: false, error: "Payment is not pending verification." }
  const { error } = await supabase
    .from("contribution_payments")
    .update({ status: "rejected", verified_by: userId, verified_at: new Date().toISOString(), rejection_reason: reason || null })
    .eq("id", paymentId)
  if (error) return { success: false, error: "Failed to reject payment" }
  await writeAuditLog({
    circleId,
    userId,
    action: "payment_rejected",
    entityType: "contribution",
    entityId: payment.contribution_id,
    previousValue: { status: "pending" },
    newValue: { status: "rejected", reason: reason || null },
  })
  revalidatePath(`/circles/${circleId}/cycles`)
  return { success: true, data: undefined }
}

export async function editContributionPayment(
  contributionId: string,
  newPaidAmount: number,
  notes: string,
  userId: string,
  circleId: string
): Promise<ActionResult> {
  if (!contributionId || newPaidAmount < 0 || !userId || !circleId)
    return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()
  const { data: membership } = await supabase
    .from("fund_circle_members")
    .select("role")
    .eq("fund_circle_id", circleId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle()
  if (!membership || !canEditContributions(membership.role))
    return { success: false, error: "You don't have permission to edit payments for this circle." }
  const { data: contrib } = await supabase
    .from("contributions")
    .select("paid_amount, contribution_cycle_id")
    .eq("id", contributionId)
    .single()
  if (!contrib) return { success: false, error: "Contribution not found" }
  const { data: cycle } = await supabase
    .from("contribution_cycles")
    .select("status, fund_circle_id")
    .eq("id", contrib.contribution_cycle_id)
    .single()
  if (!cycle || cycle.fund_circle_id !== circleId) return { success: false, error: "Contribution not found" }
  if (cycle.status === "closed") return { success: false, error: "Cycle is closed" }
  const previousPaid = Number(contrib.paid_amount)
  const { error: updateError } = await supabase
    .from("contributions")
    .update({
      paid_amount: newPaidAmount,
      payment_date: newPaidAmount > 0 ? new Date().toISOString().split("T")[0] : null,
    })
    .eq("id", contributionId)
  if (updateError) return { success: false, error: "Failed to update contribution" }
  await writeAuditLog({
    circleId,
    userId,
    action: "payment_edited",
    entityType: "contribution",
    entityId: contributionId,
    previousValue: { paid_amount: previousPaid },
    newValue: { paid_amount: newPaidAmount, notes: notes || undefined },
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
  totalContributionsCollected: number
  assetsValue: number
  lendingPoolAvailable: number
  totalPrincipalOutstanding: number
  activeLoanCount: number
  outstandingPrincipal: number
  maxByContribution: number
  maxByPool: number
  eligibleAmount: number
  totalDisbursed: number
  totalRepaid: number
}

export async function getLoanEligibility(circleId: string, userId: string): Promise<ActionResult<LoanEligibility>> {
  const supabase = createAdminSupabaseClient()

  const { data: circle, error: circleError } = await supabase
    .from("fund_circles")
    .select("asset_allocation_pct, loan_allocation_pct, max_loan_pct_of_contribution, max_loan_pct_of_lending_pool")
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

  const assetsValue = computeAssetsValue(totalContributionsCollected, Number(circle.asset_allocation_pct))

  const { maxByContribution, maxByPool, eligibleAmount } = computeEligibility({
    totalContributionsPaid,
    maxLoanPctOfContribution: Number(circle.max_loan_pct_of_contribution),
    lendingPoolAvailable,
    maxLoanPctOfLendingPool: Number(circle.max_loan_pct_of_lending_pool),
    outstandingPrincipal,
  })

  // Fund health: all loans ever disbursed (active + closed) and all verified repayments
  const { data: disbursedLoans } = await supabase
    .from("loans")
    .select("id, approved_amount")
    .eq("fund_circle_id", circleId)
    .in("status", ["active", "closed"])
  const totalDisbursed = roundCurrency(
    (disbursedLoans ?? []).reduce((sum, l) => sum + Number(l.approved_amount ?? 0), 0)
  )
  const allLoanIds = (disbursedLoans ?? []).map((l) => l.id)

  let totalRepaid = 0
  if (allLoanIds.length > 0) {
    // Loan-level payments (prepayment, foreclosure) have loan_id set and loan_installment_id null
    // Installment-level payments (regular) have loan_installment_id set — fetch via installment ids
    const [{ data: loanLevelPayments }, { data: installmentRows }] = await Promise.all([
      supabase.from("loan_payments").select("amount").in("loan_id", allLoanIds).eq("status", "verified"),
      supabase.from("loan_installments").select("id").in("loan_id", allLoanIds),
    ])
    const installmentIds = (installmentRows ?? []).map((i) => i.id)
    const installmentPaymentData =
      installmentIds.length > 0
        ? (
            await supabase
              .from("loan_payments")
              .select("amount")
              .in("loan_installment_id", installmentIds)
              .eq("status", "verified")
          ).data
        : []
    totalRepaid = roundCurrency(
      [...(loanLevelPayments ?? []), ...(installmentPaymentData ?? [])].reduce(
        (sum, p) => sum + Number(p.amount),
        0
      )
    )
  }

  return {
    success: true,
    data: {
      totalContributionsPaid,
      totalContributionsCollected,
      assetsValue,
      lendingPoolAvailable,
      totalPrincipalOutstanding,
      activeLoanCount: loanIds.length,
      outstandingPrincipal,
      maxByContribution,
      maxByPool,
      eligibleAmount,
      totalDisbursed,
      totalRepaid,
    },
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

export async function getInstallmentDue(
  installmentId: string,
  circleId: string
): Promise<ActionResult<{
  scheduledDue: number
  paidAmount: number
  remaining: number
  daysLate: number
  accruedInterest: number
  totalOwed: number
  annualRatePct: number
}>> {
  if (!installmentId || !circleId) return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()
  const { data: installment } = await supabase
    .from("loan_installments")
    .select("id, loan_id, installment_number, due_date, total_due, paid_amount")
    .eq("id", installmentId)
    .single()
  if (!installment) return { success: false, error: "Installment not found" }
  const { data: loan } = await supabase
    .from("loans")
    .select("id, fund_circle_id, interest_rate_pct")
    .eq("id", installment.loan_id)
    .single()
  if (!loan || loan.fund_circle_id !== circleId) return { success: false, error: "Loan not found" }
  const [{ data: circle }, { data: thisAndFuture }] = await Promise.all([
    supabase.from("fund_circles").select("loan_grace_days").eq("id", circleId).single(),
    supabase
      .from("loan_installments")
      .select("principal_component")
      .eq("loan_id", loan.id)
      .gte("installment_number", installment.installment_number),
  ])
  const outstandingPrincipal = roundCurrency(
    (thisAndFuture ?? []).reduce((sum, i) => sum + Number(i.principal_component), 0)
  )
  const graceDays = Number(circle?.loan_grace_days ?? 0)
  const dueDate = new Date(installment.due_date)
  const graceDeadline = new Date(dueDate)
  graceDeadline.setDate(graceDeadline.getDate() + graceDays)
  const msPerDay = 1000 * 60 * 60 * 24
  const daysLate = Math.max(0, Math.floor((Date.now() - graceDeadline.getTime()) / msPerDay))
  const annualRatePct = Number(loan.interest_rate_pct ?? 0)
  const accruedInterest = calculateDailyAccruedInterest(outstandingPrincipal, annualRatePct, daysLate)
  const scheduledDue = Number(installment.total_due)
  const paidAmount = Number(installment.paid_amount)
  const remaining = roundCurrency(scheduledDue - paidAmount)
  const totalOwed = roundCurrency(remaining + accruedInterest)
  return { success: true, data: { scheduledDue, paidAmount, remaining, daysLate, accruedInterest, totalOwed, annualRatePct } }
}

export async function submitLoanPayment(
  installmentId: string,
  amount: number,
  notes: string,
  userId: string,
  circleId: string
): Promise<ActionResult> {
  if (!installmentId || !amount || amount <= 0 || !userId || !circleId)
    return { success: false, error: "Enter a payment amount greater than zero" }
  const supabase = createAdminSupabaseClient()
  const { data: installment } = await supabase
    .from("loan_installments")
    .select("id, loan_id, installment_number, due_date, total_due, paid_amount")
    .eq("id", installmentId)
    .single()
  if (!installment) return { success: false, error: "Installment not found" }
  const { data: loan } = await supabase
    .from("loans")
    .select("id, fund_circle_id, user_id, status, interest_rate_pct")
    .eq("id", installment.loan_id)
    .single()
  if (!loan || loan.fund_circle_id !== circleId) return { success: false, error: "Loan not found" }
  if (loan.user_id !== userId) return { success: false, error: "You can only submit payments for your own loans." }
  if (loan.status !== "active") return { success: false, error: "Payments can only be submitted for active loans" }

  // Sequential enforcement: the submitted installment must be the earliest unpaid one
  // with no existing pending payment. Banks don't allow paying future installments while
  // older ones are still outstanding.
  const { data: allInstallments } = await supabase
    .from("loan_installments")
    .select("id, installment_number, paid_amount, total_due")
    .eq("loan_id", loan.id)
    .order("installment_number", { ascending: true })
  const { data: existingPending } = await supabase
    .from("loan_payments")
    .select("loan_installment_id")
    .in("loan_installment_id", (allInstallments ?? []).map((i) => i.id))
    .eq("status", "pending")
  const pendingSet = new Set(
    (existingPending ?? []).map((p) => p.loan_installment_id).filter(Boolean) as string[]
  )
  const firstUnpaid = (allInstallments ?? []).find(
    (i) => Number(i.paid_amount) < Number(i.total_due) && !pendingSet.has(i.id)
  )
  if (!firstUnpaid || firstUnpaid.id !== installmentId)
    return { success: false, error: "Please settle earlier installments before paying this one." }

  // Calculate accrued daily interest at submission time so admin delays don't penalise the member
  const [{ data: circle }, { data: thisAndFuture }] = await Promise.all([
    supabase.from("fund_circles").select("loan_grace_days").eq("id", circleId).single(),
    supabase
      .from("loan_installments")
      .select("principal_component")
      .eq("loan_id", loan.id)
      .gte("installment_number", installment.installment_number),
  ])
  const outstandingPrincipal = roundCurrency(
    (thisAndFuture ?? []).reduce((sum, i) => sum + Number(i.principal_component), 0)
  )
  const graceDays = Number(circle?.loan_grace_days ?? 0)
  const dueDate = new Date(installment.due_date)
  const graceDeadline = new Date(dueDate)
  graceDeadline.setDate(graceDeadline.getDate() + graceDays)
  const msPerDay = 1000 * 60 * 60 * 24
  const daysLate = Math.max(0, Math.floor((Date.now() - graceDeadline.getTime()) / msPerDay))
  const accruedInterest = calculateDailyAccruedInterest(
    outstandingPrincipal,
    Number(loan.interest_rate_pct ?? 0),
    daysLate
  )

  const { error } = await supabase.from("loan_payments").insert({
    loan_installment_id: installmentId,
    amount,
    accrued_interest: accruedInterest,
    recorded_by: userId,
    submitted_by: userId,
    status: "pending",
    payment_type: "regular",
    notes: notes || null,
  })
  if (error) return { success: false, error: "Failed to submit payment" }
  revalidatePath(`/circles/${circleId}/loans/${loan.id}`)
  return { success: true, data: undefined }
}

export async function submitPrepayment(
  loanId: string,
  amount: number,
  strategy: "reduce_emi" | "reduce_tenure",
  notes: string,
  userId: string,
  circleId: string
): Promise<ActionResult> {
  if (!loanId || !amount || amount <= 0 || !userId || !circleId)
    return { success: false, error: "Enter a prepayment amount greater than zero" }
  const supabase = createAdminSupabaseClient()
  const { data: loan } = await supabase
    .from("loans")
    .select("id, fund_circle_id, user_id, status")
    .eq("id", loanId)
    .single()
  if (!loan || loan.fund_circle_id !== circleId) return { success: false, error: "Loan not found" }
  if (loan.user_id !== userId) return { success: false, error: "You can only prepay your own loans." }
  if (loan.status !== "active") return { success: false, error: "Prepayments can only be submitted for active loans" }
  const { data: existing } = await supabase
    .from("loan_payments")
    .select("id")
    .eq("loan_id", loanId)
    .in("status", ["pending"])
    .in("payment_type", ["prepayment", "foreclosure"])
    .maybeSingle()
  if (existing) return { success: false, error: "A prepayment or foreclosure is already pending for this loan." }
  const { error } = await supabase.from("loan_payments").insert({
    loan_id: loanId,
    amount,
    recorded_by: userId,
    submitted_by: userId,
    status: "pending",
    payment_type: "prepayment",
    prepayment_strategy: strategy,
    notes: notes || null,
  })
  if (error) return { success: false, error: "Failed to submit prepayment" }
  revalidatePath(`/circles/${circleId}/loans/${loanId}`)
  return { success: true, data: undefined }
}

export async function submitForeclosure(
  loanId: string,
  notes: string,
  userId: string,
  circleId: string
): Promise<ActionResult<{ foreclosureAmount: number }>> {
  if (!loanId || !userId || !circleId) return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()
  const { data: loan } = await supabase
    .from("loans")
    .select("id, fund_circle_id, user_id, status")
    .eq("id", loanId)
    .single()
  if (!loan || loan.fund_circle_id !== circleId) return { success: false, error: "Loan not found" }
  if (loan.user_id !== userId) return { success: false, error: "You can only foreclose your own loans." }
  if (loan.status !== "active") return { success: false, error: "Only active loans can be foreclosed" }
  const { data: existing } = await supabase
    .from("loan_payments")
    .select("id")
    .eq("loan_id", loanId)
    .in("status", ["pending"])
    .in("payment_type", ["prepayment", "foreclosure"])
    .maybeSingle()
  if (existing) return { success: false, error: "A prepayment or foreclosure is already pending for this loan." }
  const { data: rawInstallments } = await supabase
    .from("loan_installments")
    .select("principal_component, interest_component, total_due, paid_amount, due_date")
    .eq("loan_id", loanId)
  const installments = (rawInstallments ?? []).map((i) => ({
    principalComponent: Number(i.principal_component),
    interestComponent: Number(i.interest_component),
    totalDue: Number(i.total_due),
    paidAmount: Number(i.paid_amount),
    dueDate: i.due_date,
  }))
  const todayIso = toISODate(new Date())
  const outstandingPrincipal = calculateOutstandingPrincipal(installments)
  const accruedInterest = calculateAccruedInterest(installments, todayIso)
  const foreclosureAmount = roundCurrency(outstandingPrincipal + accruedInterest)
  if (foreclosureAmount <= 0) return { success: false, error: "Loan appears to already be fully paid." }
  const { error } = await supabase.from("loan_payments").insert({
    loan_id: loanId,
    amount: foreclosureAmount,
    recorded_by: userId,
    submitted_by: userId,
    status: "pending",
    payment_type: "foreclosure",
    notes: notes || null,
  })
  if (error) return { success: false, error: "Failed to submit foreclosure request" }
  revalidatePath(`/circles/${circleId}/loans/${loanId}`)
  return { success: true, data: { foreclosureAmount } }
}

export async function verifyLoanPayment(
  paymentId: string,
  userId: string,
  circleId: string
): Promise<ActionResult> {
  if (!paymentId || !userId || !circleId) return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()
  const { data: membership } = await supabase
    .from("fund_circle_members")
    .select("role")
    .eq("fund_circle_id", circleId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle()
  if (!membership || !isAdminOrOwner(membership.role))
    return { success: false, error: "You don't have permission to verify payments." }
  const { data: payment } = await supabase
    .from("loan_payments")
    .select("id, loan_installment_id, loan_id, amount, accrued_interest, status, payment_type, prepayment_strategy")
    .eq("id", paymentId)
    .single()
  if (!payment) return { success: false, error: "Payment not found" }
  if (payment.status !== "pending") return { success: false, error: "Payment is not pending verification." }

  if (payment.payment_type === "regular") {
    const { data: installment } = await supabase
      .from("loan_installments")
      .select("id, loan_id, total_due, paid_amount")
      .eq("id", payment.loan_installment_id!)
      .single()
    if (!installment) return { success: false, error: "Installment not found" }
    const { data: loan } = await supabase
      .from("loans")
      .select("id, fund_circle_id, status")
      .eq("id", installment.loan_id)
      .single()
    if (!loan || loan.fund_circle_id !== circleId) return { success: false, error: "Loan not found" }
    if (loan.status !== "active") return { success: false, error: "Loan is not active" }
    const previousPaid = Number(installment.paid_amount)
    const previousTotalDue = Number(installment.total_due)
    // Accrued interest was calculated and locked in at submission time
    const accruedInterest = roundCurrency(Number(payment.accrued_interest ?? 0))
    const totalDue = roundCurrency(previousTotalDue + accruedInterest)
    const newPaid = roundCurrency(previousPaid + Number(payment.amount))
    const { error: updateErr } = await supabase
      .from("loan_installments")
      .update({ paid_amount: newPaid, total_due: totalDue })
      .eq("id", installment.id)
    if (updateErr) return { success: false, error: "Failed to update installment" }
    await supabase
      .from("loan_payments")
      .update({ status: "verified", verified_by: userId, verified_at: new Date().toISOString() })
      .eq("id", paymentId)
    await writeAuditLog({
      circleId,
      userId,
      action: "loan_payment_verified",
      entityType: "loan_installment",
      entityId: installment.id,
      previousValue: { paidAmount: previousPaid, totalDue: previousTotalDue },
      newValue: { paidAmount: newPaid, totalDue, accruedInterest, paymentAmount: Number(payment.amount) },
    })
    const { data: allInstallments } = await supabase
      .from("loan_installments")
      .select("paid_amount, total_due")
      .eq("loan_id", loan.id)
    const allPaid = (allInstallments ?? []).every((i) => Number(i.paid_amount) >= Number(i.total_due))
    if (allPaid) {
      await supabase.from("loans").update({ status: "closed" }).eq("id", loan.id)
      await writeAuditLog({
        circleId,
        userId,
        action: "loan_closed",
        entityType: "loan",
        entityId: loan.id,
        previousValue: { status: "active" },
        newValue: { status: "closed" },
      })
    }
    revalidatePath(`/circles/${circleId}/loans`)
    revalidatePath(`/circles/${circleId}/loans/${loan.id}`)
    return { success: true, data: undefined }
  }

  if (payment.payment_type === "prepayment") {
    const result = await applyPrepaymentAndRegenerate(
      payment.loan_id!,
      Number(payment.amount),
      payment.prepayment_strategy as "reduce_emi" | "reduce_tenure",
      userId,
      circleId
    )
    if (!result.success) return result
    await supabase
      .from("loan_payments")
      .update({ status: "verified", verified_by: userId, verified_at: new Date().toISOString() })
      .eq("id", paymentId)
    revalidatePath(`/circles/${circleId}/loans`)
    revalidatePath(`/circles/${circleId}/loans/${payment.loan_id}`)
    return { success: true, data: undefined }
  }

  if (payment.payment_type === "foreclosure") {
    const { data: loan } = await supabase
      .from("loans")
      .select("id, fund_circle_id, status")
      .eq("id", payment.loan_id!)
      .single()
    if (!loan || loan.fund_circle_id !== circleId) return { success: false, error: "Loan not found" }
    if (loan.status !== "active") return { success: false, error: "Loan is not active" }
    const { data: installments } = await supabase
      .from("loan_installments")
      .select("id, total_due")
      .eq("loan_id", loan.id)
    for (const inst of installments ?? []) {
      await supabase
        .from("loan_installments")
        .update({ paid_amount: Number(inst.total_due) })
        .eq("id", inst.id)
    }
    await supabase.from("loans").update({ status: "closed" }).eq("id", loan.id)
    await supabase
      .from("loan_payments")
      .update({ status: "verified", verified_by: userId, verified_at: new Date().toISOString() })
      .eq("id", paymentId)
    await writeAuditLog({
      circleId,
      userId,
      action: "loan_foreclosed",
      entityType: "loan",
      entityId: loan.id,
      previousValue: { status: "active" },
      newValue: { status: "closed", foreclosureAmount: Number(payment.amount) },
    })
    revalidatePath(`/circles/${circleId}/loans`)
    revalidatePath(`/circles/${circleId}/loans/${loan.id}`)
    return { success: true, data: undefined }
  }

  return { success: false, error: "Unknown payment type" }
}

export async function rejectLoanPayment(
  paymentId: string,
  reason: string,
  userId: string,
  circleId: string
): Promise<ActionResult> {
  if (!paymentId || !userId || !circleId) return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()
  const { data: membership } = await supabase
    .from("fund_circle_members")
    .select("role")
    .eq("fund_circle_id", circleId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle()
  if (!membership || !isAdminOrOwner(membership.role))
    return { success: false, error: "You don't have permission to reject payments." }
  const { data: payment } = await supabase
    .from("loan_payments")
    .select("id, loan_id, loan_installment_id, status")
    .eq("id", paymentId)
    .single()
  if (!payment) return { success: false, error: "Payment not found" }
  if (payment.status !== "pending") return { success: false, error: "Payment is not pending verification." }
  const loanId = payment.loan_id ?? (
    payment.loan_installment_id
      ? (await supabase.from("loan_installments").select("loan_id").eq("id", payment.loan_installment_id).single()).data?.loan_id
      : null
  )
  const { error } = await supabase
    .from("loan_payments")
    .update({ status: "rejected", verified_by: userId, verified_at: new Date().toISOString(), rejection_reason: reason || null })
    .eq("id", paymentId)
  if (error) return { success: false, error: "Failed to reject payment" }
  await writeAuditLog({
    circleId,
    userId,
    action: "loan_payment_rejected",
    entityType: "loan",
    entityId: loanId ?? "unknown",
    previousValue: { status: "pending" },
    newValue: { status: "rejected", reason: reason || null },
  })
  if (loanId) {
    revalidatePath(`/circles/${circleId}/loans`)
    revalidatePath(`/circles/${circleId}/loans/${loanId}`)
  }
  return { success: true, data: undefined }
}

async function applyPrepaymentAndRegenerate(
  loanId: string,
  prepaymentAmount: number,
  strategy: "reduce_emi" | "reduce_tenure",
  actorUserId: string,
  circleId: string
): Promise<ActionResult> {
  const supabase = createAdminSupabaseClient()
  const { data: loan } = await supabase
    .from("loans")
    .select("id, approved_amount, interest_rate_pct, approved_term_months")
    .eq("id", loanId)
    .single()
  if (!loan) return { success: false, error: "Loan not found" }
  const { data: rawInstallments } = await supabase
    .from("loan_installments")
    .select("id, installment_number, due_date, principal_component, interest_component, total_due, paid_amount")
    .eq("loan_id", loanId)
    .order("installment_number", { ascending: true })
  const installments = (rawInstallments ?? []).map((i) => ({
    id: i.id,
    installmentNumber: Number(i.installment_number),
    dueDate: i.due_date as string,
    principalComponent: Number(i.principal_component),
    interestComponent: Number(i.interest_component),
    totalDue: Number(i.total_due),
    paidAmount: Number(i.paid_amount),
  }))
  const currentIdx = installments.findIndex((i) => i.paidAmount < i.totalDue)
  if (currentIdx === -1) return { success: false, error: "All installments are already paid" }
  const current = installments[currentIdx]
  const remaining = current.totalDue - current.paidAmount
  let extraPrincipal = 0
  if (prepaymentAmount >= remaining) {
    // Clear the current installment in full
    await supabase
      .from("loan_installments")
      .update({ paid_amount: current.totalDue })
      .eq("id", current.id)
    extraPrincipal = roundCurrency(prepaymentAmount - remaining - current.interestComponent)
    if (extraPrincipal < 0) extraPrincipal = 0
  } else {
    await supabase
      .from("loan_installments")
      .update({ paid_amount: roundCurrency(current.paidAmount + prepaymentAmount) })
      .eq("id", current.id)
  }
  // Future installments (not yet started)
  const futureInstallments = installments.slice(currentIdx + 1)
  if (futureInstallments.length === 0 || extraPrincipal <= 0) {
    // Nothing to regenerate
    return { success: true, data: undefined }
  }
  const futurePrincipal = roundCurrency(
    futureInstallments.reduce((s, i) => s + i.principalComponent, 0)
  )
  const newPrincipal = roundCurrency(Math.max(0, futurePrincipal - extraPrincipal))
  if (newPrincipal <= 0) {
    // Prepayment covers everything — mark all remaining paid and close
    for (const inst of futureInstallments) {
      await supabase.from("loan_installments").update({ paid_amount: inst.totalDue }).eq("id", inst.id)
    }
    await supabase.from("loans").update({ status: "closed" }).eq("id", loanId)
    await writeAuditLog({
      circleId,
      userId: actorUserId,
      action: "loan_closed",
      entityType: "loan",
      entityId: loanId,
      previousValue: { status: "active" },
      newValue: { status: "closed", via: "prepayment" },
    })
    return { success: true, data: undefined }
  }
  const interestRatePct = Number(loan.interest_rate_pct ?? 0)
  const monthlyRate = interestRatePct / 1200
  const currentEMI = current.totalDue // use current installment's total as the base EMI
  let newTermMonths: number
  if (strategy === "reduce_emi") {
    newTermMonths = futureInstallments.length
  } else {
    newTermMonths = monthsToPayOff(newPrincipal, monthlyRate, currentEMI)
    if (newTermMonths < 1) newTermMonths = 1
  }
  const baseDate = new Date(current.dueDate)
  const newSchedule = generateAmortizationSchedule(newPrincipal, interestRatePct, newTermMonths, baseDate)
  // Delete future installments and replace with new schedule
  const futureIds = futureInstallments.map((i) => i.id)
  await supabase.from("loan_installments").delete().in("id", futureIds)
  const newRows = newSchedule.map((row) => ({
    loan_id: loanId,
    installment_number: current.installmentNumber + row.installmentNumber,
    due_date: row.dueDate,
    principal_component: row.principalComponent,
    interest_component: row.interestComponent,
    total_due: row.totalDue,
    paid_amount: 0,
    late_fee_applied: 0,
  }))
  await supabase.from("loan_installments").insert(newRows)
  await writeAuditLog({
    circleId,
    userId: actorUserId,
    action: "loan_schedule_regenerated",
    entityType: "loan",
    entityId: loanId,
    previousValue: { futureInstallments: futureInstallments.length, futurePrincipal },
    newValue: { newTermMonths, newPrincipal, strategy },
  })
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

const VALID_ASSET_TYPES: AssetType[] = ["recurring_deposit", "fixed_deposit", "cash_in_hand", "mutual_fund", "other"]

export async function addCycleAssetRecord(
  circleId: string,
  cycleId: string | null,
  assetType: string,
  institution: string,
  amount: number,
  notes: string,
  actorUserId: string
): Promise<ActionResult> {
  if (!circleId || !actorUserId) return { success: false, error: "Missing required fields" }
  if (!VALID_ASSET_TYPES.includes(assetType as AssetType)) return { success: false, error: "Invalid asset type" }
  if (amount < 0) return { success: false, error: "Amount cannot be negative" }

  const supabase = createAdminSupabaseClient()
  const { data: membership } = await supabase.from("fund_circle_members").select("role").eq("fund_circle_id", circleId).eq("user_id", actorUserId).eq("active", true).maybeSingle()
  if (!membership || !isAdminOrOwner(membership.role)) return { success: false, error: "You don't have permission to record asset allocations for this circle." }

  const { data: record, error } = await supabase
    .from("cycle_asset_records")
    .insert({
      fund_circle_id: circleId,
      contribution_cycle_id: cycleId,
      asset_type: assetType,
      institution: institution || null,
      amount: Number(amount),
      notes: notes || null,
      recorded_by: actorUserId,
    })
    .select("id")
    .single()

  if (error || !record) return { success: false, error: "Failed to record asset allocation" }

  await writeAuditLog({
    circleId,
    userId: actorUserId,
    action: "cycle_asset_recorded",
    entityType: "cycle_asset_record",
    entityId: record.id,
    newValue: { assetType, institution: institution || null, amount: Number(amount), notes: notes || null, contributionCycleId: cycleId },
  })

  revalidatePath(`/circles/${circleId}/settlement`)
  if (cycleId) revalidatePath(`/circles/${circleId}/cycles/${cycleId}`)
  return { success: true, data: undefined }
}

export async function updateAssetRecordValue(recordId: string, currentValue: number, actorUserId: string, circleId: string): Promise<ActionResult> {
  if (!recordId || !circleId || !actorUserId) return { success: false, error: "Missing required fields" }
  if (currentValue < 0) return { success: false, error: "Current value cannot be negative" }

  const supabase = createAdminSupabaseClient()
  const { data: membership } = await supabase.from("fund_circle_members").select("role").eq("fund_circle_id", circleId).eq("user_id", actorUserId).eq("active", true).maybeSingle()
  if (!membership || !isAdminOrOwner(membership.role)) return { success: false, error: "You don't have permission to update asset values for this circle." }

  const { data: existing } = await supabase.from("cycle_asset_records").select("current_value, fund_circle_id").eq("id", recordId).single()
  if (!existing || existing.fund_circle_id !== circleId) return { success: false, error: "Asset record not found" }

  const { error } = await supabase.from("cycle_asset_records").update({ current_value: Number(currentValue) }).eq("id", recordId)
  if (error) return { success: false, error: "Failed to update asset value" }

  await writeAuditLog({
    circleId,
    userId: actorUserId,
    action: "asset_record_revalued",
    entityType: "cycle_asset_record",
    entityId: recordId,
    previousValue: { currentValue: existing.current_value !== null ? Number(existing.current_value) : null },
    newValue: { currentValue: Number(currentValue) },
  })

  revalidatePath(`/circles/${circleId}/settlement`)
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

export async function calculateCircleSettlement(
  circleId: string,
  actorUserId: string,
  totalValueOverride?: number
): Promise<ActionResult> {
  if (!circleId || !actorUserId) return { success: false, error: "Missing required fields" }

  const supabase = createAdminSupabaseClient()

  const { data: membership } = await supabase.from("fund_circle_members").select("role").eq("fund_circle_id", circleId).eq("user_id", actorUserId).eq("active", true).maybeSingle()
  if (!membership || !isAdminOrOwner(membership.role)) return { success: false, error: "You don't have permission to calculate settlement for this circle." }

  const { data: blockingLoans } = await supabase
    .from("loans")
    .select("id")
    .eq("fund_circle_id", circleId)
    .in("status", ["pending_request", "active"])

  if (blockingLoans && blockingLoans.length > 0) {
    return { success: false, error: `${blockingLoans.length} loan(s) are still pending or active. All loans must be closed, rejected, or cancelled before settling.` }
  }

  const { data: existing } = await supabase.from("circle_settlements").select("id, status").eq("fund_circle_id", circleId).maybeSingle()
  if (existing?.status === "finalized") return { success: false, error: "Settlement is already finalized and cannot be recalculated." }

  const { data: cycleRows } = await supabase.from("contribution_cycles").select("id").eq("fund_circle_id", circleId)
  const cycleIds = (cycleRows ?? []).map((c) => c.id)

  const memberTotals = new Map<string, number>()
  let totalContributionsBase = 0

  if (cycleIds.length > 0) {
    const { data: contribs } = await supabase.from("contributions").select("user_id, paid_amount").in("contribution_cycle_id", cycleIds)
    for (const c of (contribs ?? [])) {
      const prev = memberTotals.get(c.user_id) ?? 0
      const amt = Number(c.paid_amount)
      memberTotals.set(c.user_id, prev + amt)
      totalContributionsBase += amt
    }
  }

  const { data: closedLoans } = await supabase.from("loans").select("id").eq("fund_circle_id", circleId).eq("status", "closed")
  const closedLoanIds = (closedLoans ?? []).map((l) => l.id)

  let totalLoanInterest = 0
  if (closedLoanIds.length > 0) {
    const { data: installments } = await supabase.from("loan_installments").select("interest_component").in("loan_id", closedLoanIds)
    totalLoanInterest = (installments ?? []).reduce((s, li) => s + Number(li.interest_component), 0)
  }

  const { data: assetRows } = await supabase.from("cycle_asset_records").select("amount, current_value").eq("fund_circle_id", circleId)
  const totalAssetGains = (assetRows ?? []).reduce((s, r) => {
    const gain = r.current_value !== null ? Math.max(0, Number(r.current_value) - Number(r.amount)) : 0
    return s + gain
  }, 0)

  const suggestedTotal = roundCurrency(totalContributionsBase + totalLoanInterest + totalAssetGains)
  const totalValue = totalValueOverride !== undefined ? roundCurrency(totalValueOverride) : suggestedTotal
  if (totalValue < 0) return { success: false, error: "Total value cannot be negative" }

  let settlementId: string

  if (existing) {
    const { error } = await supabase
      .from("circle_settlements")
      .update({ total_value: totalValue, total_contributions_base: totalContributionsBase, calculated_by: actorUserId, calculated_at: new Date().toISOString() })
      .eq("id", existing.id)
    if (error) return { success: false, error: "Failed to update settlement" }
    settlementId = existing.id
    await supabase.from("circle_settlement_payouts").delete().eq("circle_settlement_id", settlementId)
  } else {
    const { data: newSettlement, error } = await supabase
      .from("circle_settlements")
      .insert({ fund_circle_id: circleId, total_value: totalValue, total_contributions_base: totalContributionsBase, calculated_by: actorUserId })
      .select("id")
      .single()
    if (error || !newSettlement) return { success: false, error: "Failed to create settlement" }
    settlementId = newSettlement.id
  }

  const payoutRows = Array.from(memberTotals.entries())
    .filter(([, total]) => total > 0)
    .map(([userId, contribTotal]) => ({
      circle_settlement_id: settlementId,
      user_id: userId,
      contribution_total: contribTotal,
      share_amount: computeMemberShare(contribTotal, totalContributionsBase, totalValue),
    }))

  if (payoutRows.length > 0) {
    const { error } = await supabase.from("circle_settlement_payouts").insert(payoutRows)
    if (error) return { success: false, error: "Failed to insert payout rows" }
  }

  await writeAuditLog({
    circleId,
    userId: actorUserId,
    action: "circle_settlement_calculated",
    entityType: "circle_settlement",
    entityId: settlementId,
    newValue: { totalValue, totalContributionsBase, memberCount: payoutRows.length },
  })

  revalidatePath(`/circles/${circleId}/settlement`)
  return { success: true, data: undefined }
}

export async function finalizeCircleSettlement(circleId: string, actorUserId: string): Promise<ActionResult> {
  if (!circleId || !actorUserId) return { success: false, error: "Missing required fields" }

  const supabase = createAdminSupabaseClient()

  const { data: membership } = await supabase.from("fund_circle_members").select("role").eq("fund_circle_id", circleId).eq("user_id", actorUserId).eq("active", true).maybeSingle()
  if (!membership || !isAdminOrOwner(membership.role)) return { success: false, error: "You don't have permission to finalize settlement for this circle." }

  const { data: settlement } = await supabase.from("circle_settlements").select("id, status").eq("fund_circle_id", circleId).maybeSingle()
  if (!settlement) return { success: false, error: "No settlement found. Calculate a settlement first." }
  if (settlement.status === "finalized") return { success: false, error: "Settlement is already finalized." }

  const { error: settleError } = await supabase
    .from("circle_settlements")
    .update({ status: "finalized", finalized_at: new Date().toISOString() })
    .eq("id", settlement.id)
  if (settleError) return { success: false, error: "Failed to finalize settlement" }

  const { error: circleError } = await supabase.from("fund_circles").update({ status: "closed" }).eq("id", circleId)
  if (circleError) return { success: false, error: "Failed to close circle" }

  await writeAuditLog({
    circleId,
    userId: actorUserId,
    action: "circle_settlement_finalized",
    entityType: "circle_settlement",
    entityId: settlement.id,
    newValue: { status: "finalized" },
  })

  revalidatePath(`/circles/${circleId}/settlement`)
  revalidatePath(`/circles/${circleId}/dashboard`)
  return { success: true, data: undefined }
}

export async function recordSettlementDisbursement(payoutId: string, circleId: string, actorUserId: string, notes?: string): Promise<ActionResult> {
  if (!payoutId || !circleId || !actorUserId) return { success: false, error: "Missing required fields" }

  const supabase = createAdminSupabaseClient()

  const { data: membership } = await supabase.from("fund_circle_members").select("role").eq("fund_circle_id", circleId).eq("user_id", actorUserId).eq("active", true).maybeSingle()
  if (!membership || !isAdminOrOwner(membership.role)) return { success: false, error: "You don't have permission to record disbursements for this circle." }

  const { data: payout } = await supabase.from("circle_settlement_payouts").select("id, disbursed, circle_settlement_id").eq("id", payoutId).single()
  if (!payout) return { success: false, error: "Payout not found" }
  if (payout.disbursed) return { success: false, error: "This payout has already been disbursed" }

  const { data: settlement } = await supabase.from("circle_settlements").select("fund_circle_id, status").eq("id", payout.circle_settlement_id).single()
  if (!settlement || settlement.fund_circle_id !== circleId) return { success: false, error: "Payout not found" }
  if (settlement.status !== "finalized") return { success: false, error: "Settlement must be finalized before marking payouts as disbursed" }

  const { error } = await supabase
    .from("circle_settlement_payouts")
    .update({ disbursed: true, disbursed_at: new Date().toISOString(), disbursed_by: actorUserId, notes: notes || null })
    .eq("id", payoutId)
  if (error) return { success: false, error: "Failed to record disbursement" }

  await writeAuditLog({
    circleId,
    userId: actorUserId,
    action: "settlement_payout_disbursed",
    entityType: "circle_settlement_payout",
    entityId: payoutId,
    newValue: { disbursed: true, notes: notes || null },
  })

  revalidatePath(`/circles/${circleId}/settlement`)
  return { success: true, data: undefined }
}
