import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { writeAuditLog } from "@/lib/audit"
import { getCyclePeriod, toISODate } from "@/lib/cycles"

/**
 * Makes sure a contribution_cycles row exists for the circle's current period
 * (derived from its frequency + due-day settings and today's date), creating
 * one along with per-member contributions if needed, and closing any cycle
 * left open from a prior period. Safe to call on every page load.
 */
export async function ensureCurrentCycle(circleId: string, actorUserId: string): Promise<void> {
  const supabase = createAdminSupabaseClient()

  const { data: circle } = await supabase
    .from("fund_circles")
    .select("name, contribution_amount, contribution_frequency, cycle_due_day, start_date, end_date")
    .eq("id", circleId)
    .single()
  if (!circle) return

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (circle.start_date && today < new Date(circle.start_date)) return
  if (circle.end_date && today > new Date(circle.end_date)) return

  const period = getCyclePeriod(circle.contribution_frequency, today, circle.cycle_due_day)
  const cycleStart = toISODate(period.start)

  const { data: existing } = await supabase
    .from("contribution_cycles")
    .select("id")
    .eq("fund_circle_id", circleId)
    .eq("cycle_start", cycleStart)
    .maybeSingle()
  if (existing) {
    await backfillCycleContributions(supabase, circleId, existing.id, circle.contribution_amount)
    return
  }

  const { data: openCycles } = await supabase
    .from("contribution_cycles")
    .select("id")
    .eq("fund_circle_id", circleId)
    .eq("status", "open")

  if (openCycles && openCycles.length > 0) {
    await supabase.from("contribution_cycles").update({ status: "closed" }).eq("fund_circle_id", circleId).eq("status", "open")
    for (const oc of openCycles) {
      await writeAuditLog({ circleId, userId: actorUserId, action: "cycle_closed", entityType: "contribution_cycle", entityId: oc.id, newValue: { reason: "period_ended" } })
    }
  }

  const { data: cycle, error } = await supabase
    .from("contribution_cycles")
    .insert({
      fund_circle_id: circleId,
      label: period.label,
      cycle_start: cycleStart,
      cycle_end: toISODate(period.end),
      due_date: toISODate(period.dueDate),
    })
    .select("id")
    .single()
  if (error || !cycle) return

  const { data: members } = await supabase.from("fund_circle_members").select("user_id").eq("fund_circle_id", circleId).eq("active", true)
  if (members && members.length > 0) {
    await supabase.from("contributions").insert(members.map((m) => ({ contribution_cycle_id: cycle.id, user_id: m.user_id, expected_amount: circle.contribution_amount })))
  }

  await writeAuditLog({
    circleId,
    userId: actorUserId,
    action: "cycle_started",
    entityType: "contribution_cycle",
    entityId: cycle.id,
    newValue: { label: period.label, circleName: circle.name, dueDate: toISODate(period.dueDate) },
  })
}

/**
 * Ensures every currently active member of the circle has a contribution row
 * on the given cycle, inserting any that are missing (e.g. members added
 * after the cycle was created).
 */
async function backfillCycleContributions(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  circleId: string,
  cycleId: string,
  contributionAmount: number
): Promise<void> {
  const { data: members } = await supabase
    .from("fund_circle_members")
    .select("user_id")
    .eq("fund_circle_id", circleId)
    .eq("active", true)
  if (!members || members.length === 0) return

  const { data: existingContribs } = await supabase
    .from("contributions")
    .select("user_id")
    .eq("contribution_cycle_id", cycleId)
  const existingUserIds = new Set((existingContribs ?? []).map((c) => c.user_id))

  const missing = members.filter((m) => !existingUserIds.has(m.user_id))
  if (missing.length === 0) return

  await supabase.from("contributions").insert(
    missing.map((m) => ({ contribution_cycle_id: cycleId, user_id: m.user_id, expected_amount: contributionAmount }))
  )
}

/**
 * Backfills a contribution row for a newly added/re-activated member on any
 * currently open cycle(s) of the circle, so they show up in cycles that were
 * already created before they joined.
 */
export async function addMemberToOpenCycles(circleId: string, userId: string): Promise<void> {
  const supabase = createAdminSupabaseClient()

  const { data: circle } = await supabase
    .from("fund_circles")
    .select("contribution_amount")
    .eq("id", circleId)
    .single()
  if (!circle) return

  const { data: openCycles } = await supabase
    .from("contribution_cycles")
    .select("id")
    .eq("fund_circle_id", circleId)
    .eq("status", "open")
  if (!openCycles || openCycles.length === 0) return

  for (const oc of openCycles) {
    const { data: existing } = await supabase
      .from("contributions")
      .select("id")
      .eq("contribution_cycle_id", oc.id)
      .eq("user_id", userId)
      .maybeSingle()
    if (existing) continue

    await supabase.from("contributions").insert({
      contribution_cycle_id: oc.id,
      user_id: userId,
      expected_amount: circle.contribution_amount,
    })
  }
}
