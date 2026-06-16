import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { getLoanEligibility } from "@/lib/actions"
import { monthsUntil } from "@/lib/loans"
import EligibilityWidget from "@/components/loans/EligibilityWidget"
import LoanRequestForm from "@/components/loans/LoanRequestForm"

export default async function LoanRequestPage({ params }: { params: Promise<{ circleId: string }> }) {
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
  if (!circle) redirect(`/circles/${circleId}/dashboard`)

  const eligibility = await getLoanEligibility(circleId, user.id)
  const maxAmount = eligibility.success ? eligibility.data.eligibleAmount : 0
  const maxTermMonths = circle.end_date ? monthsUntil(circle.end_date) : undefined

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Request a Loan</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Choose an amount and term within your eligibility — the EMI updates as you adjust them.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <EligibilityWidget circleId={circleId} userId={user.id} />

        <LoanRequestForm
          circleId={circleId}
          userId={user.id}
          fixedRatePct={Number(circle.loan_interest_rate_pct)}
          maxAmount={maxAmount}
          maxTermMonths={maxTermMonths}
        />
      </div>
    </div>
  )
}
