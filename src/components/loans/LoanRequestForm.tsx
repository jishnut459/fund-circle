"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import EMICalculator from "@/components/loans/EMICalculator"
import { requestLoan } from "@/lib/actions"

interface LoanRequestFormProps {
  circleId: string
  userId: string
  fixedRatePct: number
  maxAmount: number
  maxTermMonths?: number
}

export default function LoanRequestForm({ circleId, userId, fixedRatePct, maxAmount, maxTermMonths }: LoanRequestFormProps) {
  const router = useRouter()
  const defaultAmount = Math.min(50000, maxAmount)
  const defaultTermMonths = maxTermMonths !== undefined ? Math.min(12, maxTermMonths) : 12

  const [amount, setAmount] = useState(defaultAmount)
  const [termMonths, setTermMonths] = useState(defaultTermMonths)
  const [purpose, setPurpose] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const result = await requestLoan(circleId, userId, amount, termMonths, purpose)

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
    <form onSubmit={handleSubmit} className="space-y-5">
      <EMICalculator
        defaultAmount={defaultAmount}
        defaultTermMonths={defaultTermMonths}
        fixedRatePct={fixedRatePct}
        maxAmount={maxAmount}
        maxTermMonths={maxTermMonths}
        onChange={({ amount, termMonths }) => {
          setAmount(amount)
          setTermMonths(termMonths)
        }}
      />

      <div className="space-y-2">
        <Label htmlFor="purpose">Purpose (optional)</Label>
        <Input
          id="purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="e.g. Medical expenses"
          disabled={loading}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={loading || amount <= 0 || termMonths <= 0} className="w-full">
        {loading ? "Submitting..." : "Submit Loan Request"}
      </Button>
    </form>
  )
}
