import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PiggyBank, Banknote, Wallet, Users, Repeat, CheckCircle2, Clock, Circle, HandCoins, Landmark, ListChecks, CalendarClock, ArrowRight, type LucideIcon } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import Link from "next/link"
import { formatCurrency, formatISODate } from "@/lib/format"
import FundHealthCard from "./FundHealthCard"

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
    dueDate: string | null
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
  lendingPoolAvailable: number
  assetsValue: number
  totalPrincipalOutstanding: number
  activeLoanCount: number
  totalDisbursed: number
  totalRepaid: number
  endDate: string | null
  settlementStatus: string | null
  showSettlementBanner: boolean
  endDatePassed: boolean
}

function FundsMetricCard({
  icon: Icon,
  label,
  value,
  iconClass,
}: {
  icon: LucideIcon
  label: string
  value: string
  iconClass: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-xs font-medium text-[var(--text-muted)] truncate">{label}</p>
        </div>
        <p className="text-xl font-bold font-tabular text-[var(--text-primary)]">{value}</p>
      </CardContent>
    </Card>
  )
}

function StatChip({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: LucideIcon
  label: string
  value: number
  colorClass: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl bg-[var(--bg-page)] border border-[var(--border-light)] py-3">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${colorClass}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="text-lg font-bold font-tabular text-[var(--text-primary)]">{value}</p>
      <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
    </div>
  )
}

export default function OwnerDashboard({ data }: { data: DashboardData }) {
  const { currentCycle, totalCollected, recentCycles, circleId, circleMeta, lendingPoolAvailable, assetsValue, totalPrincipalOutstanding, activeLoanCount, totalDisbursed, totalRepaid, endDate, settlementStatus, showSettlementBanner, endDatePassed } = data
  const progress = currentCycle && currentCycle.totalExpected > 0
    ? Math.round((currentCycle.totalPaid / currentCycle.totalExpected) * 100)
    : 0

  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight pb-4">
        Dashboard
      </h2>

      {showSettlementBanner && (
        <Link href={`/circles/${circleId}/settlement`}>
          <div className={`flex items-center gap-3 p-4 rounded-xl mb-5 border ${endDatePassed ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700" : "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700"}`}>
            <CalendarClock className={`h-5 w-5 shrink-0 ${endDatePassed ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${endDatePassed ? "text-amber-900 dark:text-amber-200" : "text-blue-900 dark:text-blue-200"}`}>
                {endDatePassed ? "Circle end date has passed" : `Circle ends ${formatISODate(endDate!)}`}
              </p>
              <p className={`text-xs mt-0.5 ${endDatePassed ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"}`}>
                {settlementStatus === "draft" ? "Settlement calculated — finalize and disburse payouts" : "Calculate settlement to distribute funds to members"}
              </p>
            </div>
            <ArrowRight className={`h-4 w-4 shrink-0 ${endDatePassed ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"}`} />
          </div>
        </Link>
      )}

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
                    <Badge variant={currentCycle.status === "open" ? "info" : "default"} className="text-[10px]">
                      {currentCycle.status}
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
                {formatCurrency(currentCycle.totalPaid)}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                of {formatCurrency(currentCycle.totalExpected)} collected
              </p>
            </div>

            <div className="w-full h-2.5 bg-[var(--border-light)] rounded-full overflow-hidden mb-5">
              <div
                className="h-full bg-teal rounded-full transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5">
              <StatChip
                icon={CheckCircle2}
                label="Paid"
                value={currentCycle.paidCount}
                colorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              />
              <StatChip
                icon={Clock}
                label="Partial"
                value={currentCycle.partialCount}
                colorClass="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              />
              <StatChip
                icon={Circle}
                label="Unpaid"
                value={currentCycle.unpaidCount}
                colorClass="bg-[var(--border-light)] text-[var(--text-muted)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-4 border-t border-[var(--border-light)] text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {circleMeta.memberCount} member{circleMeta.memberCount !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5" />
                {formatCurrency(circleMeta.amount)} / {circleMeta.frequency.replace(/_/g, " ")}
              </span>
              <span className="flex items-center gap-1.5">
                <PiggyBank className="h-3.5 w-3.5" />
                {formatCurrency(totalCollected)} collected all-time
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
                  Start a cycle to begin tracking contributions.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-4 border-t border-[var(--border-light)] text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {circleMeta.memberCount} member{circleMeta.memberCount !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5" />
                {formatCurrency(circleMeta.amount)} / {circleMeta.frequency.replace(/_/g, " ")}
              </span>
              <span className="flex items-center gap-1.5">
                <PiggyBank className="h-3.5 w-3.5" />
                {formatCurrency(totalCollected)} collected all-time
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <FundHealthCard
        totalCollected={totalCollected}
        totalDisbursed={totalDisbursed}
        totalRepaid={totalRepaid}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <FundsMetricCard
          icon={HandCoins}
          label="Lending Pool Available"
          value={formatCurrency(lendingPoolAvailable)}
          iconClass="bg-teal-50 dark:bg-teal-900/20 text-teal"
        />
        <FundsMetricCard
          icon={Landmark}
          label="Assets Value"
          value={formatCurrency(assetsValue)}
          iconClass="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <FundsMetricCard
          icon={Wallet}
          label="Outstanding Loans"
          value={formatCurrency(totalPrincipalOutstanding)}
          iconClass="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        />
        <FundsMetricCard
          icon={ListChecks}
          label="Active Loans"
          value={String(activeLoanCount)}
          iconClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Recent Cycles</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCycles.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="No cycles yet"
              description="Start a cycle to begin tracking contributions."
              action={{ label: "Go to Payments", href: `/circles/${circleId}/cycles` }}
            />
          ) : (
            <div className="space-y-2">
              {recentCycles.map((cycle) => {
                const cycleProgress = cycle.totalExpected > 0 ? Math.round((cycle.totalPaid / cycle.totalExpected) * 100) : 0
                const isComplete = cycleProgress >= 100

                return (
                  <Link
                    key={cycle.id}
                    href={`/circles/${cycle.circleId}/cycles/${cycle.id}`}
                    className="block"
                  >
                    <div className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border-light)] hover:border-[var(--border-color)] hover:bg-[var(--border-light)] transition-colors">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          isComplete
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-[var(--border-light)] text-[var(--text-muted)]"
                        }`}
                      >
                        {isComplete ? <CheckCircle2 className="h-4.5 w-4.5" /> : <Clock className="h-4.5 w-4.5" />}
                      </div>
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                            {cycle.label}
                          </p>
                          <span className="text-xs font-semibold font-tabular text-[var(--text-muted)] shrink-0">
                            {cycleProgress}%
                          </span>
                        </div>
                        <div className="flex gap-2 text-[11px]">
                          <span className="text-emerald-600 font-medium">{cycle.paidCount} paid</span>
                          <span className="text-amber-600 font-medium">{cycle.partialCount} partial</span>
                          <span className="text-[var(--text-muted)]">{cycle.unpaidCount} unpaid</span>
                        </div>
                        <div className="w-full h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal rounded-full transition-all"
                            style={{ width: `${Math.min(cycleProgress, 100)}%` }}
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
