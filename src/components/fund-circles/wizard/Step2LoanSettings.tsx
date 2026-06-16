"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  const [assetPct, setAssetPct] = useState(String(initialData.assetAllocationPct))
  const [loanPct, setLoanPct] = useState(String(initialData.loanAllocationPct))
  const [interestRate, setInterestRate] = useState(String(initialData.loanInterestRatePct))
  const [maxLoanContrib, setMaxLoanContrib] = useState(String(initialData.maxLoanPctOfContribution))
  const [maxLoanPool, setMaxLoanPool] = useState(String(initialData.maxLoanPctOfLendingPool))
  const [contribLateFee, setContribLateFee] = useState(String(initialData.contributionLateFee))
  const [contribGraceDays, setContribGraceDays] = useState(String(initialData.contributionGraceDays))
  const [loanLateFee, setLoanLateFee] = useState(String(initialData.loanLateFee))
  const [loanGraceDays, setLoanGraceDays] = useState(String(initialData.loanGraceDays))

  const allocationSum = (Number(assetPct) || 0) + (Number(loanPct) || 0)
  const allocationError =
    allocationSum !== 100
      ? `Asset + loan allocation must add up to 100% (currently ${allocationSum}%)`
      : ""

  const buildData = (): LoanSettings => ({
    assetAllocationPct: Number(assetPct),
    loanAllocationPct: Number(loanPct),
    loanInterestRatePct: Number(interestRate),
    maxLoanPctOfContribution: Number(maxLoanContrib),
    maxLoanPctOfLendingPool: Number(maxLoanPool),
    contributionLateFee: Number(contribLateFee),
    contributionGraceDays: Number(contribGraceDays),
    loanLateFee: Number(loanLateFee),
    loanGraceDays: Number(loanGraceDays),
  })

  const handleSkip = () => onNext(initialData)

  const handleNext = () => {
    if (allocationError) return
    onNext(buildData())
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[var(--text-muted)]">
          Configure how collected funds are split between loans and other assets. You can change these later in circle settings.
        </p>
      </div>

      {/* Allocation */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Fund Allocation</h3>
        <div className="grid grid-cols-2 gap-3">
          {field("s2-asset-pct", "Asset Allocation", assetPct, setAssetPct, { max: "100", suffix: "%" })}
          {field("s2-loan-pct", "Loan Allocation", loanPct, setLoanPct, { max: "100", suffix: "%" })}
        </div>
        {allocationError ? (
          <p className="text-sm text-red-600 mt-2">{allocationError}</p>
        ) : (
          <p className="text-xs text-[var(--text-muted)] mt-2">Asset + loan must equal 100%</p>
        )}
      </div>

      {/* Loan parameters */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Loan Parameters</h3>
        <div className="space-y-3">
          {field("s2-interest", "Interest Rate", interestRate, setInterestRate, { step: "0.1", suffix: "% p.a." })}
          <div className="grid grid-cols-2 gap-3">
            {field("s2-max-contrib", "Max Loan (% of contribution)", maxLoanContrib, setMaxLoanContrib, { max: "100", suffix: "%" })}
            {field("s2-max-pool", "Max Loan (% of lending pool)", maxLoanPool, setMaxLoanPool, { max: "100", suffix: "%" })}
          </div>
        </div>
      </div>

      {/* Late fees */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Late Fees &amp; Grace Periods</h3>
        <div className="grid grid-cols-2 gap-3">
          {field("s2-contrib-fee", "Contribution Late Fee", contribLateFee, setContribLateFee, { suffix: "₹" })}
          {field("s2-contrib-grace", "Contribution Grace", contribGraceDays, setContribGraceDays, { suffix: "days" })}
          {field("s2-loan-fee", "Loan Late Fee", loanLateFee, setLoanLateFee, { suffix: "₹" })}
          {field("s2-loan-grace", "Loan Grace", loanGraceDays, setLoanGraceDays, { suffix: "days" })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSkip}>
            Skip
          </Button>
          <Button onClick={handleNext} disabled={!!allocationError}>
            Next: Add Members
          </Button>
        </div>
      </div>
    </div>
  )
}
