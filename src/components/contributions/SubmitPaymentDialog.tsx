"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
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
import { submitContributionPayment } from "@/lib/actions"
import { formatCurrency } from "@/lib/format"
import type { ContribOptimisticUpdate } from "./ContributionTable"

export default function SubmitPaymentDialog({
  contributionId,
  circleId,
  userId,
  expectedAmount,
  lateFee,
  currentPaid,
  onOptimisticUpdate,
}: {
  contributionId: string
  circleId: string
  userId: string
  expectedAmount: number
  lateFee: number
  currentPaid: number
  onOptimisticUpdate?: (update: ContribOptimisticUpdate) => void
}) {
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const totalDue = expectedAmount + lateFee
  const remaining = totalDue - currentPaid

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    if (value) {
      setAmount(remaining > 0 ? String(remaining) : "")
      setNotes("")
      setError("")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setLoading(true)
    setError("")
    startTransition(() =>
      onOptimisticUpdate?.({
        type: 'addPending',
        contributionId,
        paymentId: 'optimistic-pending',
        amount: Number(amount),
      })
    )
    const result = await submitContributionPayment(contributionId, Number(amount), notes, userId, circleId)
    setLoading(false)
    if (!result.success) { setError(result.error); return }
    toast.success(`Payment of ${formatCurrency(Number(amount))} submitted — awaiting admin verification`)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="I've paid">
          <div className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-[var(--border-color)] text-[var(--text-muted)] hover:border-teal hover:bg-teal-50 hover:text-teal transition-colors">
            <Check className="h-3 w-3" />
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as Paid</DialogTitle>
          <DialogDescription>
            Submit your payment details. An admin will verify and confirm it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 p-3 rounded-xl bg-[var(--border-light)]">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Expected</span>
              <span className="font-tabular font-medium text-[var(--text-primary)]">{formatCurrency(expectedAmount)}</span>
            </div>
            {lateFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-amber-600 dark:text-amber-400">Late fee (payment is past the due date)</span>
                <span className="font-tabular font-medium text-amber-600 dark:text-amber-400">+ {formatCurrency(lateFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Paid so far</span>
              <span className="font-tabular text-[var(--text-primary)]">{formatCurrency(currentPaid)}</span>
            </div>
            <div className="flex justify-between text-sm pt-1.5 border-t border-[var(--border-color)]">
              <span className="font-medium text-[var(--text-primary)]">Remaining</span>
              <span className="font-tabular font-semibold text-teal">{formatCurrency(Math.max(0, remaining))}</span>
            </div>
          </div>
          {remaining > 0 && amount !== String(remaining) && (
            <button type="button" onClick={() => setAmount(String(remaining))}
              className="text-xs text-teal hover:text-teal-dark font-medium transition-colors">
              Use remaining amount ({formatCurrency(remaining)})
            </button>
          )}
          <div className="space-y-2">
            <Label htmlFor="sp-amount">Amount paid (₹)</Label>
            <Input id="sp-amount" type="number" step="0.01" min="0" value={amount}
              onChange={(e) => setAmount(e.target.value)} onFocus={(e) => e.target.select()}
              placeholder="500" disabled={loading} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sp-notes">Payment reference (optional)</Label>
            <Input id="sp-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="UPI ref: 123456789" disabled={loading} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading || !amount || Number(amount) <= 0} className="w-full">
            {loading ? "Submitting..." : "Submit for Verification"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
