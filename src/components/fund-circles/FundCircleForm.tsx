"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createFundCircle } from "@/lib/actions"
import CycleDueDaySelect, { getDefaultDueDay } from "@/components/fund-circles/CycleDueDaySelect"
import { ChevronDown, ChevronUp } from "lucide-react"

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
]

const PLANS = [
  { value: "free", label: "Free (20 members)" },
  { value: "pro", label: "Pro (100 members)" },
  { value: "premium", label: "Premium (unlimited)" },
]

export default function FundCircleForm({
  userId,
}: {
  userId: string
  orgId?: string
  circleLimitReached?: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [frequency, setFrequency] = useState("monthly")
  const [cycleDueDay, setCycleDueDay] = useState<number | null>(getDefaultDueDay("monthly"))
  const [plan, setPlan] = useState("free")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [showLoanSettings, setShowLoanSettings] = useState(false)
  const [assetAllocationPct, setAssetAllocationPct] = useState("0")
  const [loanAllocationPct, setLoanAllocationPct] = useState("100")
  const [loanInterestRatePct, setLoanInterestRatePct] = useState("0")
  const [maxLoanPctOfContribution, setMaxLoanPctOfContribution] = useState("90")
  const [maxLoanPctOfLendingPool, setMaxLoanPctOfLendingPool] = useState("10")
  const [contributionLateFee, setContributionLateFee] = useState("0")
  const [contributionGraceDays, setContributionGraceDays] = useState("0")
  const [loanLateFee, setLoanLateFee] = useState("0")
  const [loanGraceDays, setLoanGraceDays] = useState("0")

  const allocationSum = (Number(assetAllocationPct) || 0) + (Number(loanAllocationPct) || 0)
  const allocationError = allocationSum !== 100 ? `Asset + loan allocation must add up to 100% (currently ${allocationSum}%)` : ""
  const dateError = startDate && endDate && endDate < startDate ? "End date must be on or after the start date" : ""

  const handleFrequencyChange = (value: string) => {
    setFrequency(value)
    setCycleDueDay(getDefaultDueDay(value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !amount) return
    if (allocationError || dateError) {
      setError(allocationError || dateError)
      return
    }
    setLoading(true)
    setError("")

    const result = await createFundCircle(name, description, Number(amount), frequency, userId, plan, cycleDueDay, {
      loanSettings: {
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
      startDate: startDate || null,
      endDate: endDate || null,
    })

    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push(`/circles/${result.data.circleId}/dashboard`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Circle Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Monthly Savings Fund"
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description"
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">Contribution Amount (₹)</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1000"
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="frequency">Frequency</Label>
        <Select value={frequency} onValueChange={handleFrequencyChange} disabled={loading}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCIES.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <CycleDueDaySelect frequency={frequency} value={cycleDueDay} onChange={setCycleDueDay} disabled={loading} />
      <div className="space-y-2">
        <Label htmlFor="plan">Plan</Label>
        <Select value={plan} onValueChange={setPlan} disabled={loading}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLANS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="start-date">Start Date (optional)</Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date">End Date (optional)</Label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>
      {dateError && <p className="text-sm text-red-600">{dateError}</p>}

      <div className="space-y-4 rounded-xl border border-[var(--border-light)] p-4">
        <button
          type="button"
          onClick={() => setShowLoanSettings((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-semibold text-[var(--text-primary)]"
        >
          Loan &amp; Asset Settings
          {showLoanSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showLoanSettings && (
          <div className="space-y-4">
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
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading || !name.trim() || !amount || !!allocationError || !!dateError} className="w-full">
        {loading ? "Creating..." : "Create Fund Circle"}
      </Button>
    </form>
  )
}
