"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { Check } from "lucide-react"
import { recordPayment } from "@/lib/actions"
import { formatCurrency } from "@/lib/format"

export default function RecordPaymentDialog({
  contributionId,
  circleId,
  userId,
  expectedAmount,
  currentPaid,
}: {
  contributionId: string
  contributionCycleId?: string
  circleId: string
  orgId?: string
  userId: string
  expectedAmount: number
  currentPaid: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const remaining = expectedAmount - currentPaid

  const quickPay = () => {
    setAmount(String(remaining))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setLoading(true)
    setError("")

    const result = await recordPayment(contributionId, Number(amount), notes, userId, circleId)

    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    setOpen(false)
    setAmount("")
    setNotes("")
    router.refresh()
  }

  const totalAfterPayment = currentPaid + (Number(amount) || 0)
  const willBePaid = totalAfterPayment >= expectedAmount
  const willBeOverpaid = totalAfterPayment > expectedAmount

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Record payment">
          <div className="w-6 h-6 rounded-full border-2 border-[var(--border-color)] flex items-center justify-center hover:border-teal hover:bg-teal-50 transition-colors">
            <Check className="h-3 w-3 text-[var(--text-muted)]" />
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            {amount && Number(amount) > 0
              ? willBeOverpaid
                ? `Amount will exceed expected payment by ${formatCurrency(totalAfterPayment - expectedAmount)}.`
                : willBePaid
                  ? "Amount will fully cover expected contribution."
                  : `${formatCurrency(expectedAmount - totalAfterPayment)} will remain.`
              : "Enter the amount received from this member."
            }
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 p-3 rounded-xl bg-[var(--border-light)]">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Expected</span>
              <span className="font-tabular font-medium text-[var(--text-primary)]">
                {formatCurrency(expectedAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Paid so far</span>
              <span className="font-tabular text-[var(--text-primary)]">
                {formatCurrency(currentPaid)}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-1.5 border-t border-[var(--border-color)]">
              <span className="font-medium text-[var(--text-primary)]">Remaining</span>
              <span className="font-tabular font-semibold text-teal">
                {formatCurrency(Math.max(0, remaining))}
              </span>
            </div>
          </div>

          {remaining > 0 && (
            <button
              type="button"
              onClick={quickPay}
              className="text-xs text-teal hover:text-teal-dark font-medium transition-colors"
            >
              Quick-fill remaining ({formatCurrency(remaining)})
            </button>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment via UPI"
              disabled={loading}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading || !amount || Number(amount) <= 0} className="w-full">
            {loading ? "Recording..." : "Record Payment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
