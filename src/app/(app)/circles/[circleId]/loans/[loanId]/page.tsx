import Link from "next/link"
import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { calculateAccruedInterest, calculateEMI, calculateOutstandingPrincipal } from "@/lib/loans"
import { toISODate } from "@/lib/cycles"
import { Card, CardContent } from "@/components/ui/card"
import LoanStatusBadge from "@/components/loans/LoanStatusBadge"
import LoanInstallmentTable, { type InstallmentRow, type PendingLoanPayment } from "@/components/loans/LoanInstallmentTable"
import CancelLoanRequestButton from "@/components/loans/CancelLoanRequestButton"
import ForeclosureDialog from "@/components/loans/ForeclosureDialog"
import VerifyLoanPaymentActions from "@/components/loans/VerifyLoanPaymentActions"
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

  const isLoanOwner = loan.user_id === user.id

  let memberName: string | null = null
  if (!isLoanOwner) {
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

  // Fetch pending payments for this loan (regular installment-level)
  const installmentIds = installments.map((i) => i.id)
  const [{ data: pendingInstallmentPayments }, { data: pendingLoanLevelPayments }] = await Promise.all([
    installmentIds.length > 0
      ? supabase
          .from("loan_payments")
          .select("id, loan_installment_id, amount, payment_type, prepayment_strategy, submitted_by")
          .in("loan_installment_id", installmentIds)
          .eq("status", "pending")
      : Promise.resolve({ data: [] }),
    supabase
      .from("loan_payments")
      .select("id, loan_id, amount, payment_type, prepayment_strategy, submitted_by")
      .eq("loan_id", loanId)
      .eq("status", "pending")
      .in("payment_type", ["prepayment", "foreclosure"]),
  ])

  // Resolve submitter names
  const submitterIds = [
    ...new Set([
      ...(pendingInstallmentPayments ?? []).map((p) => p.submitted_by),
      ...(pendingLoanLevelPayments ?? []).map((p) => p.submitted_by),
    ].filter(Boolean) as string[])
  ]
  const { data: submitterProfiles } = submitterIds.length > 0
    ? await supabase.from("profiles").select("id, name").in("id", submitterIds)
    : { data: [] }
  const submitterMap = new Map((submitterProfiles ?? []).map((p) => [p.id, p.name]))

  const pendingByInstallment: Record<string, PendingLoanPayment> = {}
  for (const p of pendingInstallmentPayments ?? []) {
    if (p.loan_installment_id) {
      pendingByInstallment[p.loan_installment_id] = {
        id: p.id,
        amount: Number(p.amount),
        paymentType: p.payment_type as "regular",
        submittedByName: p.submitted_by ? submitterMap.get(p.submitted_by) ?? undefined : undefined,
      }
    }
  }

  const pendingLoanLevel = (pendingLoanLevelPayments ?? [])[0] ?? null
  const pendingLoanLevelEntry: PendingLoanPayment | null = pendingLoanLevel
    ? {
        id: pendingLoanLevel.id,
        amount: Number(pendingLoanLevel.amount),
        paymentType: pendingLoanLevel.payment_type as "prepayment" | "foreclosure",
        prepaymentStrategy: pendingLoanLevel.prepayment_strategy as "reduce_emi" | "reduce_tenure" | null,
        submittedByName: pendingLoanLevel.submitted_by
          ? submitterMap.get(pendingLoanLevel.submitted_by) ?? undefined
          : undefined,
      }
    : null

  const amount = Number(loan.approved_amount ?? loan.requested_amount)
  const termMonths = loan.approved_term_months ?? loan.requested_term_months
  const totalDue = installments.reduce((sum, i) => sum + i.totalDue, 0)
  const totalPaid = installments.reduce((sum, i) => sum + i.paidAmount, 0)
  const progress = totalDue > 0 ? formatPercentage(totalPaid, totalDue) : 0

  const emi =
    (loan.status === "active" || loan.status === "closed") && loan.interest_rate_pct != null
      ? calculateEMI(amount, Number(loan.interest_rate_pct), termMonths)
      : undefined

  const todayIso = toISODate(new Date())
  const outstandingPrincipal = calculateOutstandingPrincipal(installments)
  const accruedInterest = calculateAccruedInterest(
    installments.map((i) => ({ ...i, dueDate: i.dueDate })),
    todayIso
  )

  const canCancelRequest = isLoanOwner && loan.status === "pending_request"
  const canForeclose = isLoanOwner && loan.status === "active" && !pendingLoanLevelEntry
  // Admin override: foreclose on behalf of a member (applied immediately)
  const canAdminForeclose = canManage && !isLoanOwner && loan.status === "active" && !pendingLoanLevelEntry

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
        <div className="flex items-center gap-2">
          {canCancelRequest && (
            <CancelLoanRequestButton loanId={loanId} userId={user.id} circleId={circleId} />
          )}
          {canForeclose && (
            <ForeclosureDialog
              loanId={loanId}
              circleId={circleId}
              userId={user.id}
              outstandingPrincipal={outstandingPrincipal}
              accruedInterest={accruedInterest}
            />
          )}
          {canAdminForeclose && (
            <ForeclosureDialog
              loanId={loanId}
              circleId={circleId}
              userId={user.id}
              outstandingPrincipal={outstandingPrincipal}
              accruedInterest={accruedInterest}
              mode="admin"
              memberName={memberName ?? undefined}
            />
          )}
        </div>
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

      {/* Pending prepayment or foreclosure (loan-level) — admin verification */}
      {canManage && pendingLoanLevelEntry && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <div className="flex-1 text-sm text-amber-800 dark:text-amber-200">
            <span className="font-medium capitalize">{pendingLoanLevelEntry.paymentType}</span> of{" "}
            <span className="font-tabular font-semibold">{formatCurrency(pendingLoanLevelEntry.amount)}</span>{" "}
            pending verification
            {pendingLoanLevelEntry.prepaymentStrategy && (
              <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">
                · {pendingLoanLevelEntry.prepaymentStrategy === "reduce_emi" ? "Reduce EMI" : "Reduce Tenure"}
              </span>
            )}
          </div>
          <VerifyLoanPaymentActions
            paymentId={pendingLoanLevelEntry.id}
            circleId={circleId}
            userId={user.id}
            amount={pendingLoanLevelEntry.amount}
            paymentType={pendingLoanLevelEntry.paymentType}
            prepaymentStrategy={pendingLoanLevelEntry.prepaymentStrategy}
            submittedByName={pendingLoanLevelEntry.submittedByName}
          />
        </div>
      )}

      {/* Pending loan-level payment visible to loan owner */}
      {!canManage && pendingLoanLevelEntry && (
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
          Your <span className="font-medium capitalize">{pendingLoanLevelEntry.paymentType}</span> of{" "}
          <span className="font-tabular font-semibold">{formatCurrency(pendingLoanLevelEntry.amount)}</span>{" "}
          is pending admin verification.
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Repayment Schedule</h3>
        <LoanInstallmentTable
          installments={installments}
          loanId={loanId}
          circleId={circleId}
          actorUserId={user.id}
          isLoanOwner={isLoanOwner}
          canManage={canManage}
          currentEMI={emi ?? 0}
          memberName={memberName ?? undefined}
          pendingByInstallment={pendingByInstallment}
        />
      </div>
    </div>
  )
}
