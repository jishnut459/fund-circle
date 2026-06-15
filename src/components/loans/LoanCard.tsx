import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import LoanStatusBadge from "@/components/loans/LoanStatusBadge"
import { formatCurrency, formatDate, formatPercentage } from "@/lib/format"

export interface LoanCardData {
  id: string
  status: string
  amount: number
  termMonths: number
  totalDue: number
  totalPaid: number
  nextInstallment?: { dueDate: string; remaining: number }
  purpose: string | null
  createdAt: string
}

export default function LoanCard({ circleId, loan }: { circleId: string; loan: LoanCardData }) {
  const progress = loan.totalDue > 0 ? formatPercentage(loan.totalPaid, loan.totalDue) : 0
  const showProgress = (loan.status === "active" || loan.status === "closed") && loan.totalDue > 0

  return (
    <Link href={`/circles/${circleId}/loans/${loan.id}`}>
      <Card className="cursor-pointer hover:shadow-[var(--shadow-card-hover)] hover:border-teal/20 transition-all active:scale-[0.99]">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-2xl font-bold font-tabular text-[var(--text-primary)]">
                {formatCurrency(loan.amount)}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                {loan.termMonths} months{loan.purpose ? ` · ${loan.purpose}` : ""}
              </p>
            </div>
            <LoanStatusBadge status={loan.status} />
          </div>

          {showProgress && (
            <div className="pt-3 border-t border-[var(--border-light)]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-[var(--text-muted)]">Repaid</span>
                <span className="text-[11px] font-medium text-teal">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
                <div className="h-full bg-teal rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5 font-tabular">
                {formatCurrency(loan.totalPaid)} / {formatCurrency(loan.totalDue)} repaid
              </p>
              {loan.nextInstallment && (
                <p className="text-xs text-[var(--text-secondary)] mt-2">
                  Next EMI{" "}
                  <span className="font-tabular font-medium text-[var(--text-primary)]">
                    {formatCurrency(loan.nextInstallment.remaining)}
                  </span>{" "}
                  due {formatDate(loan.nextInstallment.dueDate)}
                </p>
              )}
            </div>
          )}

          {loan.status === "pending_request" && (
            <p className="text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border-light)] mt-3">
              Submitted {formatDate(loan.createdAt)} &middot; awaiting review
            </p>
          )}

          {(loan.status === "rejected" || loan.status === "cancelled") && (
            <p className="text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border-light)] mt-3">
              Requested {formatDate(loan.createdAt)}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
