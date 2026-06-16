"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"
import { requestLoan } from "@/lib/actions"
import { Send } from "lucide-react"

interface LoanRequestFormProps {
  circleId: string
  userId: string
  maxAmount: number
  maxTermMonths?: number
}

export default function LoanRequestForm({ circleId, userId, maxAmount, maxTermMonths }: LoanRequestFormProps) {
  const router = useRouter()
  const defaultAmount = Math.min(50000, maxAmount)
  const defaultTermMonths = maxTermMonths !== undefined ? Math.min(12, maxTermMonths) : 12

  const [amount, setAmount] = useState(String(defaultAmount))
  const [termMonths, setTermMonths] = useState(String(defaultTermMonths))
  const [purpose, setPurpose] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const amountNum = Number(amount) || 0
  const termNum = Math.floor(Number(termMonths)) || 0

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const result = await requestLoan(circleId, userId, amountNum, termNum, purpose)

    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    toast.success("Loan request submitted")
    router.push(`/circles/${circleId}/dashboard`)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Send className="h-4 w-4 text-teal" />
          Submit Request
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="req-amount">Loan Amount (₹)</Label>
              <Input
                id="req-amount"
                type="number"
                min="1"
                max={maxAmount}
                step="1"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                disabled={loading}
              />
              {maxAmount > 0 && (
                <p className="text-xs text-[var(--text-muted)]">Max eligible: {formatCurrency(maxAmount)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-term">Term (months)</Label>
              <Input
                id="req-term"
                type="number"
                min="1"
                max={maxTermMonths}
                step="1"
                value={termMonths}
                onChange={(e) => handleTermChange(e.target.value)}
                disabled={loading}
              />
              {maxTermMonths !== undefined && (
                <p className="text-xs text-[var(--text-muted)]">Max {maxTermMonths} months</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="req-purpose">Purpose (optional)</Label>
            <Input
              id="req-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Medical expenses"
              disabled={loading}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading || amountNum <= 0 || termNum <= 0} className="w-full">
            {loading ? "Submitting..." : "Submit Loan Request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
