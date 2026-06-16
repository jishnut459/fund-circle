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
import { CheckCircle2, XCircle, Clock, TrendingDown } from "lucide-react"
import { verifyLoanPayment, rejectLoanPayment } from "@/lib/actions"
import { formatCurrency } from "@/lib/format"

export default function VerifyLoanPaymentActions({
  paymentId,
  circleId,
  userId,
  amount,
  paymentType,
  prepaymentStrategy,
  submittedByName,
}: {
  paymentId: string
  circleId: string
  userId: string
  amount: number
  paymentType: "regular" | "prepayment" | "foreclosure"
  prepaymentStrategy?: "reduce_emi" | "reduce_tenure" | null
  submittedByName?: string
}) {
  const router = useRouter()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState<"verify" | "reject" | null>(null)
  const [error, setError] = useState("")

  const typeLabel =
    paymentType === "foreclosure" ? "Foreclosure" :
    paymentType === "prepayment" ? "Prepayment" : "Payment"

  const strategyLabel =
    prepaymentStrategy === "reduce_emi" ? "reduce EMI" :
    prepaymentStrategy === "reduce_tenure" ? "reduce tenure" : undefined

  const handleVerify = async () => {
    setLoading("verify")
    const result = await verifyLoanPayment(paymentId, userId, circleId)
    setLoading(null)
    if (!result.success) { toast.error(result.error); return }
    toast.success(`${typeLabel} of ${formatCurrency(amount)} verified`)
    router.refresh()
  }

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading("reject")
    setError("")
    const result = await rejectLoanPayment(paymentId, reason, userId, circleId)
    setLoading(null)
    if (!result.success) { setError(result.error); return }
    toast.success(`${typeLabel} rejected`)
    setRejectOpen(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        {paymentType === "prepayment" ? (
          <TrendingDown className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        ) : (
          <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        )}
        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
          {formatCurrency(amount)} {typeLabel.toLowerCase()}
          {strategyLabel ? ` · ${strategyLabel}` : ""}
          {submittedByName ? ` · ${submittedByName}` : ""}
        </span>
      </div>
      <Button size="sm" variant="ghost"
        className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
        onClick={handleVerify} disabled={loading !== null} title="Verify">
        <CheckCircle2 className="h-4 w-4" />
      </Button>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost"
            className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
            disabled={loading !== null} title="Reject">
            <XCircle className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {typeLabel}</DialogTitle>
            <DialogDescription>
              Rejecting {formatCurrency(amount)}{submittedByName ? ` from ${submittedByName}` : ""}. The member will need to resubmit.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lp-reject-reason">Reason (optional)</Label>
              <Input id="lp-reject-reason" value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Amount doesn't match, wrong reference, etc." disabled={loading === "reject"} autoFocus />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" variant="destructive" disabled={loading === "reject"} className="w-full">
              {loading === "reject" ? "Rejecting..." : `Reject ${typeLabel}`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
