"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase-server"
import { writeAuditLog } from "@/lib/audit"
import { resolveUserOnSignIn } from "@/lib/onboarding"
import { addMemberToOpenCycles } from "@/lib/ensure-cycle"
import { canEditContributions, isAdminOrOwner } from "@/lib/permissions"
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
