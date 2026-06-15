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

  const pendingRequests: {
    id: string
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Loans</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Request a loan or review pending requests.</p>
        </div>
        <Button asChild>
          <Link href={`/circles/${circleId}/loans/new`}>
            <Plus className="h-4 w-4" />
            Request Loan
          </Link>
        </Button>
      </div>

      {isAdminOrOwner(membership.role) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Pending Requests</h3>
          {pendingRequests.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="No pending requests"
              description="Loan requests submitted by members will appear here for review."
            />
          ) : (
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
          )}
        </div>
      )}
    </div>
  )
}
