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
    .select("name, contribution_amount, contribution_frequency, cycle_due_day")
    .eq("id", circleId)
    .single()
  if (!circle) return

  const period = getCyclePeriod(circle.contribution_frequency, new Date(), circle.cycle_due_day)
  const cycleStart = toISODate(period.start)

  const { data: existing } = await supabase
    .from("contribution_cycles")
    .select("id")
    .eq("fund_circle_id", circleId)
    .eq("cycle_start", cycleStart)
    .maybeSingle()
  if (existing) return

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
