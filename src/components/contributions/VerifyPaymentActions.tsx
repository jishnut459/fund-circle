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
import { CheckCircle2, XCircle } from "lucide-react"
import { verifyContributionPayment, rejectContributionPayment } from "@/lib/actions"
import { formatCurrency } from "@/lib/format"
import type { ContribOptimisticUpdate } from "./ContributionTable"

export default function VerifyPaymentActions({
  paymentId,
  contributionId,
  circleId,
  userId,
  amount,
  submittedByName,
  onOptimisticUpdate,
}: {
  paymentId: string
  contributionId: string
  circleId: string
  userId: string
  amount: number
  submittedByName?: string
  onOptimisticUpdate?: (update: ContribOptimisticUpdate) => void
}) {
  const [, startTransition] = useTransition()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState<"verify" | "reject" | null>(null)
  const [error, setError] = useState("")

  const handleVerify = async () => {
    setLoading("verify")
    startTransition(() => onOptimisticUpdate?.({ type: 'verify', contributionId, addedAmount: amount }))
    const result = await verifyContributionPayment(paymentId, userId, circleId)
    setLoading(null)
    if (!result.success) { toast.error(result.error); return }
    toast.success(`${formatCurrency(amount)} verified`)
  }

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading("reject")
    setError("")
    startTransition(() => onOptimisticUpdate?.({ type: 'reject', contributionId }))
    const result = await rejectContributionPayment(paymentId, reason, userId, circleId)
    setLoading(null)
    if (!result.success) { setError(result.error); return }
    toast.success("Payment rejected")
    setRejectOpen(false)
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-300"
        onClick={handleVerify}
        disabled={loading !== null}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {loading === "verify" ? "Verifying…" : "Verify"}
      </Button>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost"
            className="h-8 gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
            disabled={loading !== null}>
            <XCircle className="h-3.5 w-3.5" />
            Reject
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
            <DialogDescription>
              Rejecting {formatCurrency(amount)}{submittedByName ? ` from ${submittedByName}` : ""}. The member will need to resubmit.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason (optional)</Label>
              <Input id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Amount doesn't match, wrong reference, etc." disabled={loading === "reject"} autoFocus />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" variant="destructive" disabled={loading === "reject"} className="w-full">
              {loading === "reject" ? "Rejecting..." : "Reject Payment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
