import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Banknote, Users, Repeat, CheckCircle2, Clock, HandCoins, Landmark, Wallet, ListChecks, CalendarClock, ArrowRight, type LucideIcon } from "lucide-react"
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
  href,
}: {
  icon: LucideIcon
  label: string
  value: string
  iconClass: string
  href?: string
}) {
  const inner = (
    <CardContent className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-medium text-[var(--text-muted)] truncate">{label}</p>
      </div>
      <p className="text-xl font-bold font-tabular text-[var(--text-primary)]">{value}</p>
    </CardContent>
  )
  if (href) {
    return (
      <Link href={href} className="block group">
        <Card className="transition-shadow group-hover:shadow-[var(--shadow-card-hover)] group-hover:border-[var(--border-color)]">
          {inner}
        </Card>
      </Link>
    )
  }
  return <Card>{inner}</Card>
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

      <FundHealthCard
        totalCollected={totalCollected}
        totalDisbursed={totalDisbursed}
        totalRepaid={totalRepaid}
      />

      {currentCycle ? (
        <Card className="mb-8 overflow-hidden">
          <CardContent className="p-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
              <div>
                <h3 className="font-bold text-base text-[var(--text-primary)] leading-tight">
                  {currentCycle.label}
                </h3>
                {currentCycle.dueDate && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Due {formatISODate(currentCycle.dueDate)}
                  </p>
                )}
              </div>
              <Badge variant={currentCycle.status === "open" ? "info" : "default"} className="text-[10px] shrink-0 mt-0.5">
                {currentCycle.status}
              </Badge>
            </div>

            {/* Amount — the hero */}
            <div className="px-5 pb-4 sm:px-6">
              <div className="flex items-end justify-between gap-2 mb-1">
                <p className="text-5xl font-bold font-tabular text-[var(--text-primary)] leading-none">
                  {formatCurrency(currentCycle.totalPaid)}
                </p>
                <p className="text-xl font-bold font-tabular text-teal mb-0.5">
                  {progress}%
                </p>
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-2 mb-4">
                of {formatCurrency(currentCycle.totalExpected)} expected this cycle
              </p>
              <div className="w-full h-2 bg-[var(--border-light)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal rounded-full transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>

            {/* Compact member status row */}
            <div className="border-t border-[var(--border-light)] px-5 py-3 sm:px-6 flex items-center gap-5 flex-wrap">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-sm font-bold font-tabular text-[var(--text-primary)]">{currentCycle.paidCount}</span>
                <span className="text-xs text-[var(--text-muted)]">paid</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-sm font-bold font-tabular text-[var(--text-primary)]">{currentCycle.partialCount}</span>
                <span className="text-xs text-[var(--text-muted)]">partial</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                <span className="text-sm font-bold font-tabular text-[var(--text-primary)]">{currentCycle.unpaidCount}</span>
                <span className="text-xs text-[var(--text-muted)]">unpaid</span>
              </span>
              <span className="ml-auto flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <Users className="h-3.5 w-3.5" />
                {circleMeta.memberCount} member{circleMeta.memberCount !== 1 ? "s" : ""}
                <span className="mx-1">·</span>
                <Repeat className="h-3.5 w-3.5" />
                {formatCurrency(circleMeta.amount)} / {circleMeta.frequency.replace(/_/g, " ")}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-8">
          <CardContent className="p-5 sm:p-6">
            <EmptyState
              icon={Banknote}
              title="No active cycle"
              description="Start a cycle to begin tracking contributions from members."
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <FundsMetricCard
          icon={HandCoins}
          label="Lending Pool Available"
          value={formatCurrency(lendingPoolAvailable)}
          iconClass="bg-teal-50 dark:bg-teal-900/20 text-teal"
          href={`/circles/${circleId}/loans`}
        />
        <FundsMetricCard
          icon={Landmark}
          label="Assets Value"
          value={formatCurrency(assetsValue)}
          iconClass="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          href={`/circles/${circleId}/assets`}
        />
        <FundsMetricCard
          icon={Wallet}
          label="Outstanding Loans"
          value={formatCurrency(totalPrincipalOutstanding)}
          iconClass="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          href={`/circles/${circleId}/loans`}
        />
        <FundsMetricCard
          icon={ListChecks}
          label="Active Loans"
          value={String(activeLoanCount)}
          iconClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          href={`/circles/${circleId}/loans`}
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
