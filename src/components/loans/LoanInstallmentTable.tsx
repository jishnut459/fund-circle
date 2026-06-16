"use client"

import { useState } from "react"
import { AlertTriangle, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency, formatDate, formatOrdinal } from "@/lib/format"
import SubmitLoanPaymentDialog from "./SubmitLoanPaymentDialog"
import VerifyLoanPaymentActions from "./VerifyLoanPaymentActions"

export interface InstallmentRow {
  id: string
  installmentNumber: number
  dueDate: string
  principalComponent: number
  interestComponent: number
  totalDue: number
  paidAmount: number
  lateFeeApplied: number
  status: string
}

export interface PendingLoanPayment {
  id: string
  amount: number
  paymentType: "regular" | "prepayment" | "foreclosure"
  prepaymentStrategy?: "reduce_emi" | "reduce_tenure" | null
  submittedByName?: string
}

function InstallmentStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "Pending",
    overdue: "Overdue",
    partially_paid: "Partial",
    paid: "Paid",
  }
  return (
    <div className="flex items-center gap-1.5">
      {status === "overdue" ? (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
      ) : (
        <span className={`inline-block w-2 h-2 rounded-full ${
          status === "paid" ? "bg-emerald-500" :
          status === "partially_paid" ? "bg-amber-500" :
          "bg-gray-300 dark:bg-gray-600"
        }`} />
      )}
      <span className="text-xs font-medium text-[var(--text-secondary)]">
        {labels[status] ?? status}
      </span>
    </div>
  )
}

export default function LoanInstallmentTable({
  installments,
  loanId,
  circleId,
  actorUserId,
  isLoanOwner,
  canManage,
  currentEMI,
  pendingByInstallment = {},
}: {
  installments: InstallmentRow[]
  loanId: string
  circleId: string
  actorUserId: string
  isLoanOwner: boolean
  canManage: boolean
  currentEMI: number
  pendingByInstallment?: Record<string, PendingLoanPayment>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (installments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[var(--text-muted)]">No installments scheduled yet.</p>
      </div>
    )
  }

  // Only the earliest installment that is neither paid nor has a pending payment can be submitted.
  // This mirrors bank loan behaviour: you must clear overdue instalments in order.
  const nextSubmittableId = installments.find(
    (inst) => inst.status !== "paid" && !pendingByInstallment[inst.id]
  )?.id

  const statusBorder = (status: string) => {
    switch (status) {
      case "paid": return "border-l-emerald-500"
      case "partially_paid": return "border-l-amber-500"
      case "overdue": return "border-l-amber-500"
      default: return "border-l-[var(--border-color)]"
    }
  }

  return (
    <div className="space-y-2">
      {installments.map((i) => {
        const isExpanded = expandedId === i.id
        const pending = pendingByInstallment[i.id]
        const canSubmit = isLoanOwner && i.id === nextSubmittableId

        return (
          <div
            key={i.id}
            className={cn(
              "rounded-xl border border-l-[3px] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] overflow-hidden transition-colors",
              statusBorder(i.status)
            )}
          >
            <div
              className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-[var(--border-light)]/60 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : i.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-[var(--text-primary)]">
                  {formatOrdinal(i.installmentNumber)} EMI
                </p>
                <InstallmentStatusBadge status={i.status} />
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold font-tabular text-[var(--text-primary)]">
                  {formatCurrency(i.paidAmount)}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] font-tabular">
                  of {formatCurrency(i.totalDue)}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-[var(--text-muted)] shrink-0 transition-transform",
                  isExpanded && "rotate-180"
                )}
              />
              <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center gap-1">
                {canManage && pending && (
                  <VerifyLoanPaymentActions
                    paymentId={pending.id}
                    circleId={circleId}
                    userId={actorUserId}
                    amount={pending.amount}
                    paymentType={pending.paymentType}
                    prepaymentStrategy={pending.prepaymentStrategy}
                    submittedByName={pending.submittedByName}
                  />
                )}
                {canSubmit && (
                  <SubmitLoanPaymentDialog
                    installmentId={i.id}
                    loanId={loanId}
                    circleId={circleId}
                    userId={actorUserId}
                    installmentNumber={i.installmentNumber}
                    currentEMI={currentEMI}
                  />
                )}
              </div>
            </div>
            {isExpanded && (
              <div className="px-3 pb-3 pt-0 border-t border-[var(--border-light)] mt-0">
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 pt-3 text-xs">
                  <div>
                    <span className="text-[var(--text-muted)]">Due: </span>
                    <span className="text-[var(--text-primary)]">{formatDate(i.dueDate)}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Principal: </span>
                    <span className="font-tabular text-[var(--text-primary)]">{formatCurrency(i.principalComponent)}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Interest: </span>
                    <span className="font-tabular text-[var(--text-primary)]">{formatCurrency(i.interestComponent)}</span>
                  </div>
                  {i.lateFeeApplied > 0 && (
                    <div>
                      <span className="text-[var(--text-muted)]">Late fee: </span>
                      <span className="font-tabular text-amber-600 dark:text-amber-400">{formatCurrency(i.lateFeeApplied)}</span>
                    </div>
                  )}
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
