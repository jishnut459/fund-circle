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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { createFundCircle } from "@/lib/actions"
import CycleDueDaySelect, { getDefaultDueDay } from "@/components/fund-circles/CycleDueDaySelect"

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
]

const PLANS = [
  { value: "free", label: "Free · 20 members" },
  { value: "pro", label: "Pro · 100 members" },
  { value: "premium", label: "Premium · Unlimited" },
]

export default function NewCircleDialog({ userId }: { userId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
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

    setOpen(false)
    setName("")
    setDescription("")
    setAmount("")
    router.push(`/circles/${result.data.circleId}/dashboard`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="shadow-sm">
          <Plus className="h-4 w-4" />
          New Circle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Fund Circle</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="desc">Description (optional)</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              disabled={loading}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹)</Label>
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
              <Label htmlFor="freq">Frequency</Label>
              <Select value={frequency} onValueChange={handleFrequencyChange} disabled={loading}>
                <SelectTrigger id="freq">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <CycleDueDaySelect frequency={frequency} value={cycleDueDay} onChange={setCycleDueDay} disabled={loading} />
          <div className="space-y-2">
            <Label htmlFor="plan">Plan</Label>
            <Select value={plan} onValueChange={setPlan} disabled={loading}>
              <SelectTrigger id="plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading || !name.trim() || !amount} className="w-full">
            {loading ? "Creating..." : "Create Fund Circle"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
