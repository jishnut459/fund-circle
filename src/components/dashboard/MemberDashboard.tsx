import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CircleDollarSign } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency } from "@/lib/format"

interface MemberData {
  circleMeta: {
    name: string
    amount: number
    frequency: string
    memberCount: number
  }
  totalPaid: number
  totalExpected: number
  currentCycle: {
    id: string
    label: string
    circleId: string
    expectedAmount: number
    paidAmount: number
    status: string
  } | null
  cycles: Array<{
    id: string
    label: string
    circleName: string
    circleId: string
    expectedAmount: number
    paidAmount: number
    status: string
  }>
  circleId: string
}

export default function MemberDashboard({ data }: { data: MemberData }) {
  const { currentCycle, totalPaid, cycles, circleMeta } = data

  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight pb-4">
        My Dashboard
      </h2>

      {currentCycle ? (
        <Card className="mb-8">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                  {currentCycle.label}
                </h3>
                <Badge
                  variant={
                    currentCycle.status === "paid" ? "success" :
                    currentCycle.status === "partially_paid" ? "warning" : "default"
                  }
                  className="text-[10px]"
                >
                  {currentCycle.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold font-tabular text-[var(--text-primary)]">
                  {formatCurrency(currentCycle.paidAmount)}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  of {formatCurrency(currentCycle.expectedAmount)}
                </p>
              </div>
            </div>

            <div className="w-full h-2.5 bg-[var(--border-light)] rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all ${
                  currentCycle.status === "paid" ? "bg-emerald-500" :
                  currentCycle.status === "partially_paid" ? "bg-amber-500" : "bg-[var(--border-color)]"
                }`}
                style={{
                  width: `${currentCycle.expectedAmount > 0 ? Math.round((currentCycle.paidAmount / currentCycle.expectedAmount) * 100) : 0}%`,
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--text-muted)]">
              <span>{totalPaid > 0 ? `Total paid: ${formatCurrency(totalPaid)}` : "No payments yet"}</span>
              <span className="text-[var(--border-color)]">·</span>
              <span>{circleMeta.memberCount} member{circleMeta.memberCount !== 1 ? "s" : ""}</span>
              <span className="text-[var(--border-color)]">·</span>
              <span>{formatCurrency(circleMeta.amount)} / {circleMeta.frequency.replace(/_/g, " ")}</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-8">
          <CardContent className="p-5">
            <p className="text-sm text-[var(--text-muted)]">No active cycle.</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-xs text-[var(--text-muted)]">
              <span>{totalPaid > 0 ? `Total paid: ${formatCurrency(totalPaid)}` : "No payments yet"}</span>
              <span className="text-[var(--border-color)]">·</span>
              <span>{circleMeta.memberCount} member{circleMeta.memberCount !== 1 ? "s" : ""}</span>
              <span className="text-[var(--border-color)]">·</span>
              <span>{formatCurrency(circleMeta.amount)} / {circleMeta.frequency.replace(/_/g, " ")}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>My Contributions</CardTitle>
        </CardHeader>
        <CardContent>
          {cycles.length === 0 ? (
            <EmptyState
              icon={CircleDollarSign}
              title="No contributions yet"
              description="You haven't been added to any contribution cycles yet."
            />
          ) : (
            <div className="space-y-2">
              {cycles.map((cycle) => {
                const progress = cycle.expectedAmount > 0 ? Math.round((cycle.paidAmount / cycle.expectedAmount) * 100) : 0
                const progressColor =
                  cycle.status === "paid" ? "bg-emerald-500" :
                  cycle.status === "partially_paid" ? "bg-amber-500" : "bg-[var(--border-color)]"

                return (
                  <div
                    key={cycle.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-light)]"
                  >
                    <div className="min-w-0 flex-1 mr-4">
                      <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                        {cycle.label}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Expected: {formatCurrency(cycle.expectedAmount)}
                      </p>
                      <div className="w-full h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-full rounded-full transition-all ${progressColor}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold font-tabular text-[var(--text-primary)]">
                        {formatCurrency(cycle.paidAmount)}
                      </p>
                      <Badge
                        variant={
                          cycle.status === "paid" ? "success" :
                          cycle.status === "partially_paid" ? "warning" : "default"
                        }
                        className="mt-1"
                      >
                        {cycle.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
