"use server"

import { revalidatePath } from "next/cache"
import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { writeAuditLog } from "@/lib/audit"
import type { ActionResult } from "@/lib/types"

const PLAN_LIMITS: Record<string, number> = { free: 20, pro: 100, premium: 9999 }

function getMemberLimit(plan: string): number {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
}

export async function createFundCircle(name: string, description: string, amount: number, frequency: string, userId: string, plan: string = "free"): Promise<ActionResult<{ circleId: string }>> {
  if (!name || !amount || !userId) return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()
  const maxMembers = getMemberLimit(plan)
  const { data: circle, error: circleError } = await supabase.from("fund_circles").insert({ name, description, contribution_amount: amount, contribution_frequency: frequency || "monthly", subscription_plan: plan, max_members: maxMembers }).select("id").single()
  if (circleError || !circle) return { success: false, error: "Failed to create fund circle" }
  await supabase.from("fund_circle_members").insert({ fund_circle_id: circle.id, user_id: userId, role: "owner", active: true })
  await writeAuditLog({ circleId: circle.id, userId, action: "fund_circle_created", entityType: "fund_circle", entityId: circle.id, newValue: { name, amount, frequency, plan } })
  revalidatePath("/circles")
  return { success: true, data: { circleId: circle.id } }
}

export async function addCircleMember(params: { circleId: string; email: string; fullName: string; role: "admin" | "member"; actorUserId: string }): Promise<ActionResult<{ status: "linked" | "invited" }>> {
  const { circleId, email, fullName, role, actorUserId } = params
  if (!circleId || !email || !fullName || !role) return { success: false, error: "Missing required fields" }
  const supabase = createAdminSupabaseClient()

  const { data: circle } = await supabase.from("fund_circles").select("name, subscription_plan, max_members").eq("id", circleId).single()
  if (!circle) return { success: false, error: "Circle not found" }

  const { count: memberCount } = await supabase.from("fund_circle_members").select("*", { count: "exact", head: true }).eq("fund_circle_id", circleId).eq("active", true)
  if (memberCount != null && memberCount >= (circle.max_members ?? 20)) return { success: false, error: `Member limit reached (${circle.max_members ?? 20} per circle).` }

  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", email.toLowerCase().trim()).maybeSingle()
  if (existingProfile) {
    const { error: memberError } = await supabase.from("fund_circle_members").upsert({ fund_circle_id: circleId, user_id: existingProfile.id, role, active: true }, { onConflict: "fund_circle_id, user_id" })
    if (memberError) return { success: false, error: "Failed to add member to circle" }
    await writeAuditLog({ circleId, userId: existingProfile.id, action: "member_added_to_circle", entityType: "fund_circle_member", newValue: { email, name: fullName, role } })
    revalidatePath(`/circles/${circleId}/members`)
    return { success: true, data: { status: "linked" } }
  }

  const { error: inviteError } = await supabase.from("org_invites").insert({ email: email.toLowerCase().trim(), role: "member", fund_circle_id: circleId, status: "pending" })
  if (inviteError) { if (inviteError.code === "23505") return { success: false, error: "An invite has already been sent to this email." }; return { success: false, error: "Failed to send invite" } }
  await writeAuditLog({ circleId, userId: actorUserId, action: "invite_sent", entityType: "org_invites", newValue: { email, role, circleName: circle.name } })
  revalidatePath(`/circles/${circleId}/members`)
  return { success: true, data: { status: "invited" } }
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

export async function startNewCycle(circleId: string, userId: string): Promise<ActionResult> {
  const supabase = createAdminSupabaseClient()
  const { data: circle } = await supabase.from("fund_circles").select("contribution_amount, name").eq("id", circleId).single()
  if (!circle) return { success: false, error: "Fund circle not found" }
  const now = new Date(); const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1); const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const label = startOfMonth.toLocaleString("en-IN", { month: "long", year: "numeric" })
  const { data: cycle } = await supabase.from("contribution_cycles").insert({ fund_circle_id: circleId, label, cycle_start: startOfMonth.toISOString().split("T")[0], cycle_end: endOfMonth.toISOString().split("T")[0] }).select("id").single()
  if (!cycle) return { success: false, error: "Failed to start cycle" }
  const { data: members } = await supabase.from("fund_circle_members").select("user_id").eq("fund_circle_id", circleId).eq("active", true)
  if (members && members.length > 0) { await supabase.from("contributions").insert(members.map((m) => ({ contribution_cycle_id: cycle.id, user_id: m.user_id, expected_amount: circle.contribution_amount }))) }
  await writeAuditLog({ circleId, userId, action: "cycle_started", entityType: "contribution_cycle", entityId: cycle.id, newValue: { label, circleName: circle.name } })
  revalidatePath(`/circles/${circleId}/cycles`)
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
  const { data: contrib } = await supabase.from("contributions").select("paid_amount, expected_amount, contribution_cycle_id").eq("id", contributionId).single()
  if (!contrib) return { success: false, error: "Contribution not found" }
  const { data: cycle } = await supabase.from("contribution_cycles").select("status, fund_circle_id").eq("id", contrib.contribution_cycle_id).single()
  if (cycle?.status === "closed") return { success: false, error: "Cycle is closed" }
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

export async function startNewCycleFormAction(formData: FormData): Promise<void> {
  const circleId = formData.get("circleId") as string; const userId = formData.get("userId") as string
  await startNewCycle(circleId, userId)
}

export async function closeCycleFormAction(formData: FormData): Promise<void> {
  const cycleId = formData.get("cycleId") as string; const userId = formData.get("userId") as string; const circleId = formData.get("circleId") as string
  await closeCycle(cycleId, userId, circleId)
}
