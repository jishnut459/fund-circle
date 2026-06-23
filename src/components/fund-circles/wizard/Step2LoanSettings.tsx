"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Settings2, ChevronRight } from "lucide-react"
import { formatCurrency } from "@/lib/format"
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

// Most circles never touch these — only flag as "customized" when something
// meaningfully differs from the defaults so we know whether to expand by default.
function isCustomized(d: LoanSettings): boolean {
  return (
    d.assetAllocationPct !== 0 ||
    d.loanInterestRatePct !== 0 ||
    d.contributionLateFee !== 0 ||
    d.contributionGraceDays !== 0 ||
    d.maxLoanPctOfContribution !== 90 ||
    d.maxLoanPctOfLendingPool !== 10
  )
}

export default function Step2LoanSettings({ initialData, onNext, onBack }: Step2LoanSettingsProps) {
  // Loan allocation is the editable value; assets take whatever is left, so the
  // two always sum to 100 and there's nothing for the user to reconcile.
  const [loanPct, setLoanPct] = useState(initialData.loanAllocationPct)
  const [interestRate, setInterestRate] = useState(String(initialData.loanInterestRatePct))
  const [maxLoanContrib, setMaxLoanContrib] = useState(String(initialData.maxLoanPctOfContribution))
  const [maxLoanPool, setMaxLoanPool] = useState(String(initialData.maxLoanPctOfLendingPool))
  const [contribLateFee, setContribLateFee] = useState(String(initialData.contributionLateFee))
  const [contribGraceDays, setContribGraceDays] = useState(String(initialData.contributionGraceDays))
  const [showAdvanced, setShowAdvanced] = useState(isCustomized(initialData))

  const assetPct = 100 - loanPct

  const buildData = (): LoanSettings => ({
    assetAllocationPct: assetPct,
    loanAllocationPct: loanPct,
    loanInterestRatePct: Number(interestRate) || 0,
    maxLoanPctOfContribution: Number(maxLoanContrib) || 0,
    maxLoanPctOfLendingPool: Number(maxLoanPool) || 0,
    contributionLateFee: Number(contribLateFee) || 0,
    contributionGraceDays: Number(contribGraceDays) || 0,
    loanLateFee: 0,
    loanGraceDays: 0,
  })

  const feeSummary =
    Number(contribLateFee) > 0 ? `${formatCurrency(Number(contribLateFee))} late fee` : "no late fee"

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--text-muted)]">
        Decide how collected money can be used and what happens on late payments. These come with sensible
        defaults — most circles can skip this and adjust later in settings.
      </p>

      {!showAdvanced ? (
        <button
          type="button"
          onClick={() => setShowAdvanced(true)}
          className="w-full flex items-center gap-3 rounded-xl border border-[var(--border-light)] bg-[var(--bg-page)] px-4 py-3.5 text-left hover:border-[var(--border-color)] transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal flex items-center justify-center shrink-0">
            <Settings2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">Using default fund settings</p>
            <p className="text-xs text-[var(--text-muted)]">
              {loanPct}% available to lend · {Number(interestRate) || 0}% interest · {feeSummary}
            </p>
          </div>
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-teal shrink-0">
            Customize <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </button>
      ) : (
        <div className="space-y-6">
          {/* Allocation — single slider, no arithmetic for the user */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Fund Allocation</h3>
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
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Contribution Late Fee &amp; Grace Period</h3>
            <div className="grid grid-cols-2 gap-3">
              {field("s2-contrib-fee", "Late Fee", contribLateFee, setContribLateFee, { suffix: "₹" })}
              {field("s2-contrib-grace", "Grace Period", contribGraceDays, setContribGraceDays, { suffix: "days" })}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              A member who pays this many days after the due date owes the late fee. Loan EMI late fees are set
              later in circle settings.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={() => onNext(buildData())}>
          Next: Add Members
        </Button>
      </div>
    </div>
  )
}
