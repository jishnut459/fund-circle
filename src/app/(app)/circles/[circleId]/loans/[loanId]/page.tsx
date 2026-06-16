import Link from "next/link"
import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { calculateEMI } from "@/lib/loans"
import { Card, CardContent } from "@/components/ui/card"
import LoanStatusBadge from "@/components/loans/LoanStatusBadge"
import LoanInstallmentTable, { type InstallmentRow } from "@/components/loans/LoanInstallmentTable"
import CancelLoanRequestButton from "@/components/loans/CancelLoanRequestButton"
import { formatCurrency, formatDate, formatPercentage } from "@/lib/format"
import { ArrowLeft } from "lucide-react"

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ circleId: string; loanId: string }>
}) {
  const { circleId, loanId } = await params
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const supabase = createAdminSupabaseClient()

  const { data: membership } = await supabase
    .from("fund_circle_members")
    .select("role")
    .eq("fund_circle_id", circleId)
    .eq("user_id", user.id)
    .eq("active", true)
    .single()
  if (!membership) redirect("/circles")

  const { data: loan } = await supabase
    .from("loans")
    .select(
      "id, fund_circle_id, user_id, status, requested_amount, requested_term_months, approved_amount, approved_term_months, interest_rate_pct, purpose, created_at, issued_at"
    )
    .eq("id", loanId)
    .single()

  if (!loan || loan.fund_circle_id !== circleId) redirect(`/circles/${circleId}/loans`)

  const canManage = isAdminOrOwner(membership.role)
  if (loan.user_id !== user.id && !canManage) redirect(`/circles/${circleId}/loans`)

  let memberName: string | null = null
  if (loan.user_id !== user.id) {
    const { data: profile } = await supabase.from("profiles").select("name").eq("id", loan.user_id).single()
    memberName = profile?.name ?? null
  }

  const { data: rawInstallments } = await supabase
    .from("loan_installments_with_status")
    .select("id, installment_number, due_date, principal_component, interest_component, total_due, paid_amount, late_fee_applied, status")
    .eq("loan_id", loanId)
    .order("installment_number", { ascending: true })

  const installments: InstallmentRow[] = (rawInstallments ?? []).map((i) => ({
    id: i.id,
    installmentNumber: i.installment_number,
    dueDate: i.due_date,
    principalComponent: Number(i.principal_component),
    interestComponent: Number(i.interest_component),
    totalDue: Number(i.total_due),
    paidAmount: Number(i.paid_amount),
    lateFeeApplied: Number(i.late_fee_applied),
    status: i.status,
  }))

  const amount = Number(loan.approved_amount ?? loan.requested_amount)
  const termMonths = loan.approved_term_months ?? loan.requested_term_months
  const totalDue = installments.reduce((sum, i) => sum + i.totalDue, 0)
  const totalPaid = installments.reduce((sum, i) => sum + i.paidAmount, 0)
  const progress = totalDue > 0 ? formatPercentage(totalPaid, totalDue) : 0

  const emi =
    (loan.status === "active" || loan.status === "closed") && loan.interest_rate_pct != null
      ? calculateEMI(amount, Number(loan.interest_rate_pct), termMonths)
      : undefined

  const canRecordPayment = canManage && loan.status === "active"
  const canCancelRequest = loan.user_id === user.id && loan.status === "pending_request"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/circles/${circleId}/loans`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Loans
        </Link>
        {canCancelRequest && (
          <CancelLoanRequestButton loanId={loanId} userId={user.id} circleId={circleId} />
        )}
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {memberName && (
                <p className="text-sm text-[var(--text-muted)] mb-0.5 truncate">{memberName}</p>
              )}
              <p className="text-3xl font-bold font-tabular text-[var(--text-primary)]">
                {formatCurrency(amount)}
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                {termMonths} months
                {loan.interest_rate_pct != null && ` · ${loan.interest_rate_pct}% p.a.`}
                {loan.purpose ? ` · ${loan.purpose}` : ""}
              </p>
            </div>
            <LoanStatusBadge status={loan.status} />
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1.5 pt-3 border-t border-[var(--border-light)] text-sm">
            {emi !== undefined && (
              <div>
                <span className="text-[var(--text-muted)]">EMI: </span>
                <span className="font-tabular font-medium text-[var(--text-primary)]">{formatCurrency(emi)}</span>
              </div>
            )}
            <div>
              <span className="text-[var(--text-muted)]">Requested: </span>
              <span className="text-[var(--text-primary)]">{formatDate(loan.created_at)}</span>
            </div>
            {loan.issued_at && (
              <div>
                <span className="text-[var(--text-muted)]">Issued: </span>
                <span className="text-[var(--text-primary)]">{formatDate(loan.issued_at)}</span>
              </div>
            )}
          </div>

          {totalDue > 0 && (
            <div className="pt-3 border-t border-[var(--border-light)]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[var(--text-muted)]">Repaid</span>
                <span className="text-xs font-medium text-teal">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
                <div className="h-full bg-teal rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1.5 font-tabular">
                {formatCurrency(totalPaid)} / {formatCurrency(totalDue)} repaid
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Repayment Schedule</h3>
        <LoanInstallmentTable
          installments={installments}
          circleId={circleId}
          actorUserId={user.id}
          canRecordPayment={canRecordPayment}
        />
      </div>
    </div>
  )
}
