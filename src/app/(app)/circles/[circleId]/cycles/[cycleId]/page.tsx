import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import ContributionTable from "@/components/contributions/ContributionTable"
import { closeCycleFormAction } from "@/lib/actions"
import { formatCurrency, formatISODate } from "@/lib/format"

export default async function CycleDetailPage({
  params,
}: {
  params: Promise<{ circleId: string; cycleId: string }>
}) {
  const { circleId, cycleId } = await params
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const supabase = createAdminSupabaseClient()

  const { data: membership } = await supabase
    .from("fund_circle_members")
    .select("role")
    .eq("fund_circle_id", circleId)
    .eq("user_id", user.id)
    .eq("active", true)
    .single()

  if (!membership) redirect("/circles")

  const role = membership.role
  const canEdit = isAdminOrOwner(role)

  const { data: cycle } = await supabase
    .from("contribution_cycles")
    .select("id, label, cycle_start, cycle_end, status, fund_circle_id")
    .eq("id", cycleId)
    .single()

  if (!cycle) redirect(`/circles/${circleId}/cycles`)

  const cycleClosed = cycle.status === "closed"

  const { data: rawContribs } = await supabase
    .from("contributions_with_status")
    .select("id, user_id, expected_amount, paid_amount, payment_date, notes, status")
    .eq("contribution_cycle_id", cycleId)

  const userIds = [...new Set((rawContribs ?? []).map((c) => c.user_id))]

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", userIds.length > 0 ? userIds : ["none"])

  const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) ?? [])

  const contributions = (rawContribs ?? []).map((c) => ({
    id: c.id,
    userId: c.user_id,
    userName: profileMap.get(c.user_id) ?? "Unknown",
    expectedAmount: Number(c.expected_amount),
    paidAmount: Number(c.paid_amount),
    paymentDate: c.payment_date,
    notes: c.notes,
    status: c.status,
  }))

  const totalExpected = contributions.reduce((s, c) => s + c.expectedAmount, 0)
  const totalPaid = contributions.reduce((s, c) => s + c.paidAmount, 0)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
              {cycle.label}
            </h2>
            <Badge variant={cycleClosed ? "default" : "info"}>
              {cycle.status}
            </Badge>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {formatISODate(cycle.cycle_start)} → {formatISODate(cycle.cycle_end)}
          </p>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-xl font-bold font-tabular text-[var(--text-primary)]">
              {formatCurrency(totalPaid)}
            </span>
            <span className="text-sm text-[var(--text-muted)]">
              collected of {formatCurrency(totalExpected)}
            </span>
          </div>
        </div>
        {canEdit && !cycleClosed && (
          <form action={closeCycleFormAction}>
            <input type="hidden" name="cycleId" value={cycleId} />
            <input type="hidden" name="circleId" value={circleId} />
            <input type="hidden" name="userId" value={user.id} />
            <Button variant="outline" size="sm" type="submit">Close Cycle</Button>
          </form>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Contributions</CardTitle>
        </CardHeader>
        <CardContent>
          <ContributionTable
            contributions={contributions}
            contributionCycleId={cycleId}
            circleId={circleId}
            currentUserId={user.id}
            canEdit={canEdit}
            cycleClosed={cycleClosed}
          />
        </CardContent>
      </Card>
    </div>
  )
}
