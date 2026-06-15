"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateLoanSettings } from "@/lib/actions"
import type { LoanSettings } from "@/lib/types"

export default function LoanSettingsForm({
  circleId,
  actorUserId,
  initialSettings,
}: {
  circleId: string
  actorUserId: string
  initialSettings: LoanSettings
}) {
  const router = useRouter()
  const [assetAllocationPct, setAssetAllocationPct] = useState(String(initialSettings.assetAllocationPct))
  const [loanAllocationPct, setLoanAllocationPct] = useState(String(initialSettings.loanAllocationPct))
  const [loanInterestRatePct, setLoanInterestRatePct] = useState(String(initialSettings.loanInterestRatePct))
  const [maxLoanPctOfContribution, setMaxLoanPctOfContribution] = useState(String(initialSettings.maxLoanPctOfContribution))
  const [maxLoanPctOfLendingPool, setMaxLoanPctOfLendingPool] = useState(String(initialSettings.maxLoanPctOfLendingPool))
  const [contributionLateFee, setContributionLateFee] = useState(String(initialSettings.contributionLateFee))
  const [contributionGraceDays, setContributionGraceDays] = useState(String(initialSettings.contributionGraceDays))
  const [loanLateFee, setLoanLateFee] = useState(String(initialSettings.loanLateFee))
  const [loanGraceDays, setLoanGraceDays] = useState(String(initialSettings.loanGraceDays))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const allocationSum = (Number(assetAllocationPct) || 0) + (Number(loanAllocationPct) || 0)
  const allocationError = allocationSum !== 100 ? `Asset + loan allocation must add up to 100% (currently ${allocationSum}%)` : ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (allocationError) {
      setError(allocationError)
      return
    }
    setLoading(true)
    setError("")

    const result = await updateLoanSettings(
      circleId,
      {
        assetAllocationPct: Number(assetAllocationPct),
        loanAllocationPct: Number(loanAllocationPct),
        loanInterestRatePct: Number(loanInterestRatePct),
        maxLoanPctOfContribution: Number(maxLoanPctOfContribution),
        maxLoanPctOfLendingPool: Number(maxLoanPctOfLendingPool),
        contributionLateFee: Number(contributionLateFee),
        contributionGraceDays: Number(contributionGraceDays),
        loanLateFee: Number(loanLateFee),
        loanGraceDays: Number(loanGraceDays),
      },
      actorUserId
    )

    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    toast.success("Loan settings updated")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="asset-allocation">Asset Allocation (%)</Label>
          <Input
            id="asset-allocation"
            type="number"
            min="0"
            max="100"
            step="1"
            value={assetAllocationPct}
            onChange={(e) => setAssetAllocationPct(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loan-allocation">Loan Allocation (%)</Label>
          <Input
            id="loan-allocation"
            type="number"
            min="0"
            max="100"
            step="1"
            value={loanAllocationPct}
            onChange={(e) => setLoanAllocationPct(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>
      {allocationError && <p className="text-sm text-red-600">{allocationError}</p>}

      <div className="space-y-2">
        <Label htmlFor="loan-interest-rate">Loan Interest Rate (% p.a.)</Label>
        <Input
          id="loan-interest-rate"
          type="number"
          min="0"
          step="0.1"
          value={loanInterestRatePct}
          onChange={(e) => setLoanInterestRatePct(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="max-loan-contribution">Max Loan (% of contribution)</Label>
          <Input
            id="max-loan-contribution"
            type="number"
            min="0"
            step="1"
            value={maxLoanPctOfContribution}
            onChange={(e) => setMaxLoanPctOfContribution(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-loan-pool">Max Loan (% of lending pool)</Label>
          <Input
            id="max-loan-pool"
            type="number"
            min="0"
            step="1"
            value={maxLoanPctOfLendingPool}
            onChange={(e) => setMaxLoanPctOfLendingPool(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="contribution-late-fee">Contribution Late Fee (₹)</Label>
          <Input
            id="contribution-late-fee"
            type="number"
            min="0"
            step="1"
            value={contributionLateFee}
            onChange={(e) => setContributionLateFee(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contribution-grace-days">Contribution Grace (days)</Label>
          <Input
            id="contribution-grace-days"
            type="number"
            min="0"
            step="1"
            value={contributionGraceDays}
            onChange={(e) => setContributionGraceDays(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="loan-late-fee">Loan Late Fee (₹)</Label>
          <Input
            id="loan-late-fee"
            type="number"
            min="0"
            step="1"
            value={loanLateFee}
            onChange={(e) => setLoanLateFee(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loan-grace-days">Loan Grace (days)</Label>
          <Input
            id="loan-grace-days"
            type="number"
            min="0"
            step="1"
            value={loanGraceDays}
            onChange={(e) => setLoanGraceDays(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading || !!allocationError}>
        {loading ? "Saving..." : "Save Loan Settings"}
      </Button>
    </form>
  )
}
