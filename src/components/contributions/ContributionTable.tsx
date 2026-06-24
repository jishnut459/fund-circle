"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import ContributionStatusBadge from "./ContributionStatusBadge"
import EditPaymentDialog from "./EditPaymentDialog"
import SubmitPaymentDialog from "./SubmitPaymentDialog"
import VerifyPaymentActions from "./VerifyPaymentActions"
import { cn } from "@/lib/utils"
import { formatCurrency, formatISODate } from "@/lib/format"
import { ChevronDown, Clock } from "lucide-react"

interface Contribution {
  id: string
  userId: string
  userName: string
  avatarUrl?: string | null
  expectedAmount: number
  paidAmount: number
  lateFee: number
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
        const isFullyPaid = c.status === "paid" || c.status === "overpaid"

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
                <p className="text-lg font-bold font-tabular text-[var(--text-primary)] leading-tight">
                  {formatCurrency(c.paidAmount)}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] font-tabular leading-tight">
                  of {formatCurrency(c.expectedAmount + c.lateFee)}
                </p>
                {c.lateFee > 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-tabular leading-tight">
                    incl. {formatCurrency(c.lateFee)} late fee
                  </p>
                )}
              </div>
              <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center gap-1.5 pl-1 border-l border-[var(--border-light)] empty:hidden">
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
                    lateFee={c.lateFee}
                    currentPaid={c.paidAmount}
                    onOptimisticUpdate={onOptimisticUpdate}
                  />
                )}
                {/* Member's own row: a clear CTA to record their payment, a
                    read-only pending indicator while awaiting admin verification,
                    or nothing once fully paid (the status badge says it all). */}
                {!canEdit && isOwnContribution && pending && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                      {formatCurrency(pending.amount)} pending
                    </span>
                  </div>
                )}
                {!canEdit && isOwnContribution && !pending && !isFullyPaid && (
                  <SubmitPaymentDialog
                    contributionId={c.id}
                    circleId={circleId}
                    userId={currentUserId}
                    expectedAmount={c.expectedAmount}
                    lateFee={c.lateFee}
                    currentPaid={c.paidAmount}
                    onOptimisticUpdate={onOptimisticUpdate}
                  />
                )}
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-[var(--text-muted)] shrink-0 transition-transform",
                  isExpanded && "rotate-180"
                )}
              />
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
                  {c.lateFee > 0 && (
                    <div>
                      <span className="text-[var(--text-muted)]">Late fee: </span>
                      <span className="font-tabular font-medium text-amber-600 dark:text-amber-400">
                        {formatCurrency(c.lateFee)}
                      </span>
                    </div>
                  )}
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
