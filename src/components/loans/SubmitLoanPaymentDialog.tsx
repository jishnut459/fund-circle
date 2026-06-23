"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Check } from "lucide-react"
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
import {
  getInstallmentDue,
  submitLoanPayment,
  submitPrepayment,
  adminRecordLoanInstallmentPayment,
  adminRecordPrepayment,
} from "@/lib/actions"
import { formatCurrency } from "@/lib/format"

type DueBreakdown = {
  scheduledDue: number
  paidAmount: number
  remaining: number
  daysLate: number
  accruedInterest: number
  totalOwed: number
  annualRatePct: number
}

export default function SubmitLoanPaymentDialog({
  installmentId,
  loanId,
  circleId,
  userId,
  installmentNumber,
  currentEMI,
  mode = "member",
  memberName,
}: {
  installmentId: string
  loanId: string
  circleId: string
  userId: string
  installmentNumber: number
  currentEMI: number
  mode?: "member" | "admin"
  memberName?: string
}) {
  const isAdmin = mode === "admin"
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [strategy, setStrategy] = useState<"reduce_emi" | "reduce_tenure">("reduce_tenure")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [due, setDue] = useState<DueBreakdown | null>(null)
  const [dueLoading, setDueLoading] = useState(false)

  const totalOwed = due?.totalOwed ?? 0
  const isPrepayment = due !== null && Number(amount) > totalOwed

  const handleOpenChange = async (value: boolean) => {
    setOpen(value)
    if (value) {
      setAmount("")
      setNotes("")
      setError("")
      setDue(null)
      setDueLoading(true)
      const result = await getInstallmentDue(installmentId, circleId)
      setDueLoading(false)
      if (result.success) {
        setDue(result.data)
        setAmount(result.data.totalOwed > 0 ? String(result.data.totalOwed) : "")
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0) return
    setLoading(true)
    setError("")

    const result = isAdmin
      ? isPrepayment
        ? await adminRecordPrepayment(loanId, amt, strategy, notes, userId, circleId)
        : await adminRecordLoanInstallmentPayment(installmentId, amt, notes, userId, circleId)
      : isPrepayment
        ? await submitPrepayment(loanId, amt, strategy, notes, userId, circleId)
        : await submitLoanPayment(installmentId, amt, notes, userId, circleId)

    setLoading(false)
    if (!result.success) { setError(result.error); return }
    const forWhom = memberName ? ` for ${memberName}` : ""
    toast.success(
      isAdmin
        ? isPrepayment
          ? `Prepayment of ${formatCurrency(amt)} recorded${forWhom}`
          : `EMI of ${formatCurrency(amt)} recorded${forWhom} for installment #${installmentNumber}`
        : isPrepayment
          ? `Prepayment of ${formatCurrency(amt)} submitted — awaiting admin verification`
          : `Payment of ${formatCurrency(amt)} submitted for installment #${installmentNumber} — awaiting admin verification`
    )
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isAdmin ? (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 text-xs">
            <Check className="h-3.5 w-3.5" />
            Record EMI
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="I've paid">
            <div className="w-6 h-6 rounded-full flex items-center justify-center border-2 border-[var(--border-color)] text-[var(--text-muted)] hover:border-teal hover:bg-teal-50 hover:text-teal transition-colors">
              <Check className="h-3 w-3" />
            </div>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isAdmin
              ? `Record EMI${memberName ? ` — ${memberName}` : ""} · Installment #${installmentNumber}`
              : `Submit EMI Payment — Installment #${installmentNumber}`}
          </DialogTitle>
          <DialogDescription>
            {isAdmin
              ? isPrepayment
                ? `Recording more than the amount due${memberName ? ` for ${memberName}` : ""}. The extra will reduce the principal. This applies immediately.`
                : `Record this payment on behalf of ${memberName ?? "the member"}. It applies immediately — no further verification needed.`
              : isPrepayment
                ? "You're paying more than the amount due. The extra will reduce your principal."
                : "Submit your payment details. An admin will verify and confirm it."}
          </DialogDescription>
        </DialogHeader>

        {dueLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
          </div>
        )}

        {!dueLoading && !due && (
          <p className="text-sm text-red-600 py-4 text-center">
            Failed to load payment details. Please close and try again.
          </p>
        )}

        {!dueLoading && due && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5 p-3 rounded-xl bg-[var(--border-light)]">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Scheduled EMI</span>
                <span className="font-tabular font-medium text-[var(--text-primary)]">
                  {formatCurrency(due.scheduledDue)}
                </span>
              </div>
              {due.paidAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Already paid</span>
                  <span className="font-tabular text-[var(--text-primary)]">
                    − {formatCurrency(due.paidAmount)}
                  </span>
                </div>
              )}
              {due.accruedInterest > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">
                    Late interest ({due.daysLate} day{due.daysLate !== 1 ? "s" : ""} × {due.annualRatePct}% p.a.)
                  </span>
                  <span className="font-tabular text-amber-600">
                    + {formatCurrency(due.accruedInterest)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-1.5 border-t border-[var(--border-color)]">
                <span className="font-semibold text-[var(--text-primary)]">
                  {due.accruedInterest > 0 ? "Total to pay" : "Remaining"}
                </span>
                <span className={`font-tabular font-bold ${due.accruedInterest > 0 ? "text-amber-600 dark:text-amber-400" : "text-teal"}`}>
                  {formatCurrency(due.totalOwed)}
                </span>
              </div>
            </div>

            {due.totalOwed > 0 && amount !== String(due.totalOwed) && (
              <button
                type="button"
                onClick={() => setAmount(String(due.totalOwed))}
                className="text-xs text-teal hover:text-teal-dark font-medium transition-colors"
              >
                Use calculated amount ({formatCurrency(due.totalOwed)})
              </button>
            )}

            <div className="space-y-2">
              <Label htmlFor="slp-amount">Amount paying (₹)</Label>
              <Input
                id="slp-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder={String(due.totalOwed)}
                disabled={loading}
                autoFocus
              />
            </div>

            {isPrepayment && (
              <div className="space-y-2 p-3 rounded-xl border border-teal/30 bg-teal/5">
                <p className="text-xs font-semibold text-teal">Prepayment — choose what to do with the extra</p>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="strategy"
                      value="reduce_tenure"
                      checked={strategy === "reduce_tenure"}
                      onChange={() => setStrategy("reduce_tenure")}
                      className="mt-0.5 accent-teal"
                    />
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">Reduce tenure</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Keep same EMI (₹{currentEMI.toFixed(0)}), close the loan sooner
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="strategy"
                      value="reduce_emi"
                      checked={strategy === "reduce_emi"}
                      onChange={() => setStrategy("reduce_emi")}
                      className="mt-0.5 accent-teal"
                    />
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">Reduce EMI</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Keep same number of months, pay a lower EMI going forward
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="slp-notes">Payment reference (optional)</Label>
              <Input
                id="slp-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="UPI ref: 123456789"
                disabled={loading}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              disabled={loading || !amount || Number(amount) <= 0}
              className="w-full"
            >
              {loading
                ? isAdmin ? "Recording..." : "Submitting..."
                : isAdmin
                  ? isPrepayment ? "Record Prepayment" : "Record Payment"
                  : isPrepayment ? "Submit Prepayment" : "Submit for Verification"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
