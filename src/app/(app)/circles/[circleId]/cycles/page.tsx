import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Play, CircleDollarSign, ChevronRight } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { startNewCycleFormAction } from "@/lib/actions"
import { formatCurrency, formatISODate } from "@/lib/format"

export default async function CyclesPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const { circleId } = await params
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

  const { data: cycles } = await supabase
    .from("contribution_cycles")
    .select(`
      id, label, cycle_start, cycle_end, status,
      contributions(paid_amount, expected_amount)
    `)
    .eq("fund_circle_id", circleId)
    .order("created_at", { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Payments
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {(cycles ?? []).length} cycle{(cycles ?? []).length !== 1 ? "s" : ""}
          </p>
        </div>
        {canEdit && (
          <form action={startNewCycleFormAction}>
            <input type="hidden" name="circleId" value={circleId} />
            <input type="hidden" name="userId" value={user.id} />
            <Button size="sm" type="submit">
              <Play className="h-4 w-4" />
              Start Cycle
            </Button>
          </form>
        )}
      </div>

      {!cycles || cycles.length === 0 ? (
        <EmptyState
          icon={CircleDollarSign}
          title="No cycles yet"
          description="Start a cycle to begin tracking contributions for this circle."
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Contribution Cycles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cycles.map((cycle) => {
                const contribs = cycle.contributions as Array<{ paid_amount: number; expected_amount: number }> | undefined
                const totalExpected = contribs?.reduce((s, c) => s + Number(c.expected_amount), 0) ?? 0
                const totalPaid = contribs?.reduce((s, c) => s + Number(c.paid_amount), 0) ?? 0
                const progress = totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0

                return (
                  <Link
                    key={cycle.id}
                    href={`/circles/${circleId}/cycles/${cycle.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-light)] hover:bg-[var(--border-light)] transition-colors group">
                      <div className="min-w-0 flex-1 mr-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-[var(--text-primary)]">
                            {cycle.label}
                          </p>
                          <Badge
                            variant={cycle.status === "open" ? "info" : "default"}
                            className="text-[10px]"
                          >
                            {cycle.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          {formatISODate(cycle.cycle_start)} → {formatISODate(cycle.cycle_end)}
                        </p>
                        <div className="w-full h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden mt-2">
                          <div
                            className="h-full bg-teal rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <p className="text-base font-bold font-tabular text-[var(--text-primary)]">
                            {formatCurrency(totalPaid)}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)]">
                            of {formatCurrency(totalExpected)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors" />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
