import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CircleDollarSign } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import Link from "next/link"
import { formatCurrency } from "@/lib/format"

interface DashboardData {
  circleMeta: {
    name: string
    amount: number
    frequency: string
    memberCount: number
  }
  currentCycle: {
    label: string
    status: string
    totalExpected: number
    totalPaid: number
    paidCount: number
    partialCount: number
    unpaidCount: number
  } | null
  totalCollected: number
  recentCycles: Array<{
    id: string
    label: string
    circleName: string
    circleId: string
    totalExpected: number
    totalPaid: number
    status: string
    paidCount: number
    partialCount: number
    unpaidCount: number
  }>
  circleId: string
}

export default function OwnerDashboard({ data }: { data: DashboardData }) {
  const { currentCycle, totalCollected, recentCycles, circleId, circleMeta } = data

  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight pb-4">
        Dashboard
      </h2>

      {currentCycle ? (
        <Card className="mb-8">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                  {currentCycle.label}
                </h3>
                <Badge variant={currentCycle.status === "open" ? "info" : "default"} className="text-[10px]">
                  {currentCycle.status}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold font-tabular text-[var(--text-primary)]">
                  {formatCurrency(currentCycle.totalPaid)}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  of {formatCurrency(currentCycle.totalExpected)}
                </p>
              </div>
            </div>

            <div className="w-full h-2.5 bg-[var(--border-light)] rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-teal rounded-full transition-all"
                style={{
                  width: `${currentCycle.totalExpected > 0 ? Math.round((currentCycle.totalPaid / currentCycle.totalExpected) * 100) : 0}%`,
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
              <span className="text-emerald-600 font-semibold">
                {currentCycle.paidCount} paid
              </span>
              <span className="text-amber-600 font-semibold">
                {currentCycle.partialCount} partial
              </span>
              <span className="text-[var(--text-muted)]">
                {currentCycle.unpaidCount} unpaid
              </span>
              <span className="text-[var(--border-color)]">·</span>
              <span className="text-[var(--text-muted)]">
                {circleMeta.memberCount} member{circleMeta.memberCount !== 1 ? "s" : ""}
              </span>
              <span className="text-[var(--border-color)]">·</span>
              <span className="text-[var(--text-muted)]">
                {formatCurrency(circleMeta.amount)} / {circleMeta.frequency.replace(/_/g, " ")}
              </span>
              <span className="text-[var(--border-color)]">·</span>
              <span className="text-[var(--text-muted)]">
                Total: {formatCurrency(totalCollected)}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-8">
          <CardContent className="p-5">
            <p className="text-sm text-[var(--text-muted)]">No active cycle.</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-xs">
              <span className="text-[var(--text-muted)]">
                {circleMeta.memberCount} member{circleMeta.memberCount !== 1 ? "s" : ""}
              </span>
              <span className="text-[var(--border-color)]">·</span>
              <span className="text-[var(--text-muted)]">
                {formatCurrency(circleMeta.amount)} / {circleMeta.frequency.replace(/_/g, " ")}
              </span>
              <span className="text-[var(--border-color)]">·</span>
              <span className="text-[var(--text-muted)]">
                Total: {formatCurrency(totalCollected)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Recent Cycles</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCycles.length === 0 ? (
            <EmptyState
              icon={CircleDollarSign}
              title="No cycles yet"
              description="Start a cycle to begin tracking contributions."
              action={{ label: "Go to Payments", href: `/circles/${circleId}/cycles` }}
            />
          ) : (
            <div className="space-y-2">
              {recentCycles.map((cycle) => {
                const progress = cycle.totalExpected > 0 ? Math.round((cycle.totalPaid / cycle.totalExpected) * 100) : 0

                return (
                  <Link
                    key={cycle.id}
                    href={`/circles/${cycle.circleId}/cycles/${cycle.id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-light)] hover:bg-[var(--border-light)] transition-colors">
                      <div className="space-y-1 min-w-0 flex-1 mr-4">
                        <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                          {cycle.label}
                        </p>
                        <div className="flex gap-2 text-[11px]">
                          <span className="text-emerald-600 font-medium">{cycle.paidCount} paid</span>
                          <span className="text-amber-600 font-medium">{cycle.partialCount} partial</span>
                          <span className="text-[var(--text-muted)]">{cycle.unpaidCount} unpaid</span>
                        </div>
                        <div className="w-full h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold font-tabular text-[var(--text-primary)]">
                          {formatCurrency(cycle.totalPaid)}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          of {formatCurrency(cycle.totalExpected)}
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
