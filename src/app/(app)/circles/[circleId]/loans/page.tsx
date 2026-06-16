import Link from "next/link"
import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { getLoanEligibility } from "@/lib/actions"
import { monthsUntil } from "@/lib/loans"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import LoanReviewDialog from "@/components/loans/LoanReviewDialog"
import LoanCard, { type LoanCardData } from "@/components/loans/LoanCard"
import EligibilityWidget from "@/components/loans/EligibilityWidget"
import CancelLoanRequestButton from "@/components/loans/CancelLoanRequestButton"
import { formatCurrency } from "@/lib/format"
import { HandCoins, Plus } from "lucide-react"

export default async function LoansPage({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params
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

  const { data: circle } = await supabase
    .from("fund_circles")
    .select("loan_interest_rate_pct, end_date")
    .eq("id", circleId)
    .single()

  const maxTermMonths = circle?.end_date ? monthsUntil(circle.end_date) : undefined
  const fixedRatePct = Number(circle?.loan_interest_rate_pct ?? 0)

  const { data: myLoans } = await supabase
    .from("loans")
    .select("id, status, requested_amount, requested_term_months, approved_amount, approved_term_months, purpose, created_at")
    .eq("fund_circle_id", circleId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const blockingLoan = (myLoans ?? []).find((l) => l.status === "pending_request" || l.status === "active")
  const canRequestLoan = !blockingLoan
  const requestBlockedReason = blockingLoan?.status === "active"
    ? "You have an active loan. Repay it fully before requesting another."
    : blockingLoan?.status === "pending_request"
    ? "You have a pending request awaiting review. Cancel it first to submit a new one."
    : undefined

  const myLoanIds = (myLoans ?? []).map((l) => l.id)
  const { data: myInstallments } =
    myLoanIds.length > 0
      ? await supabase
          .from("loan_installments")
          .select("loan_id, installment_number, due_date, paid_amount, total_due")
          .in("loan_id", myLoanIds)
          .order("installment_number", { ascending: true })
      : { data: [] }

  const installmentsByLoan = new Map<string, { due_date: string; paid_amount: number; total_due: number }[]>()
  for (const installment of myInstallments ?? []) {
    const rows = installmentsByLoan.get(installment.loan_id) ?? []
    rows.push({
      due_date: installment.due_date,
      paid_amount: Number(installment.paid_amount),
      total_due: Number(installment.total_due),
    })
    installmentsByLoan.set(installment.loan_id, rows)
  }

  const myLoanCards: LoanCardData[] = (myLoans ?? []).map((loan) => {
    const installments = installmentsByLoan.get(loan.id) ?? []
    const totalDue = installments.reduce((sum, i) => sum + i.total_due, 0)
    const totalPaid = installments.reduce((sum, i) => sum + i.paid_amount, 0)
    const next = installments.find((i) => i.paid_amount < i.total_due)
    return {
      id: loan.id,
      status: loan.status,
      amount: Number(loan.approved_amount ?? loan.requested_amount),
      termMonths: loan.approved_term_months ?? loan.requested_term_months,
      totalDue,
      totalPaid,
      nextInstallment: next ? { dueDate: next.due_date, remaining: next.total_due - next.paid_amount } : undefined,
      purpose: loan.purpose,
      createdAt: loan.created_at,
    }
  })

  const pendingRequests: {
    id: string
    userId: string
    memberName: string
    requestedAmount: number
    requestedTermMonths: number
    purpose: string | null
    maxAmount: number
  }[] = []

  if (isAdminOrOwner(membership.role)) {
    const { data: loans } = await supabase
      .from("loans")
      .select("id, user_id, requested_amount, requested_term_months, purpose")
      .eq("fund_circle_id", circleId)
      .eq("status", "pending_request")
      .order("created_at", { ascending: true })

    const userIds = (loans ?? []).map((l) => l.user_id)
    const { data: profileRows } =
      userIds.length > 0 ? await supabase.from("profiles").select("id, name").in("id", userIds) : { data: [] }
    const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p.name]))

    for (const loan of loans ?? []) {
      const eligibility = await getLoanEligibility(circleId, loan.user_id)
      pendingRequests.push({
        id: loan.id,
        userId: loan.user_id,
        memberName: profileMap.get(loan.user_id) ?? "Unknown",
        requestedAmount: Number(loan.requested_amount),
        requestedTermMonths: loan.requested_term_months,
        purpose: loan.purpose,
        maxAmount: eligibility.success ? eligibility.data.eligibleAmount : 0,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Loans</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Request a loan or review pending requests.</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {canRequestLoan ? (
            <Button asChild>
              <Link href={`/circles/${circleId}/loans/new`}>
                <Plus className="h-4 w-4" />
                Request Loan
              </Link>
            </Button>
          ) : (
            <Button disabled>
              <Plus className="h-4 w-4" />
              Request Loan
            </Button>
          )}
          {requestBlockedReason && (
            <p className="text-xs text-[var(--text-muted)] text-right max-w-[220px]">{requestBlockedReason}</p>
          )}
        </div>
      </div>

      {/* Eligibility + active loans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <EligibilityWidget circleId={circleId} userId={user.id} />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">My Loans</h3>
          {myLoanCards.filter((l) => l.status === "active").length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="No active loans"
              description="Request a loan against your contributions whenever you need it."
              action={canRequestLoan ? { label: "Request Loan", href: `/circles/${circleId}/loans/new` } : undefined}
            />
          ) : (
            <div className="space-y-3">
              {myLoanCards
                .filter((l) => l.status === "active")
                .map((loan) => (
                  <LoanCard key={loan.id} circleId={circleId} loan={loan} />
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Own pending request — visible to all members */}
      {myLoanCards.some((l) => l.status === "pending_request") && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">My Pending Request</h3>
          <div className="space-y-3">
            {myLoanCards
              .filter((l) => l.status === "pending_request")
              .map((loan) => (
                <div
                  key={loan.id}
                  className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-surface)] p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text-primary)] truncate">
                      {formatCurrency(loan.amount)} &middot; {loan.termMonths} months
                    </p>
                    {loan.purpose && <p className="text-xs text-[var(--text-muted)] truncate">{loan.purpose}</p>}
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Submitted {loan.createdAt ? new Date(loan.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""} · awaiting admin review</p>
                  </div>
                  <CancelLoanRequestButton loanId={loan.id} userId={user.id} circleId={circleId} />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Admin: other members' pending requests */}
      {isAdminOrOwner(membership.role) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Pending Requests</h3>
          {pendingRequests.filter((l) => l.userId !== user.id).length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="No pending requests"
              description="Loan requests submitted by members will appear here for review."
            />
          ) : (
            <div className="space-y-3">
              {pendingRequests
                .filter((l) => l.userId !== user.id)
                .map((loan) => (
                  <div
                    key={loan.id}
                    className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-surface)] p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text-primary)] truncate">{loan.memberName}</p>
                      <p className="text-sm font-tabular font-medium text-[var(--text-primary)]">
                        {formatCurrency(loan.requestedAmount)} &middot; {loan.requestedTermMonths} months
                      </p>
                      {loan.purpose && <p className="text-xs text-[var(--text-muted)] truncate">{loan.purpose}</p>}
                    </div>
                    <LoanReviewDialog
                      loanId={loan.id}
                      circleId={circleId}
                      actorUserId={user.id}
                      memberName={loan.memberName}
                      requestedAmount={loan.requestedAmount}
                      requestedTermMonths={loan.requestedTermMonths}
                      purpose={loan.purpose}
                      fixedRatePct={fixedRatePct}
                      maxAmount={loan.maxAmount}
                      maxTermMonths={maxTermMonths}
                    />
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
