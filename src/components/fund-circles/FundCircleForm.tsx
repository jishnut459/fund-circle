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

  const handleFrequencyChange = (value: string) => {
    setFrequency(value)
    setCycleDueDay(getDefaultDueDay(value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !amount) return
    setLoading(true)
    setError("")

    const result = await createFundCircle(name, description, Number(amount), frequency, userId, plan, cycleDueDay)

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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading || !name.trim() || !amount} className="w-full">
        {loading ? "Creating..." : "Create Fund Circle"}
      </Button>
    </form>
  )
}
