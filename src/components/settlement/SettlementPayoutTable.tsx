"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
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
import { EmptyState } from "@/components/ui/empty-state"
import { Users } from "lucide-react"
import { recordSettlementDisbursement } from "@/lib/actions"
import { formatCurrency } from "@/lib/format"

export interface SettlementPayoutRow {
  id: string
  userId: string
  userName: string
  contributionTotal: number
  shareAmount: number
  disbursed: boolean
  disbursedAt: string | null
}

function DisbursementDialog({
  payout,
  circleId,
  actorUserId,
}: {
  payout: SettlementPayoutRow
  circleId: string
  actorUserId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setNotes("")
      setError("")
    }
  }

  const handleConfirm = async () => {
    setLoading(true)
    setError("")

    const result = await recordSettlementDisbursement(payout.id, circleId, actorUserId, notes || undefined)

    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    toast.success(`Disbursement recorded for ${payout.userName}`)
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs px-2">
          Mark disbursed
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Disbursement</DialogTitle>
          <DialogDescription>
            Mark {formatCurrency(payout.shareAmount)} as paid out to {payout.userName}?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="p-3 rounded-xl bg-[var(--border-light)] text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Member</span>
              <span className="font-medium text-[var(--text-primary)]">{payout.userName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Share amount</span>
              <span className="font-tabular font-semibold text-[var(--text-primary)]">
                {formatCurrency(payout.shareAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Based on contributions</span>
              <span className="font-tabular text-[var(--text-primary)]">
                {formatCurrency(payout.contributionTotal)}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="disburse-notes">Notes (optional)</Label>
            <Input
              id="disburse-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paid via bank transfer"
              disabled={loading}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={handleConfirm} disabled={loading} className="w-full">
            {loading ? "Recording..." : "Confirm Disbursement"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function SettlementPayoutTable({
  payouts,
  circleId,
  actorUserId,
  canManage,
  settlementFinalized,
}: {
  payouts: SettlementPayoutRow[]
  circleId: string
  actorUserId: string
  canManage: boolean
  settlementFinalized: boolean
}) {
  if (payouts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No payouts calculated yet"
        description={
          canManage
            ? "Calculate the settlement above to generate member payout amounts."
            : "Payouts will appear here once the admin finalises the settlement."
        }
      />
    )
  }

  return (
    <div className="space-y-2">
      {payouts.map((payout) => (
        <div
          key={payout.id}
          className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border-light)]"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-[var(--text-primary)] truncate">{payout.userName}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {formatCurrency(payout.contributionTotal)} contributed
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-base font-bold font-tabular text-[var(--text-primary)]">
                {formatCurrency(payout.shareAmount)}
              </p>
              <Badge variant={payout.disbursed ? "success" : "default"} className="text-[10px]">
                {payout.disbursed ? "disbursed" : "pending"}
              </Badge>
            </div>
            {canManage && settlementFinalized && !payout.disbursed && (
              <DisbursementDialog
                payout={payout}
                circleId={circleId}
                actorUserId={actorUserId}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
