import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"

export default function FundHealthCard({
  totalCollected,
  outstandingPrincipal,
  interestEarned,
}: {
  totalCollected: number
  outstandingPrincipal: number
  interestEarned: number
}) {
  // Cash + receivable principal: contributions and interest income stay in the
  // fund; only the principal still out on active loans is yet to be collected.
  const currentValue = totalCollected + interestEarned - outstandingPrincipal

  return (
    <Card className="mb-8 overflow-hidden">
      <CardContent className="p-0">
        {/* Hero: the number that matters */}
        <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">
            Current Fund Value
          </p>
          <p className={`text-5xl font-bold font-tabular leading-none ${currentValue >= 0 ? "text-teal" : "text-red-600 dark:text-red-400"}`}>
            {formatCurrency(currentValue)}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2.5">
            Money the circle holds right now
          </p>
        </div>

        {/* Ledger breakdown */}
        <div className="border-t border-[var(--border-light)] divide-y divide-[var(--border-light)]">
          <div className="flex items-center justify-between px-5 py-2.5 sm:px-6">
            <span className="text-sm text-[var(--text-secondary)]">Contributions collected</span>
            <span className="text-sm font-tabular font-semibold text-emerald-600 dark:text-emerald-400">
              + {formatCurrency(totalCollected)}
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-2.5 sm:px-6">
            <span className="text-sm text-[var(--text-secondary)]">Interest earned on loans</span>
            <span className="text-sm font-tabular font-semibold text-blue-600 dark:text-blue-400">
              + {formatCurrency(interestEarned)}
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-2.5 sm:px-6">
            <span className="text-sm text-[var(--text-secondary)]">Outstanding loan principal</span>
            <span className="text-sm font-tabular font-semibold text-red-500 dark:text-red-400">
              − {formatCurrency(outstandingPrincipal)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
