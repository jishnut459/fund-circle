import { TrendingUp, TrendingDown, RefreshCw, Shield } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"

function Row({
  label,
  amount,
  sign,
  colorClass,
  Icon,
}: {
  label: string
  amount: number
  sign: "+" | "−"
  colorClass: string
  Icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="flex-1 text-sm text-[var(--text-secondary)]">{label}</p>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`text-xs font-semibold ${sign === "+" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
          {sign}
        </span>
        <span className="text-sm font-bold font-tabular text-[var(--text-primary)]">
          {formatCurrency(amount)}
        </span>
      </div>
    </div>
  )
}

export default function FundHealthCard({
  totalCollected,
  totalDisbursed,
  totalRepaid,
}: {
  totalCollected: number
  totalDisbursed: number
  totalRepaid: number
}) {
  const currentValue = totalCollected - totalDisbursed + totalRepaid

  return (
    <Card className="mb-8">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-teal" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Fund Overview</h3>
            <p className="text-[11px] text-[var(--text-muted)]">Every rupee accounted for</p>
          </div>
        </div>

        <div className="divide-y divide-[var(--border-light)]">
          <Row
            label="Total contributions collected"
            amount={totalCollected}
            sign="+"
            colorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            Icon={TrendingUp}
          />
          <Row
            label="Disbursed as loans"
            amount={totalDisbursed}
            sign="−"
            colorClass="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            Icon={TrendingDown}
          />
          <Row
            label="Loan repayments received"
            amount={totalRepaid}
            sign="+"
            colorClass="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            Icon={RefreshCw}
          />
        </div>

        <div className="mt-4 pt-4 border-t-2 border-[var(--border-color)] flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Current fund value</p>
          <p className={`text-2xl font-bold font-tabular ${currentValue >= 0 ? "text-teal" : "text-red-600 dark:text-red-400"}`}>
            {formatCurrency(currentValue)}
          </p>
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
          = contributions − loans disbursed + repayments
        </p>
      </CardContent>
    </Card>
  )
}
