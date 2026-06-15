"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { calculateEMI, generateAmortizationSchedule } from "@/lib/loans"
import { formatCurrency, formatDate } from "@/lib/format"
import { Calculator } from "lucide-react"

interface EMICalculatorProps {
  defaultAmount?: number
  defaultRatePct?: number
  defaultTermMonths?: number
  /** If set, the interest rate is locked to this value (e.g. the circle's configured loan_interest_rate_pct) and not user-editable. */
  fixedRatePct?: number
  /** If set, caps the loan term (e.g. so the final installment doesn't fall after the circle's end_date). */
  maxTermMonths?: number
  /** If set, caps the loan amount (e.g. the member's computed eligibleAmount). */
  maxAmount?: number
}

export default function EMICalculator({
  defaultAmount = 50000,
  defaultRatePct = 12,
  defaultTermMonths = 12,
  fixedRatePct,
  maxTermMonths,
  maxAmount,
}: EMICalculatorProps) {
  const [amount, setAmount] = useState(String(defaultAmount))
  const [ratePct, setRatePct] = useState(String(fixedRatePct ?? defaultRatePct))
  const [termMonths, setTermMonths] = useState(String(defaultTermMonths))

  const principal = Number(amount) || 0
  const rate = fixedRatePct ?? (Number(ratePct) || 0)
  const term = Math.floor(Number(termMonths)) || 0

  const handleAmountChange = (value: string) => {
    if (maxAmount !== undefined && Number(value) > maxAmount) {
      setAmount(String(maxAmount))
    } else {
      setAmount(value)
    }
  }

  const handleTermChange = (value: string) => {
    if (maxTermMonths !== undefined && Number(value) > maxTermMonths) {
      setTermMonths(String(maxTermMonths))
    } else {
      setTermMonths(value)
    }
  }

  const emi = useMemo(
    () => (principal > 0 && term > 0 ? calculateEMI(principal, rate, term) : 0),
    [principal, rate, term]
  )
  const schedule = useMemo(
    () => (principal > 0 && term > 0 ? generateAmortizationSchedule(principal, rate, term, new Date()) : []),
    [principal, rate, term]
  )

  const totalInterest = schedule.reduce((sum, row) => sum + row.interestComponent, 0)
  const totalPayment = schedule.reduce((sum, row) => sum + row.totalDue, 0)

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-teal" />
          EMI Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emi-amount">Loan Amount (₹)</Label>
            <Input
              id="emi-amount"
              type="number"
              min="0"
              max={maxAmount}
              step="1"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
            />
            {maxAmount !== undefined && (
              <p className="text-xs text-[var(--text-muted)]">Max eligible: {formatCurrency(maxAmount)}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="emi-rate">Interest Rate (% p.a.)</Label>
            <Input
              id="emi-rate"
              type="number"
              min="0"
              step="0.1"
              value={ratePct}
              onChange={(e) => setRatePct(e.target.value)}
              disabled={fixedRatePct !== undefined}
            />
            {fixedRatePct !== undefined && (
              <p className="text-xs text-[var(--text-muted)]">Set by circle settings</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="emi-term">Term (months)</Label>
            <Input
              id="emi-term"
              type="number"
              min="1"
              max={maxTermMonths}
              step="1"
              value={termMonths}
              onChange={(e) => handleTermChange(e.target.value)}
            />
            {maxTermMonths !== undefined && (
              <p className="text-xs text-[var(--text-muted)]">Max {maxTermMonths} months until circle expiry</p>
            )}
          </div>
        </div>

        {principal > 0 && term > 0 ? (
          <>
            <div className="rounded-xl bg-[var(--border-light)] p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Monthly EMI</p>
                <p className="text-2xl font-bold font-tabular text-[var(--text-primary)]">
                  {formatCurrency(emi)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Total Interest</p>
                <p className="text-lg font-semibold font-tabular text-[var(--text-primary)]">
                  {formatCurrency(totalInterest)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Total Payment</p>
                <p className="text-lg font-semibold font-tabular text-[var(--text-primary)]">
                  {formatCurrency(totalPayment)}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-light)] divide-y divide-[var(--border-light)] max-h-80 overflow-y-auto">
              {schedule.map((row) => (
                <div key={row.installmentNumber} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--text-primary)]">
                      #{row.installmentNumber} &middot; {formatDate(row.dueDate)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Principal {formatCurrency(row.principalComponent)} + Interest {formatCurrency(row.interestComponent)}
                    </p>
                  </div>
                  <p className="font-semibold font-tabular text-[var(--text-primary)] shrink-0 pl-3">
                    {formatCurrency(row.totalDue)}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">
            Enter a loan amount and term to see the EMI breakdown.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
