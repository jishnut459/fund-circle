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
import { Pencil } from "lucide-react"
import { editContributionPayment } from "@/lib/actions"
import { formatCurrency } from "@/lib/format"
import type { ContribOptimisticUpdate } from "./ContributionTable"

export default function EditPaymentDialog({
  contributionId,
  circleId,
  userId,
  memberName,
  expectedAmount,
  lateFee,
  currentPaid,
  onOptimisticUpdate,
}: {
  contributionId: string
  circleId: string
  userId: string
  memberName?: string
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

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    if (value) {
      setAmount(String(currentPaid))
      setNotes("")
      setError("")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amount === "" || Number(amount) < 0) return
    setLoading(true)
    setError("")

    startTransition(() =>
      onOptimisticUpdate?.({ type: 'edit', contributionId, newPaidAmount: Number(amount) })
    )

    const result = await editContributionPayment(
      contributionId,
      Number(amount),
      notes,
      userId,
      circleId
    )

    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    toast.success(
      `Payment updated to ${formatCurrency(Number(amount))}${memberName ? ` for ${memberName}` : ""}`
    )
    setOpen(false)
  }

  const newAmount = Number(amount)
  const diff = newAmount - currentPaid

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          title="Edit payment"
        >
          <div className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-[var(--border-color)] text-[var(--text-muted)] hover:border-teal hover:bg-teal-50 hover:text-teal transition-colors">
            <Pencil className="h-3 w-3" />
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Edit Payment{memberName ? ` — ${memberName}` : ""}
          </DialogTitle>
          <DialogDescription>
            {amount !== ""
              ? diff > 0
                ? `This will increase the paid amount by ${formatCurrency(diff)}.`
                : diff < 0
                  ? `This will reduce the paid amount by ${formatCurrency(Math.abs(diff))}.`
                  : "No change to the paid amount."
              : "Set the correct total amount paid by this member."}
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
            {lateFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-amber-600 dark:text-amber-400">Late fee</span>
                <span className="font-tabular font-medium text-amber-600 dark:text-amber-400">
                  + {formatCurrency(lateFee)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Current paid</span>
              <span className="font-tabular text-[var(--text-primary)]">
                {formatCurrency(currentPaid)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-amount">Correct total paid (₹)</Label>
            <Input
              id="edit-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Reason for edit (optional)</Label>
            <Input
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Correction — entered wrong amount earlier"
              disabled={loading}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="submit"
            disabled={loading || amount === "" || Number(amount) < 0 || Number(amount) === currentPaid}
            className="w-full"
          >
            {loading ? "Saving..." : "Save Correction"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
