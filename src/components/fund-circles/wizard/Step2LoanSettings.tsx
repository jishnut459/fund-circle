"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HandCoins, PiggyBank } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LoanSettings } from "@/lib/types"

interface Step2LoanSettingsProps {
  initialData: LoanSettings
  onNext: (data: LoanSettings) => void
  onBack: () => void
}

function field(
  id: string,
  label: string,
  value: string,
  onChange: (v: string) => void,
  opts?: { min?: string; max?: string; step?: string; suffix?: string }
) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
        {opts?.suffix && <span className="text-[var(--text-muted)] font-normal ml-1">{opts.suffix}</span>}
      </Label>
      <Input
        id={id}
        type="number"
        min={opts?.min ?? "0"}
        max={opts?.max}
        step={opts?.step ?? "1"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 text-sm"
      />
    </div>
  )
}

export default function Step2LoanSettings({ initialData, onNext, onBack }: Step2LoanSettingsProps) {
  // Lending is optional and inferred from whether any of the pool is lendable.
  const [lendingEnabled, setLendingEnabled] = useState(initialData.loanAllocationPct > 0)
  const [loanPct, setLoanPct] = useState(initialData.loanAllocationPct > 0 ? initialData.loanAllocationPct : 100)
  const [interestRate, setInterestRate] = useState(
    initialData.loanInterestRatePct > 0 ? String(initialData.loanInterestRatePct) : ""
  )
  const [maxLoanContrib, setMaxLoanContrib] = useState(String(initialData.maxLoanPctOfContribution || 90))
  const [maxLoanPool, setMaxLoanPool] = useState(String(initialData.maxLoanPctOfLendingPool || 10))
  // Late fee is a contribution rule — independent of lending.
  const [contribLateFee, setContribLateFee] = useState(String(initialData.contributionLateFee))
  const [contribGraceDays, setContribGraceDays] = useState(String(initialData.contributionGraceDays))
  const [attempted, setAttempted] = useState(false)

  const assetPct = 100 - loanPct
  const interestNum = Number(interestRate)
  const interestError =
    attempted && lendingEnabled && !(interestNum > 0)
      ? "Loans must charge interest — enter a rate above 0%"
      : ""

  const canProceed = !lendingEnabled || interestNum > 0

  const buildData = (): LoanSettings => ({
    assetAllocationPct: lendingEnabled ? assetPct : 100,
    loanAllocationPct: lendingEnabled ? loanPct : 0,
    loanInterestRatePct: lendingEnabled ? interestNum || 0 : 0,
    maxLoanPctOfContribution: lendingEnabled ? Number(maxLoanContrib) || 0 : 0,
    maxLoanPctOfLendingPool: lendingEnabled ? Number(maxLoanPool) || 0 : 0,
    contributionLateFee: Number(contribLateFee) || 0,
    contributionGraceDays: Number(contribGraceDays) || 0,
    loanLateFee: 0,
    loanGraceDays: 0,
  })

  const handleNext = () => {
    if (!canProceed) {
      setAttempted(true)
      return
    }
    onNext(buildData())
  }

  const choiceCard = (selected: boolean) =>
    cn(
      "rounded-xl border p-3 text-left transition-colors flex flex-col gap-1",
      selected
        ? "border-teal bg-teal-50 dark:bg-teal-900/20 ring-1 ring-teal/30"
        : "border-[var(--border-light)] hover:border-[var(--border-color)]"
    )

  return (
    <div className="space-y-7">
      {/* Contribution late fee — applies to everyone, lending or not */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Late fee on contributions</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">
          Charge a flat fee when a member pays a contribution after its due date. This is about contributions —
          not loans. Leave the fee at ₹0 if you don&apos;t want one.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {field("s2-contrib-fee", "Late fee", contribLateFee, setContribLateFee, { suffix: "₹" })}
          {field("s2-contrib-grace", "Grace period", contribGraceDays, setContribGraceDays, { suffix: "days" })}
        </div>
      </div>

      <div className="border-t border-[var(--border-light)]" />

      {/* Lending — optional */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Member lending</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1 mb-3">
          Will this circle lend part of its collected funds to members?
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
              <Label htmlFor="s2-interest" className="text-xs">
                Interest rate <span className="text-[var(--text-muted)] font-normal ml-1">% per year</span>
              </Label>
              <Input
                id="s2-interest"
                type="number"
                min="0"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="e.g. 12"
                className="h-9 text-sm"
              />
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
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={loanPct}
                onChange={(e) => setLoanPct(Number(e.target.value))}
                className="w-full accent-teal cursor-pointer"
                aria-label="Percent of contributions available to lend"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1.5">
                {loanPct}% of contributions can be lent to members · the remaining {assetPct}% is held as other assets
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {field("s2-max-contrib", "Max loan (% of contribution)", maxLoanContrib, setMaxLoanContrib, { max: "100", suffix: "%" })}
              {field("s2-max-pool", "Max loan (% of lending pool)", maxLoanPool, setMaxLoanPool, { max: "100", suffix: "%" })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)] mt-3">
            Loan settings are skipped. You can enable lending later in circle settings.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext} aria-disabled={!canProceed}>
          Next: Add Members
        </Button>
      </div>
    </div>
  )
}
