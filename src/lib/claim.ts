import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { writeAuditLog } from "@/lib/audit"

export type RekeyResult = { success: true } | { success: false; error: string }

/**
 * Moves all of a managed (offline / non-app) member's history onto a real
 * account, then removes the managed profile. This is how a managed member is
 * "claimed": every reference keyed by the managed profile id (memberships,
 * contributions, loans, payments, settlement payouts) is re-pointed to the real
 * auth user's id, so the person sees their full history once they sign in.
 *
 * The per-user unique constraints — unique(fund_circle_id, user_id),
 * unique(contribution_cycle_id, user_id), unique(circle_settlement_id, user_id)
 * — only collide if the same person was ALSO separately added as a real member
 * (a rare double-add). Those collisions are merged rather than left to error.
 *
 * Caller must ensure a profiles row for `realUserId` already exists.
 */
export async function rekeyManagedMember(
  managedId: string,
  realUserId: string,
  actorUserId: string
): Promise<RekeyResult> {
  if (managedId === realUserId) return { success: true }
  const supabase = createAdminSupabaseClient()

  const { data: managed } = await supabase
    .from("profiles")
    .select("id, is_managed, email")
    .eq("id", managedId)
    .maybeSingle()
  if (!managed) return { success: false, error: "Managed member not found." }
  if (!managed.is_managed) return { success: false, error: "That member isn't a managed member." }

  // --- fund_circle_members: unique(fund_circle_id, user_id) ---
  const { data: managedMemberships } = await supabase
    .from("fund_circle_members")
    .select("id, fund_circle_id")
    .eq("user_id", managedId)
  const { data: realMemberships } = await supabase
    .from("fund_circle_members")
    .select("fund_circle_id")
    .eq("user_id", realUserId)
  const realCircles = new Set((realMemberships ?? []).map((m) => m.fund_circle_id))
  for (const m of managedMemberships ?? []) {
    if (realCircles.has(m.fund_circle_id)) {
      await supabase.from("fund_circle_members").delete().eq("id", m.id)
    } else {
      await supabase.from("fund_circle_members").update({ user_id: realUserId }).eq("id", m.id)
    }
  }

  // --- contributions: unique(contribution_cycle_id, user_id) ---
  const { data: managedContribs } = await supabase
    .from("contributions")
    .select("id, contribution_cycle_id, paid_amount, late_fee")
    .eq("user_id", managedId)
  for (const c of managedContribs ?? []) {
    const { data: realContrib } = await supabase
      .from("contributions")
      .select("id, paid_amount, late_fee")
      .eq("contribution_cycle_id", c.contribution_cycle_id)
      .eq("user_id", realUserId)
      .maybeSingle()
    if (realContrib) {
      // Merge the managed contribution into the real one: move its payment
      // history across, sum the amounts, then drop the duplicate.
      await supabase.from("contribution_payments").update({ contribution_id: realContrib.id }).eq("contribution_id", c.id)
      await supabase
        .from("contributions")
        .update({
          paid_amount: Number(realContrib.paid_amount) + Number(c.paid_amount),
          late_fee: Number(realContrib.late_fee) + Number(c.late_fee),
        })
        .eq("id", realContrib.id)
      await supabase.from("contributions").delete().eq("id", c.id)
    } else {
      await supabase.from("contributions").update({ user_id: realUserId }).eq("id", c.id)
    }
  }
  // Payment-history subject pointer (payments whose contribution wasn't merged)
  await supabase.from("contribution_payments").update({ submitted_by: realUserId }).eq("submitted_by", managedId)

  // --- loans (no per-user unique constraint) ---
  await supabase.from("loans").update({ user_id: realUserId }).eq("user_id", managedId)
  await supabase.from("loans").update({ requested_by: realUserId }).eq("requested_by", managedId)
  await supabase.from("loan_payments").update({ submitted_by: realUserId }).eq("submitted_by", managedId)

  // --- circle_settlement_payouts: unique(circle_settlement_id, user_id) ---
  const { data: managedPayouts } = await supabase
    .from("circle_settlement_payouts")
    .select("id, circle_settlement_id")
    .eq("user_id", managedId)
  for (const p of managedPayouts ?? []) {
    const { data: realPayout } = await supabase
      .from("circle_settlement_payouts")
      .select("id")
      .eq("circle_settlement_id", p.circle_settlement_id)
      .eq("user_id", realUserId)
      .maybeSingle()
    if (realPayout) {
      await supabase.from("circle_settlement_payouts").delete().eq("id", p.id)
    } else {
      await supabase.from("circle_settlement_payouts").update({ user_id: realUserId }).eq("id", p.id)
    }
  }

  const circleId = (managedMemberships ?? [])[0]?.fund_circle_id ?? null
  await writeAuditLog({
    circleId,
    userId: actorUserId,
    action: "managed_member_claimed",
    entityType: "fund_circle_member",
    entityId: realUserId,
    previousValue: { managedId },
    newValue: { claimedBy: realUserId, email: managed.email },
  })

  // All children re-pointed — remove the managed profile so its email can't
  // collide with the now-real account.
  await supabase.from("profiles").delete().eq("id", managedId)
  return { success: true }
}
