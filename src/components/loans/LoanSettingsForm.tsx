"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HandCoins, PiggyBank } from "lucide-react"
import { cn } from "@/lib/utils"
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
  // Lending is optional; it's on when any of the pool is lendable.
  const [lendingEnabled, setLendingEnabled] = useState(initialSettings.loanAllocationPct > 0)
  const [loanPct, setLoanPct] = useState(initialSettings.loanAllocationPct > 0 ? initialSettings.loanAllocationPct : 100)
  const [loanInterestRatePct, setLoanInterestRatePct] = useState(
    initialSettings.loanInterestRatePct > 0 ? String(initialSettings.loanInterestRatePct) : ""
  )
  const [maxLoanPctOfContribution, setMaxLoanPctOfContribution] = useState(String(initialSettings.maxLoanPctOfContribution || 90))
  const [maxLoanPctOfLendingPool, setMaxLoanPctOfLendingPool] = useState(String(initialSettings.maxLoanPctOfLendingPool || 10))
  const [loanLateFee, setLoanLateFee] = useState(String(initialSettings.loanLateFee))
  const [loanGraceDays, setLoanGraceDays] = useState(String(initialSettings.loanGraceDays))
  // Contribution late fee is a contribution rule — independent of lending.
  const [contributionLateFee, setContributionLateFee] = useState(String(initialSettings.contributionLateFee))
  const [contributionGraceDays, setContributionGraceDays] = useState(String(initialSettings.contributionGraceDays))
  const [loading, setLoading] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState("")

  const assetPct = 100 - loanPct
  const interestNum = Number(loanInterestRatePct)
  const interestError =
    attempted && lendingEnabled && !(interestNum > 0) ? "Loans must charge interest — enter a rate above 0%" : ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lendingEnabled && !(interestNum > 0)) {
      setAttempted(true)
      return
    }
    setLoading(true)
    setError("")

    const settings: LoanSettings = lendingEnabled
      ? {
          assetAllocationPct: assetPct,
          loanAllocationPct: loanPct,
          loanInterestRatePct: interestNum || 0,
          maxLoanPctOfContribution: Number(maxLoanPctOfContribution) || 0,
          maxLoanPctOfLendingPool: Number(maxLoanPctOfLendingPool) || 0,
          contributionLateFee: Number(contributionLateFee) || 0,
          contributionGraceDays: Number(contributionGraceDays) || 0,
          loanLateFee: Number(loanLateFee) || 0,
          loanGraceDays: Number(loanGraceDays) || 0,
        }
      : {
          assetAllocationPct: 100,
          loanAllocationPct: 0,
          loanInterestRatePct: 0,
          maxLoanPctOfContribution: 0,
          maxLoanPctOfLendingPool: 0,
          contributionLateFee: Number(contributionLateFee) || 0,
          contributionGraceDays: Number(contributionGraceDays) || 0,
          loanLateFee: 0,
          loanGraceDays: 0,
        }

    const result = await updateLoanSettings(circleId, settings, actorUserId)
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    toast.success("Settings updated")
    router.refresh()
  }

  const choiceCard = (selected: boolean) =>
    cn(
      "rounded-xl border p-3 text-left transition-colors flex flex-col gap-1",
      selected
        ? "border-teal bg-teal-50 dark:bg-teal-900/20 ring-1 ring-teal/30"
        : "border-[var(--border-light)] hover:border-[var(--border-color)]"
    )

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* Contribution late fee — applies whether or not the circle lends */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Late fee on contributions</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">
          A flat fee charged when a member pays a contribution after its due date. Leave at ₹0 for none.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="contribution-late-fee" className="text-xs">Late fee <span className="text-[var(--text-muted)] font-normal">₹</span></Label>
            <Input id="contribution-late-fee" type="number" min="0" step="1" value={contributionLateFee}
              onChange={(e) => setContributionLateFee(e.target.value)} disabled={loading} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contribution-grace-days" className="text-xs">Grace period <span className="text-[var(--text-muted)] font-normal">days</span></Label>
            <Input id="contribution-grace-days" type="number" min="0" step="1" value={contributionGraceDays}
              onChange={(e) => setContributionGraceDays(e.target.value)} disabled={loading} className="h-9 text-sm" />
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border-light)]" />

      {/* Lending */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Member lending</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">
          Does this circle lend part of its collected funds to members?
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setLendingEnabled(false)} className={choiceCard(!lendingEnabled)}>
            <PiggyBank className={cn("h-5 w-5", !lendingEnabled ? "text-teal" : "text-[var(--text-muted)]")} />
            <span className="text-sm font-medium text-[var(--text-primary)]">Savings only</span>
            <span className="text-[11px] text-[var(--text-muted)]">No lending — contributions stay in the fund</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLendingEnabled(true)
              if (loanPct === 0) setLoanPct(100)
            }}
            className={choiceCard(lendingEnabled)}
          >
            <HandCoins className={cn("h-5 w-5", lendingEnabled ? "text-teal" : "text-[var(--text-muted)]")} />
            <span className="text-sm font-medium text-[var(--text-primary)]">Members can borrow</span>
            <span className="text-[11px] text-[var(--text-muted)]">Lend part of the pool at interest</span>
          </button>
        </div>

        {lendingEnabled ? (
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="loan-interest-rate" className="text-xs">
                Interest rate <span className="text-[var(--text-muted)] font-normal ml-1">% per year</span>
              </Label>
              <Input id="loan-interest-rate" type="number" min="0" step="0.1" value={loanInterestRatePct}
                onChange={(e) => setLoanInterestRatePct(e.target.value)} placeholder="e.g. 12" disabled={loading} className="h-9 text-sm" />
              {interestError ? (
                <p className="text-sm text-red-600">{interestError}</p>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">Loans must charge interest — enter a rate above 0%.</p>
              )}
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm text-[var(--text-secondary)]">Available to lend</span>
                <span className="text-sm font-tabular font-semibold text-teal">{loanPct}%</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={loanPct}
                onChange={(e) => setLoanPct(Number(e.target.value))} disabled={loading}
                className="w-full accent-teal cursor-pointer" aria-label="Percent of contributions available to lend" />
              <p className="text-xs text-[var(--text-muted)] mt-1.5">
                {loanPct}% of contributions can be lent to members · the remaining {assetPct}% is held as other assets
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="max-loan-contribution" className="text-xs">Max loan (% of contribution)</Label>
                <Input id="max-loan-contribution" type="number" min="0" max="100" step="1" value={maxLoanPctOfContribution}
                  onChange={(e) => setMaxLoanPctOfContribution(e.target.value)} disabled={loading} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-loan-pool" className="text-xs">Max loan (% of lending pool)</Label>
                <Input id="max-loan-pool" type="number" min="0" max="100" step="1" value={maxLoanPctOfLendingPool}
                  onChange={(e) => setMaxLoanPctOfLendingPool(e.target.value)} disabled={loading} className="h-9 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="loan-late-fee" className="text-xs">Loan EMI late fee <span className="text-[var(--text-muted)] font-normal">₹</span></Label>
                <Input id="loan-late-fee" type="number" min="0" step="1" value={loanLateFee}
                  onChange={(e) => setLoanLateFee(e.target.value)} disabled={loading} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loan-grace-days" className="text-xs">Loan grace period <span className="text-[var(--text-muted)] font-normal">days</span></Label>
                <Input id="loan-grace-days" type="number" min="0" step="1" value={loanGraceDays}
                  onChange={(e) => setLoanGraceDays(e.target.value)} disabled={loading} className="h-9 text-sm" />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)] mt-3">
            Lending is off — loan settings are not applied. Turn it on to set an interest rate and limits.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading} aria-disabled={lendingEnabled && !(interestNum > 0)}>
        {loading ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  )
}
