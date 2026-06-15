"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import EMICalculator from "@/components/loans/EMICalculator"
import { reviewLoanRequest } from "@/lib/actions"
import { formatCurrency } from "@/lib/format"

interface LoanReviewDialogProps {
  loanId: string
  circleId: string
  actorUserId: string
  memberName?: string
  requestedAmount: number
  requestedTermMonths: number
  purpose?: string | null
  fixedRatePct: number
  maxAmount: number
  maxTermMonths?: number
}

export default function LoanReviewDialog({
  loanId,
  circleId,
  actorUserId,
  memberName,
  requestedAmount,
  requestedTermMonths,
  purpose,
  fixedRatePct,
  maxAmount,
  maxTermMonths,
}: LoanReviewDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [approvedAmount, setApprovedAmount] = useState(requestedAmount)
  const [approvedTermMonths, setApprovedTermMonths] = useState(requestedTermMonths)
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null)
  const [error, setError] = useState("")

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    if (value) {
      setApprovedAmount(requestedAmount)
      setApprovedTermMonths(requestedTermMonths)
      setError("")
    }
  }

  const handleReview = async (decision: "approve" | "reject") => {
    setLoading(decision)
    setError("")

    const result = await reviewLoanRequest(
      loanId,
      circleId,
      actorUserId,
      decision,
      decision === "approve" ? approvedAmount : undefined,
      decision === "approve" ? approvedTermMonths : undefined
    )

    setLoading(null)

    if (!result.success) {
      setError(result.error)
      return
    }

    toast.success(decision === "approve" ? "Loan approved and issued" : "Loan request rejected")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Loan Request{memberName ? ` — ${memberName}` : ""}</DialogTitle>
          <DialogDescription>
            Requested {formatCurrency(requestedAmount)} over {requestedTermMonths} months
            {purpose ? ` for "${purpose}"` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <EMICalculator
            defaultAmount={requestedAmount}
            defaultTermMonths={requestedTermMonths}
            fixedRatePct={fixedRatePct}
            maxAmount={maxAmount}
            maxTermMonths={maxTermMonths}
            onChange={({ amount, termMonths }) => {
              setApprovedAmount(amount)
              setApprovedTermMonths(termMonths)
            }}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              disabled={loading !== null}
              onClick={() => handleReview("reject")}
              className="flex-1"
            >
              {loading === "reject" ? "Rejecting..." : "Reject Request"}
            </Button>
            <Button
              disabled={loading !== null || approvedAmount <= 0 || approvedTermMonths <= 0}
              onClick={() => handleReview("approve")}
              className="flex-1"
            >
              {loading === "approve" ? "Approving..." : "Approve & Issue Loan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
