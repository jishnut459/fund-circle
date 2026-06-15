import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ChevronRight, Banknote, PlayCircle, CheckCircle2 } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency, formatISODate } from "@/lib/format"
import { ensureCurrentCycle } from "@/lib/ensure-cycle"

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

  await ensureCurrentCycle(circleId, user.id)

  const { data: cycles } = await supabase
    .from("contribution_cycles")
    .select(`
      id, label, cycle_start, cycle_end, due_date, status,
      contributions(paid_amount, expected_amount)
    `)
    .eq("fund_circle_id", circleId)
    .order("created_at", { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
            <Banknote className="h-5 w-5 text-teal" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight truncate">
              Payments
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              {(cycles ?? []).length} cycle{(cycles ?? []).length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {!cycles || cycles.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No cycles yet"
          description="The first contribution cycle for this circle will appear here shortly."
        />
      ) : (
        <div className="space-y-2">
          {cycles.map((cycle) => {
            const contribs = cycle.contributions as Array<{ paid_amount: number; expected_amount: number }> | undefined
            const totalExpected = contribs?.reduce((s, c) => s + Number(c.expected_amount), 0) ?? 0
            const totalPaid = contribs?.reduce((s, c) => s + Number(c.paid_amount), 0) ?? 0
            const progress = totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0
            const isOpen = cycle.status === "open"

            return (
              <Link
                key={cycle.id}
                href={`/circles/${circleId}/cycles/${cycle.id}`}
                className="block"
              >
                <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-[var(--border-light)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow group">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-[var(--text-primary)] truncate">
                        {cycle.label}
                      </p>
                      <Badge
                        variant={isOpen ? "info" : "default"}
                        className="gap-1 text-[10px] shrink-0"
                      >
                        {isOpen ? <PlayCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                        {cycle.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {formatISODate(cycle.cycle_start)} → {formatISODate(cycle.cycle_end)}
                      {cycle.due_date && ` · Pay by ${formatISODate(cycle.due_date)}`}
                    </p>
                    <div className="w-full h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden mt-2.5">
                      <div
                        className="h-full bg-teal rounded-full transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      <p className="text-lg font-bold font-tabular text-[var(--text-primary)]">
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
      )}
    </div>
  )
}
