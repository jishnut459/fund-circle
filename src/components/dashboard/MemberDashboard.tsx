import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { PiggyBank, Banknote, Wallet, Users, Repeat, CheckCircle2, Clock, Circle, TrendingUp, type LucideIcon } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency, formatISODate } from "@/lib/format"

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
    dueDate: string | null
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

const STATUS_BADGE: Record<string, NonNullable<BadgeProps["variant"]>> = {
  paid: "success",
  partially_paid: "warning",
  overpaid: "info",
  unpaid: "default",
}

const STATUS_ICON: Record<string, LucideIcon> = {
  paid: CheckCircle2,
  partially_paid: Clock,
  overpaid: TrendingUp,
  unpaid: Circle,
}

const STATUS_ICON_COLOR: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  partially_paid: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  overpaid: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  unpaid: "bg-[var(--border-light)] text-[var(--text-muted)]",
}

const STATUS_BAR_COLOR: Record<string, string> = {
  paid: "bg-emerald-500",
  partially_paid: "bg-amber-500",
  overpaid: "bg-blue-500",
  unpaid: "bg-[var(--border-color)]",
}

export default function MemberDashboard({ data }: { data: MemberData }) {
  const { currentCycle, totalPaid, cycles, circleMeta } = data
  const progress = currentCycle && currentCycle.expectedAmount > 0
    ? Math.round((currentCycle.paidAmount / currentCycle.expectedAmount) * 100)
    : 0

  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight pb-4">
        My Dashboard
      </h2>

      {currentCycle ? (
        <Card className="mb-8">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
                  <Wallet className="h-5 w-5 text-teal" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-[var(--text-primary)] truncate">
                      {currentCycle.label}
                    </h3>
                    <Badge variant={STATUS_BADGE[currentCycle.status] ?? "default"} className="text-[10px]">
                      {currentCycle.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Current cycle{currentCycle.dueDate && ` · Pay by ${formatISODate(currentCycle.dueDate)}`}
                  </p>
                </div>
              </div>
              <Badge variant={progress >= 100 ? "success" : "default"} className="text-xs shrink-0 font-tabular">
                {progress}%
              </Badge>
            </div>

            <div className="mb-4">
              <p className="text-3xl font-bold font-tabular text-[var(--text-primary)]">
                {formatCurrency(currentCycle.paidAmount)}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                of {formatCurrency(currentCycle.expectedAmount)} expected
              </p>
            </div>

            <div className="w-full h-2.5 bg-[var(--border-light)] rounded-full overflow-hidden mb-5">
              <div
                className={`h-full rounded-full transition-all ${STATUS_BAR_COLOR[currentCycle.status] ?? STATUS_BAR_COLOR.unpaid}`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-4 border-t border-[var(--border-light)] text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <PiggyBank className="h-3.5 w-3.5" />
                {totalPaid > 0 ? `${formatCurrency(totalPaid)} paid all-time` : "No payments yet"}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {circleMeta.memberCount} member{circleMeta.memberCount !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5" />
                {formatCurrency(circleMeta.amount)} / {circleMeta.frequency.replace(/_/g, " ")}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-8">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
                <Wallet className="h-5 w-5 text-teal" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">No active cycle</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Your contributions will show up here once a cycle starts.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-4 border-t border-[var(--border-light)] text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <PiggyBank className="h-3.5 w-3.5" />
                {totalPaid > 0 ? `${formatCurrency(totalPaid)} paid all-time` : "No payments yet"}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {circleMeta.memberCount} member{circleMeta.memberCount !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5" />
                {formatCurrency(circleMeta.amount)} / {circleMeta.frequency.replace(/_/g, " ")}
              </span>
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
              icon={Banknote}
              title="No contributions yet"
              description="You haven't been added to any contribution cycles yet."
            />
          ) : (
            <div className="space-y-2">
              {cycles.map((cycle) => {
                const cycleProgress = cycle.expectedAmount > 0 ? Math.round((cycle.paidAmount / cycle.expectedAmount) * 100) : 0
                const Icon = STATUS_ICON[cycle.status] ?? Circle

                return (
                  <div
                    key={cycle.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border-light)]"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${STATUS_ICON_COLOR[cycle.status] ?? STATUS_ICON_COLOR.unpaid}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                          {cycle.label}
                        </p>
                        <Badge variant={STATUS_BADGE[cycle.status] ?? "default"} className="text-[10px] shrink-0">
                          {cycle.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        Expected: {formatCurrency(cycle.expectedAmount)}
                      </p>
                      <div className="w-full h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${STATUS_BAR_COLOR[cycle.status] ?? STATUS_BAR_COLOR.unpaid}`}
                          style={{ width: `${Math.min(cycleProgress, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold font-tabular text-[var(--text-primary)]">
                        {formatCurrency(cycle.paidAmount)}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {cycleProgress}%
                      </p>
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
