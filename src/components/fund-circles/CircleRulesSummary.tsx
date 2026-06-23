import { HandCoins, PiggyBank } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import type { LoanSettings } from "@/lib/types"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border-light)] last:border-0">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className="text-sm font-medium font-tabular text-[var(--text-primary)] text-right">{value}</span>
    </div>
  )
}

function days(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`
}

/**
 * Read-only counterpart to LoanSettingsForm — shows the circle's contribution and
 * lending rules to members for transparency, without any edit affordances.
 */
export default function CircleRulesSummary({ settings }: { settings: LoanSettings }) {
  const lendingEnabled = settings.loanAllocationPct > 0

  return (
    <div className="space-y-7">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Late fee on contributions</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1 mb-2">
          A flat fee charged when a member pays a contribution after its due date.
        </p>
        <div>
          <Row
            label="Late fee"
            value={settings.contributionLateFee > 0 ? formatCurrency(settings.contributionLateFee) : "None"}
          />
          <Row label="Grace period" value={days(settings.contributionGraceDays)} />
        </div>
      </div>

      <div className="border-t border-[var(--border-light)]" />

      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Member lending</h3>
        <div className="mt-2 flex items-center gap-2">
          {lendingEnabled ? (
            <HandCoins className="h-4 w-4 text-teal shrink-0" />
          ) : (
            <PiggyBank className="h-4 w-4 text-teal shrink-0" />
          )}
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {lendingEnabled ? "Members can borrow from the pool" : "Savings only — the circle does not lend"}
          </span>
        </div>

        {lendingEnabled && (
          <div className="mt-3">
            <Row label="Interest rate" value={`${settings.loanInterestRatePct}% per year`} />
            <Row label="Available to lend" value={`${settings.loanAllocationPct}% of contributions`} />
            <Row label="Held as other assets" value={`${settings.assetAllocationPct}%`} />
            <Row label="Max loan (% of contribution)" value={`${settings.maxLoanPctOfContribution}%`} />
            <Row label="Max loan (% of lending pool)" value={`${settings.maxLoanPctOfLendingPool}%`} />
            <Row
              label="Loan EMI late fee"
              value={settings.loanLateFee > 0 ? formatCurrency(settings.loanLateFee) : "None"}
            />
            <Row label="Loan grace period" value={days(settings.loanGraceDays)} />
          </div>
        )}
      </div>
    </div>
  )
}
