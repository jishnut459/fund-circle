import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Banknote, CheckCircle2, Clock, HandCoins, Landmark, ListChecks, CalendarClock, ArrowRight, type LucideIcon } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import Link from "next/link"
import { formatCurrency, formatISODate } from "@/lib/format"
import FundHealthCard from "./FundHealthCard"

interface DashboardData {
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
  interestEarned: number
  endDate: string | null
  settlementStatus: string | null
  showSettlementBanner: boolean
  endDatePassed: boolean
}

function FundsMetricCard({
  icon: Icon,
  label,
  value,
  hint,
  iconClass,
  href,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  iconClass: string
  href?: string
}) {
  const inner = (
    <CardContent className="p-4 h-full">
      <div className="flex items-start gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-medium text-[var(--text-muted)] leading-tight pt-0.5">{label}</p>
      </div>
      <p className="text-xl font-bold font-tabular text-[var(--text-primary)]">{value}</p>
      {hint && <p className="text-[11px] text-[var(--text-muted)] font-tabular mt-0.5">{hint}</p>}
    </CardContent>
  )
  if (href) {
    return (
      <Link href={href} className="block group h-full">
        <Card className="h-full transition-shadow group-hover:shadow-[var(--shadow-card-hover)] group-hover:border-[var(--border-color)]">
          {inner}
        </Card>
      </Link>
    )
  }
  return <Card className="h-full">{inner}</Card>
}


export default function OwnerDashboard({ data }: { data: DashboardData }) {
  const { totalCollected, recentCycles, circleId, lendingPoolAvailable, assetsValue, totalPrincipalOutstanding, activeLoanCount, interestEarned, endDate, settlementStatus, showSettlementBanner, endDatePassed } = data

  // The newest cycle is the one members are paying into now; older ones are history.
  const currentCycle = recentCycles[0] ?? null
  const pastCycles = recentCycles.slice(1)
  const currentProgress = currentCycle && currentCycle.totalExpected > 0
    ? Math.round((currentCycle.totalPaid / currentCycle.totalExpected) * 100)
    : 0
  const stillToPay = currentCycle ? currentCycle.partialCount + currentCycle.unpaidCount : 0
  const currentRemaining = currentCycle ? Math.max(0, currentCycle.totalExpected - currentCycle.totalPaid) : 0

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
        outstandingPrincipal={totalPrincipalOutstanding}
        interestEarned={interestEarned}
      />

      {/* The most actionable thing on the screen: this cycle's collection + a way to act on it */}
      {currentCycle && (
        <Card className="mb-6 border-teal/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-teal">Current Cycle</p>
              <span className="text-xs font-semibold font-tabular text-[var(--text-muted)] shrink-0">{currentProgress}%</span>
            </div>
            <p className="font-semibold text-sm text-[var(--text-primary)] truncate">{currentCycle.label}</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-bold font-tabular text-[var(--text-primary)]">{formatCurrency(currentCycle.totalPaid)}</span>
              <span className="text-sm text-[var(--text-muted)]">of {formatCurrency(currentCycle.totalExpected)} collected</span>
            </div>
            <div className="w-full h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden mt-2.5">
              <div className="h-full bg-teal rounded-full transition-all" style={{ width: `${Math.min(currentProgress, 100)}%` }} />
            </div>
            <div className="flex items-center justify-between gap-3 mt-4">
              <p className="text-xs text-[var(--text-secondary)] min-w-0">
                {stillToPay > 0
                  ? <><span className="font-semibold text-[var(--text-primary)]">{formatCurrency(currentRemaining)}</span> from {stillToPay} member{stillToPay > 1 ? "s" : ""} still to collect</>
                  : "Fully collected for this cycle 🎉"}
              </p>
              <Link
                href={`/circles/${circleId}/cycles/${currentCycle.id}`}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-teal px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-dark transition-colors"
              >
                Record payments
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <FundsMetricCard
          icon={HandCoins}
          label="Lending Pool"
          value={formatCurrency(lendingPoolAvailable)}
          hint="available to lend"
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
        {activeLoanCount > 0 ? (
          <FundsMetricCard
            icon={ListChecks}
            label="Active Loans"
            value={String(activeLoanCount)}
            hint={`${formatCurrency(totalPrincipalOutstanding)} outstanding`}
            iconClass="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            href={`/circles/${circleId}/loans`}
          />
        ) : (
          <Link href={`/circles/${circleId}/loans`} className="block group col-span-2">
            <Card className="h-full transition-shadow group-hover:shadow-[var(--shadow-card-hover)] group-hover:border-[var(--border-color)]">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[var(--border-light)] text-[var(--text-muted)]">
                  <ListChecks className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">No active loans</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Members can request a loan from the lending pool</p>
                </div>
                <ArrowRight className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      {recentCycles.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Banknote}
              title="No cycles yet"
              description="Start a cycle to begin tracking contributions."
              action={{ label: "Go to Payments", href: `/circles/${circleId}/cycles` }}
            />
          </CardContent>
        </Card>
      ) : pastCycles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Previous Cycles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pastCycles.map((cycle) => {
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
                          {cycle.paidCount > 0 && <span className="text-emerald-600 font-medium">{cycle.paidCount} paid</span>}
                          {cycle.partialCount > 0 && <span className="text-amber-600 font-medium">{cycle.partialCount} partial</span>}
                          {cycle.unpaidCount > 0 && <span className="text-[var(--text-muted)]">{cycle.unpaidCount} unpaid</span>}
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
