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
import { submitForeclosure, adminRecordForeclosure } from "@/lib/actions"
import { formatCurrency } from "@/lib/format"

export default function ForeclosureDialog({
  loanId,
  circleId,
  userId,
  outstandingPrincipal,
  accruedInterest,
  mode = "member",
  memberName,
}: {
  loanId: string
  circleId: string
  userId: string
  outstandingPrincipal: number
  accruedInterest: number
  mode?: "member" | "admin"
  memberName?: string
}) {
  const isAdmin = mode === "admin"
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const foreclosureAmount = outstandingPrincipal + accruedInterest

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    if (value) { setNotes(""); setError("") }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const result = isAdmin
      ? await adminRecordForeclosure(loanId, notes, userId, circleId)
      : await submitForeclosure(loanId, notes, userId, circleId)
    setLoading(false)
    if (!result.success) { setError(result.error); return }
    toast.success(
      isAdmin
        ? `Loan closed — foreclosure of ${formatCurrency(foreclosureAmount)} recorded${memberName ? ` for ${memberName}` : ""}`
        : `Foreclosure request of ${formatCurrency(foreclosureAmount)} submitted — awaiting admin verification`
    )
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300">
          {isAdmin ? "Record Foreclosure" : "Close Loan Early"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isAdmin ? `Record Foreclosure${memberName ? ` — ${memberName}` : ""}` : "Close Loan Early"}</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? `Settle ${memberName ?? "the member"}'s remaining balance in full and close the loan. This applies immediately — no further verification needed.`
              : "Pay off your remaining loan balance in full. An admin will verify the payment and close your loan."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 p-3 rounded-xl bg-[var(--border-light)]">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Outstanding principal</span>
              <span className="font-tabular font-medium text-[var(--text-primary)]">{formatCurrency(outstandingPrincipal)}</span>
            </div>
            {accruedInterest > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Accrued interest (due EMIs)</span>
                <span className="font-tabular text-[var(--text-primary)]">{formatCurrency(accruedInterest)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-1.5 border-t border-[var(--border-color)]">
              <span className="font-semibold text-[var(--text-primary)]">Total to pay</span>
              <span className="font-tabular font-bold text-[var(--text-primary)]">{formatCurrency(foreclosureAmount)}</span>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Future interest is not charged on early settlement. Only outstanding principal and any interest already due is included.
          </p>
          <div className="space-y-2">
            <Label htmlFor="fc-notes">Payment reference (optional)</Label>
            <Input id="fc-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="UPI ref: 123456789" disabled={loading} autoFocus />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700">
            {loading
              ? isAdmin ? "Recording..." : "Submitting..."
              : isAdmin
                ? `Record Foreclosure — ${formatCurrency(foreclosureAmount)}`
                : `Request Foreclosure — ${formatCurrency(foreclosureAmount)}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
