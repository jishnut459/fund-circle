import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getLoanEligibility } from "@/lib/actions"
import { formatCurrency } from "@/lib/format"
import { Wallet } from "lucide-react"

interface EligibilityWidgetProps {
  circleId: string
  userId: string
}

export default async function EligibilityWidget({ circleId, userId }: EligibilityWidgetProps) {
  const result = await getLoanEligibility(circleId, userId)

  if (!result.success) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-[var(--text-muted)]">{result.error}</CardContent>
      </Card>
    )
  }

  const { eligibleAmount, maxByContribution, maxByPool, lendingPoolAvailable, totalContributionsPaid } = result.data

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-teal" />
          Loan Eligibility
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-[var(--text-muted)]">You&apos;re eligible to borrow up to</p>
          <p className="text-3xl font-bold font-tabular text-[var(--text-primary)]">
            {formatCurrency(eligibleAmount)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl bg-[var(--border-light)] p-4 text-center">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Based on your contributions</p>
            <p className="text-lg font-semibold font-tabular text-[var(--text-primary)]">
              {formatCurrency(maxByContribution)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Based on lending pool</p>
            <p className="text-lg font-semibold font-tabular text-[var(--text-primary)]">
              {formatCurrency(maxByPool)}
            </p>
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-[var(--text-muted)]">
          <div className="flex items-center justify-between">
            <span>Your total contributions</span>
            <span className="font-tabular text-[var(--text-primary)]">{formatCurrency(totalContributionsPaid)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Lending pool available</span>
            <span className="font-tabular text-[var(--text-primary)]">{formatCurrency(lendingPoolAvailable)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
