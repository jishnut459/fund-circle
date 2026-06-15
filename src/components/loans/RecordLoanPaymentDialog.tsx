"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { cn } from "@/lib/utils"
import { recordLoanPayment } from "@/lib/actions"
import { formatCurrency } from "@/lib/format"

export default function RecordLoanPaymentDialog({
  loanInstallmentId,
  circleId,
  actorUserId,
  installmentNumber,
  totalDue,
  paidAmount,
}: {
  loanInstallmentId: string
  circleId: string
  actorUserId: string
  installmentNumber: number
  totalDue: number
  paidAmount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const remaining = totalDue - paidAmount
  const isSettled = remaining <= 0

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

    const result = await recordLoanPayment(loanInstallmentId, Number(amount), notes, actorUserId, circleId)

    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    toast.success(`${formatCurrency(Number(amount))} recorded for installment #${installmentNumber}`)
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          title={isSettled ? "Add another payment" : "Record EMI payment"}
        >
          <div
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
              isSettled
                ? "bg-teal text-white"
                : "border-2 border-[var(--border-color)] text-[var(--text-muted)] hover:border-teal hover:bg-teal-50 hover:text-teal"
            )}
          >
            <Check className="h-3 w-3" />
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record EMI Payment — Installment #{installmentNumber}</DialogTitle>
          <DialogDescription>
            {amount && Number(amount) > 0
              ? Number(amount) + paidAmount > totalDue
                ? `Amount will exceed the total due by ${formatCurrency(Number(amount) + paidAmount - totalDue)}.`
                : Number(amount) + paidAmount === totalDue
                  ? "Amount will fully settle this installment."
                  : `${formatCurrency(totalDue - (paidAmount + Number(amount)))} will remain after this payment.`
              : "Enter the amount received for this installment."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 p-3 rounded-xl bg-[var(--border-light)]">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Total Due</span>
              <span className="font-tabular font-medium text-[var(--text-primary)]">
                {formatCurrency(totalDue)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Paid so far</span>
              <span className="font-tabular text-[var(--text-primary)]">
                {formatCurrency(paidAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-1.5 border-t border-[var(--border-color)]">
              <span className="font-medium text-[var(--text-primary)]">Remaining</span>
              <span className="font-tabular font-semibold text-teal">
                {formatCurrency(Math.max(0, remaining))}
              </span>
            </div>
          </div>

          {remaining > 0 && amount !== String(remaining) && (
            <button
              type="button"
              onClick={() => setAmount(String(remaining))}
              className="text-xs text-teal hover:text-teal-dark font-medium transition-colors"
            >
              Use remaining amount ({formatCurrency(remaining)})
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
              onFocus={(e) => e.target.select()}
              placeholder="2000"
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paid via UPI"
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
