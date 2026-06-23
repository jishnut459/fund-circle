import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { getLoanEligibility } from "@/lib/actions"
import { monthsUntil } from "@/lib/loans"
import LoanReviewDialog from "@/components/loans/LoanReviewDialog"
import LoanCard, { type LoanCardData } from "@/components/loans/LoanCard"
import EligibilityWidget from "@/components/loans/EligibilityWidget"
import CancelLoanRequestButton from "@/components/loans/CancelLoanRequestButton"
import RequestLoanButton from "@/components/loans/RequestLoanButton"
import RequestLoanForMemberDialog, { type PickableMember } from "@/components/loans/RequestLoanForMemberDialog"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency } from "@/lib/format"
import { HandCoins } from "lucide-react"

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
  const isAdmin = isAdminOrOwner(membership.role)

  // My loans
  const { data: myLoans } = await supabase
    .from("loans")
    .select("id, status, requested_amount, requested_term_months, approved_amount, approved_term_months, purpose, created_at")
    .eq("fund_circle_id", circleId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const blockingLoan = (myLoans ?? []).find((l) => l.status === "pending_request" || l.status === "active")
  const hasActiveLoan = (myLoans ?? []).some((l) => l.status === "active")
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
          .select("loan_id, due_date, paid_amount, total_due")
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

  // Admin: all other members' active loans + pending requests
  const pendingRequests: {
    id: string
    userId: string
    memberName: string
    requestedAmount: number
    requestedTermMonths: number
    purpose: string | null
    maxAmount: number
  }[] = []

  const allActiveLoanCards: LoanCardData[] = []

  // Members an admin can open a loan request for (everyone but themselves).
  let pickableMembers: PickableMember[] = []

  if (isAdmin) {
    const { data: memberRows } = await supabase
      .from("fund_circle_members")
      .select("user_id")
      .eq("fund_circle_id", circleId)
      .eq("active", true)
      .neq("user_id", user.id)
    const memberUserIds = (memberRows ?? []).map((m) => m.user_id)
    const { data: memberProfiles } =
      memberUserIds.length > 0
        ? await supabase.from("profiles").select("id, name, is_managed").in("id", memberUserIds)
        : { data: [] }
    const memberProfileMap = new Map((memberProfiles ?? []).map((p) => [p.id, p]))
    pickableMembers = memberUserIds.map((id) => ({
      id,
      name: memberProfileMap.get(id)?.name ?? "Unknown",
      isManaged: memberProfileMap.get(id)?.is_managed ?? false,
    }))

    // Pending requests from other members
    const { data: pendingLoans } = await supabase
      .from("loans")
      .select("id, user_id, requested_amount, requested_term_months, purpose")
      .eq("fund_circle_id", circleId)
      .eq("status", "pending_request")
      .neq("user_id", user.id)
      .order("created_at", { ascending: true })

    const pendingUserIds = (pendingLoans ?? []).map((l) => l.user_id)
    const { data: pendingProfiles } =
      pendingUserIds.length > 0
        ? await supabase.from("profiles").select("id, name").in("id", pendingUserIds)
        : { data: [] }
    const pendingProfileMap = new Map((pendingProfiles ?? []).map((p) => [p.id, p.name]))

    for (const loan of pendingLoans ?? []) {
      const eligibility = await getLoanEligibility(circleId, loan.user_id)
      pendingRequests.push({
        id: loan.id,
        userId: loan.user_id,
        memberName: pendingProfileMap.get(loan.user_id) ?? "Unknown",
        requestedAmount: Number(loan.requested_amount),
        requestedTermMonths: loan.requested_term_months,
        purpose: loan.purpose,
        maxAmount: eligibility.success ? eligibility.data.eligibleAmount : 0,
      })
    }

    // All active loans from all members
    const { data: activeLoans } = await supabase
      .from("loans")
      .select("id, user_id, approved_amount, approved_term_months, purpose, created_at")
      .eq("fund_circle_id", circleId)
      .eq("status", "active")
      .order("created_at", { ascending: false })

    const activeLoanIds = (activeLoans ?? []).map((l) => l.id)
    const activeUserIds = [...new Set((activeLoans ?? []).map((l) => l.user_id))]

    const [{ data: activeInstallments }, { data: activeProfiles }] = await Promise.all([
      activeLoanIds.length > 0
        ? supabase
            .from("loan_installments")
            .select("loan_id, due_date, paid_amount, total_due")
            .in("loan_id", activeLoanIds)
            .order("installment_number", { ascending: true })
        : { data: [] },
      activeUserIds.length > 0
        ? supabase.from("profiles").select("id, name").in("id", activeUserIds)
        : { data: [] },
    ])

    const activeInstallmentsByLoan = new Map<string, { due_date: string; paid_amount: number; total_due: number }[]>()
    for (const inst of activeInstallments ?? []) {
      const rows = activeInstallmentsByLoan.get(inst.loan_id) ?? []
      rows.push({ due_date: inst.due_date, paid_amount: Number(inst.paid_amount), total_due: Number(inst.total_due) })
      activeInstallmentsByLoan.set(inst.loan_id, rows)
    }
    const activeProfileMap = new Map((activeProfiles ?? []).map((p) => [p.id, p.name]))

    for (const loan of activeLoans ?? []) {
      const installments = activeInstallmentsByLoan.get(loan.id) ?? []
      const totalDue = installments.reduce((sum, i) => sum + i.total_due, 0)
      const totalPaid = installments.reduce((sum, i) => sum + i.paid_amount, 0)
      const next = installments.find((i) => i.paid_amount < i.total_due)
      allActiveLoanCards.push({
        id: loan.id,
        status: "active",
        amount: Number(loan.approved_amount),
        termMonths: loan.approved_term_months,
        totalDue,
        totalPaid,
        nextInstallment: next ? { dueDate: next.due_date, remaining: next.total_due - next.paid_amount } : undefined,
        purpose: loan.purpose,
        createdAt: loan.created_at,
        memberName: activeProfileMap.get(loan.user_id) ?? "Unknown",
      })
    }
  }

  const myActiveLoans = myLoanCards.filter((l) => l.status === "active")
  const myPendingLoans = myLoanCards.filter((l) => l.status === "pending_request")
  // Admin view: all circle loans minus own (own are shown in My Loans)
  const otherActiveLoans = allActiveLoanCards.filter((l) => !myLoanIds.includes(l.id))

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Loans</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {isAdmin ? "Manage loan requests and track active loans." : "Request a loan or track your repayments."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <RequestLoanForMemberDialog
              circleId={circleId}
              actorUserId={user.id}
              members={pickableMembers}
              maxTermMonths={maxTermMonths}
            />
          )}
          <RequestLoanButton
            href={`/circles/${circleId}/loans/new`}
            disabled={!canRequestLoan}
            disabledReason={requestBlockedReason}
          />
        </div>
      </div>

      {/* My Loans — shown first, always */}
      {(myActiveLoans.length > 0 || myPendingLoans.length > 0) && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">My Loans</h3>
          <div className="space-y-3">
            {myActiveLoans.map((loan) => (
              <LoanCard key={loan.id} circleId={circleId} loan={loan} />
            ))}
            {myPendingLoans.map((loan) => (
              <LoanCard
                key={loan.id}
                circleId={circleId}
                loan={loan}
                actions={<CancelLoanRequestButton loanId={loan.id} userId={user.id} circleId={circleId} />}
              />
            ))}
          </div>
        </section>
      )}

      {/* Eligibility — only shown when member can actually take a new loan */}
      {!hasActiveLoan && (
        <EligibilityWidget circleId={circleId} userId={user.id} />
      )}

      {/* My past loans (closed / rejected / cancelled) */}
      {myLoanCards.filter((l) => ["closed", "rejected", "cancelled"].includes(l.status)).length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Past Loans</h3>
          <div className="space-y-3">
            {myLoanCards
              .filter((l) => ["closed", "rejected", "cancelled"].includes(l.status))
              .map((loan) => (
                <LoanCard key={loan.id} circleId={circleId} loan={loan} />
              ))}
          </div>
        </section>
      )}

      {/* Admin: other members' active loans */}
      {isAdmin && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Active Loans</h3>
          {otherActiveLoans.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="No active loans"
              description="No other members have active loans right now."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {otherActiveLoans.map((loan) => (
                <LoanCard key={loan.id} circleId={circleId} loan={loan} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Admin: pending requests from other members */}
      {isAdmin && pendingRequests.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Pending Requests</h3>
          <div className="space-y-3">
            {pendingRequests.map((loan) => (
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
        </section>
      )}

      {/* Empty state for non-admin with no loans at all */}
      {!isAdmin && myLoanCards.length === 0 && (
        <EmptyState
          icon={HandCoins}
          title="No loans yet"
          description="Request a loan from the circle's lending pool. Your eligibility is based on your contributions."
        />
      )}
    </div>
  )
}
