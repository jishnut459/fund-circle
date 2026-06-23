import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import { Banknote, Users, Repeat, CheckCircle2, Clock, Circle, TrendingUp, HandCoins, Landmark, Wallet, CalendarClock, ArrowRight, type LucideIcon } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import Link from "next/link"
import { formatCurrency, formatISODate } from "@/lib/format"
import FundHealthCard from "./FundHealthCard"

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
  lendingPoolAvailable: number
  assetsValue: number
  myOutstandingLoan: number
  myLoanEligibility: number
  totalPrincipalOutstanding: number
  interestEarned: number
  totalContributionsCollected: number
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
      <div className="flex items-start gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-medium text-[var(--text-muted)] leading-tight pt-0.5">{label}</p>
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
  const { currentCycle, totalPaid, cycles, circleMeta, lendingPoolAvailable, assetsValue, myOutstandingLoan, myLoanEligibility, totalPrincipalOutstanding, interestEarned, totalContributionsCollected, endDate, settlementStatus, showSettlementBanner, endDatePassed, circleId } = data
  const progress = currentCycle && currentCycle.expectedAmount > 0
    ? Math.round((currentCycle.paidAmount / currentCycle.expectedAmount) * 100)
    : 0

  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight pb-4">
        My Dashboard
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
                {settlementStatus ? "Settlement is being prepared — check your payout" : "Your share will be calculated when the circle settles"}
              </p>
            </div>
            <ArrowRight className={`h-4 w-4 shrink-0 ${endDatePassed ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"}`} />
          </div>
        </Link>
      )}

      <FundHealthCard
        totalCollected={totalContributionsCollected}
        outstandingPrincipal={totalPrincipalOutstanding}
        interestEarned={interestEarned}
      />

      {currentCycle ? (
        <Card className="mb-8 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
              <div>
                <h3 className="font-bold text-base text-[var(--text-primary)] leading-tight">{currentCycle.label}</h3>
                {currentCycle.dueDate && (
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Due {formatISODate(currentCycle.dueDate)}</p>
                )}
              </div>
              <Badge variant={STATUS_BADGE[currentCycle.status] ?? "default"} className="text-[10px] shrink-0 mt-0.5">
                {currentCycle.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="px-5 pb-4 sm:px-6">
              <div className="flex items-end justify-between gap-2 mb-1">
                <p className="text-5xl font-bold font-tabular text-[var(--text-primary)] leading-none">
                  {formatCurrency(currentCycle.paidAmount)}
                </p>
                <p className="text-xl font-bold font-tabular text-teal mb-0.5">{progress}%</p>
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-2 mb-4">
                of {formatCurrency(currentCycle.expectedAmount)} expected
              </p>
              <div className="w-full h-2 bg-[var(--border-light)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${STATUS_BAR_COLOR[currentCycle.status] ?? STATUS_BAR_COLOR.unpaid}`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
            <div className="border-t border-[var(--border-light)] px-5 py-3 sm:px-6 flex items-center gap-4 flex-wrap text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {circleMeta.memberCount} member{circleMeta.memberCount !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5" />
                {formatCurrency(circleMeta.amount)} / {circleMeta.frequency.replace(/_/g, " ")}
              </span>
              {totalPaid > 0 && (
                <span className="ml-auto font-medium text-[var(--text-secondary)]">
                  {formatCurrency(totalPaid)} paid all-time
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-8">
          <CardContent className="p-5 sm:p-6">
            <EmptyState icon={Banknote} title="No active cycle" description="Your contributions will show up here once a cycle starts." />
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
          label="My Outstanding Loan"
          value={formatCurrency(myOutstandingLoan)}
          iconClass="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          href={`/circles/${circleId}/loans`}
        />
        <FundsMetricCard
          icon={TrendingUp}
          label="My Loan Eligibility"
          value={formatCurrency(myLoanEligibility)}
          iconClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          href={`/circles/${circleId}/loans`}
        />
      </div>

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
