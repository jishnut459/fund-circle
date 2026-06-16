"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import ContributionStatusBadge from "./ContributionStatusBadge"
import EditPaymentDialog from "./EditPaymentDialog"
import SubmitPaymentDialog from "./SubmitPaymentDialog"
import VerifyPaymentActions from "./VerifyPaymentActions"
import { cn } from "@/lib/utils"
import { formatCurrency, formatISODate } from "@/lib/format"
import { ChevronDown } from "lucide-react"

interface Contribution {
  id: string
  userId: string
  userName: string
  avatarUrl?: string | null
  expectedAmount: number
  paidAmount: number
  paymentDate: string | null
  notes: string | null
  status: string
}

export interface PendingPayment {
  id: string
  amount: number
  submittedByName?: string
}

export type ContribOptimisticUpdate =
  | { type: 'verify'; contributionId: string; addedAmount: number }
  | { type: 'reject'; contributionId: string }
  | { type: 'edit'; contributionId: string; newPaidAmount: number }
  | { type: 'addPending'; contributionId: string; paymentId: string; amount: number; submittedByName?: string }

export default function ContributionTable({
  contributions,
  circleId,
  currentUserId,
  canEdit,
  cycleClosed,
  pendingPayments = {},
  onOptimisticUpdate,
}: {
  contributions: Contribution[]
  contributionCycleId?: string
  circleId: string
  orgId?: string
  currentUserId: string
  canEdit: boolean
  cycleClosed: boolean
  pendingPayments?: Record<string, PendingPayment>
  onOptimisticUpdate?: (update: ContribOptimisticUpdate) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (contributions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[var(--text-muted)]">No contributions yet.</p>
      </div>
    )
  }

  const statusBorder = (status: string) => {
    switch (status) {
      case "paid": return "border-l-emerald-500"
      case "partially_paid": return "border-l-amber-500"
      case "overpaid": return "border-l-blue-500"
      default: return "border-l-[var(--border-color)]"
    }
  }

  return (
    <div className="space-y-2">
      {contributions.map((c) => {
        const isExpanded = expandedId === c.id
        const pending = pendingPayments[c.id]
        const isOwnContribution = c.userId === currentUserId

        return (
          <div
            key={c.id}
            className={cn(
              "rounded-xl border border-l-[3px] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] overflow-hidden transition-colors",
              statusBorder(c.status)
            )}
          >
            <div
              className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-[var(--border-light)]/60 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : c.id)}
            >
              <Avatar className="h-9 w-9 shrink-0">
                {c.avatarUrl && <AvatarImage src={c.avatarUrl} alt={c.userName} />}
                <AvatarFallback>{c.userName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-[var(--text-primary)] truncate">{c.userName}</p>
                <ContributionStatusBadge status={c.status} />
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold font-tabular text-[var(--text-primary)]">
                  {formatCurrency(c.paidAmount)}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] font-tabular">
                  of {formatCurrency(c.expectedAmount)}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-[var(--text-muted)] shrink-0 transition-transform",
                  isExpanded && "rotate-180"
                )}
              />
              {!cycleClosed && (
                <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center gap-1">
                  {canEdit && pending && (
                    <VerifyPaymentActions
                      paymentId={pending.id}
                      contributionId={c.id}
                      circleId={circleId}
                      userId={currentUserId}
                      amount={pending.amount}
                      submittedByName={pending.submittedByName}
                      onOptimisticUpdate={onOptimisticUpdate}
                    />
                  )}
                  {canEdit && (
                    <EditPaymentDialog
                      contributionId={c.id}
                      circleId={circleId}
                      userId={currentUserId}
                      memberName={c.userName}
                      expectedAmount={c.expectedAmount}
                      currentPaid={c.paidAmount}
                      onOptimisticUpdate={onOptimisticUpdate}
                    />
                  )}
                  {isOwnContribution && !pending && (
                    <SubmitPaymentDialog
                      contributionId={c.id}
                      circleId={circleId}
                      userId={currentUserId}
                      expectedAmount={c.expectedAmount}
                      currentPaid={c.paidAmount}
                      onOptimisticUpdate={onOptimisticUpdate}
                    />
                  )}
                </div>
              )}
            </div>
            {isExpanded && (
              <div className="px-3 pb-3 pt-0 border-t border-[var(--border-light)] mt-0">
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 pt-3 text-xs">
                  <div>
                    <span className="text-[var(--text-muted)]">Expected: </span>
                    <span className="font-tabular font-medium text-[var(--text-primary)]">
                      {formatCurrency(c.expectedAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Date: </span>
                    <span className="text-[var(--text-primary)]">{formatISODate(c.paymentDate ?? "")}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Notes: </span>
                    <span className="text-[var(--text-primary)]">{c.notes ?? "—"}</span>
                  </div>
                  {pending && (
                    <div>
                      <span className="text-amber-600 font-medium">Pending: </span>
                      <span className="font-tabular text-amber-700">{formatCurrency(pending.amount)} awaiting verification</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
