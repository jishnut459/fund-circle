"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cancelLoanRequest } from "@/lib/actions"

interface Props {
  loanId: string
  userId: string
  circleId: string
}

export default function CancelLoanRequestButton({ loanId, userId, circleId }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleCancel = async () => {
    setLoading(true)
    const result = await cancelLoanRequest(loanId, userId, circleId)
    setLoading(false)

    if (!result.success) {
      toast.error(result.error)
      setConfirming(false)
      return
    }

    toast.success("Loan request cancelled")
    router.push(`/circles/${circleId}/loans`)
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-sm text-[var(--text-secondary)]">Withdraw this request?</p>
        <Button
          size="sm"
          variant="destructive"
          disabled={loading}
          onClick={handleCancel}
        >
          {loading ? "Cancelling..." : "Yes, cancel it"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => setConfirming(false)}
        >
          Keep it
        </Button>
      </div>
    )
  }

  return (
    <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
      Cancel Request
    </Button>
  )
}
