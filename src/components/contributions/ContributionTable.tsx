"use client"

import { Fragment, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import ContributionStatusBadge from "./ContributionStatusBadge"
import RecordPaymentDialog from "./RecordPaymentDialog"
import { cn } from "@/lib/utils"
import { formatCurrency, formatISODate } from "@/lib/format"

interface Contribution {
  id: string
  userId: string
  userName: string
  expectedAmount: number
  paidAmount: number
  paymentDate: string | null
  notes: string | null
  status: string
}

export default function ContributionTable({
  contributions,
  circleId,
  currentUserId,
  canEdit,
  cycleClosed,
}: {
  contributions: Contribution[]
  contributionCycleId?: string
  circleId: string
  orgId?: string
  currentUserId: string
  canEdit: boolean
  cycleClosed: boolean
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
    <div className="overflow-x-auto -mx-6">
      <Table>
        <TableHeader>
          <TableRow className="border-[var(--border-light)]">
            <TableHead className="text-xs text-[var(--text-muted)] font-medium sticky left-0 bg-[var(--bg-surface)]">Member</TableHead>
            <TableHead className="text-xs text-[var(--text-muted)] font-medium hidden sm:table-cell">Expected</TableHead>
            <TableHead className="text-xs text-[var(--text-muted)] font-medium">Paid</TableHead>
            <TableHead className="text-xs text-[var(--text-muted)] font-medium">Status</TableHead>
            <TableHead className="text-xs text-[var(--text-muted)] font-medium hidden md:table-cell">Date</TableHead>
            {canEdit && !cycleClosed && (
              <TableHead className="text-xs text-[var(--text-muted)] font-medium w-10" />
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {contributions.map((c, i) => {
            const isExpanded = expandedId === c.id
            return (
              <Fragment key={c.id}>
                <TableRow
                  className={cn(
                    "border-l-[3px] transition-colors cursor-pointer",
                    statusBorder(c.status),
                    isExpanded ? "bg-[var(--border-light)]" : `hover:bg-[var(--border-light)] ${i % 2 === 0 ? "" : "bg-[var(--border-light)]/30"}`,
                  )}
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <TableCell className="py-3 sticky left-0 bg-inherit">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm text-[var(--text-primary)]">
                        {c.userName}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] sm:hidden font-tabular">
                        {formatCurrency(c.expectedAmount)} expected
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell font-tabular text-sm text-[var(--text-secondary)]">
                    {formatCurrency(c.expectedAmount)}
                  </TableCell>
                  <TableCell className="font-tabular text-sm font-semibold text-[var(--text-primary)]">
                    {formatCurrency(c.paidAmount)}
                  </TableCell>
                  <TableCell>
                    <ContributionStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-[var(--text-muted)]">
                    {formatISODate(c.paymentDate ?? "")}
                  </TableCell>
                  {canEdit && !cycleClosed && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <RecordPaymentDialog
                        contributionId={c.id}
                        circleId={circleId}
                        userId={currentUserId}
                        expectedAmount={c.expectedAmount}
                        currentPaid={c.paidAmount}
                      />
                    </TableCell>
                  )}
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell
                      colSpan={canEdit && !cycleClosed ? 6 : 5}
                      className="bg-[var(--border-light)] px-4 py-3"
                    >
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                        <div>
                          <span className="text-[var(--text-muted)]">Expected: </span>
                          <span className="font-tabular font-medium text-[var(--text-primary)]">
                            {formatCurrency(c.expectedAmount)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)]">Date: </span>
                          <span className="text-[var(--text-primary)]">
                            {formatISODate(c.paymentDate ?? "")}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)]">Notes: </span>
                          <span className="text-[var(--text-primary)]">
                            {c.notes ?? "—"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
