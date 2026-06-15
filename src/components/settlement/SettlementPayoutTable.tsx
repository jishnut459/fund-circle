"use client"

import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Users } from "lucide-react"
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

export default function SettlementPayoutTable({
  payouts,
  canManage,
}: {
  payouts: SettlementPayoutRow[]
  canManage: boolean
}) {
  if (payouts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No payouts calculated yet"
        description="Calculate the settlement above to generate member payout amounts."
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
          <div className="text-right shrink-0 space-y-1">
            <p className="text-base font-bold font-tabular text-[var(--text-primary)]">
              {formatCurrency(payout.shareAmount)}
            </p>
            <Badge variant={payout.disbursed ? "success" : "default"} className="text-[10px]">
              {payout.disbursed ? "disbursed" : "pending"}
            </Badge>
          </div>
        </div>
      ))}
      {canManage && (
        <p className="text-xs text-[var(--text-muted)] pt-1">
          Disbursement tracking will be available here once the settlement is finalized.
        </p>
      )}
    </div>
  )
}
