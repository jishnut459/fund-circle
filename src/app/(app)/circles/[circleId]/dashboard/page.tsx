import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { resolveEffectiveRole, getViewPreference } from "@/lib/view-mode"
import OwnerDashboard from "@/components/dashboard/OwnerDashboard"
import MemberDashboard from "@/components/dashboard/MemberDashboard"
import { ensureCurrentCycle } from "@/lib/ensure-cycle"
import { getLoanEligibility } from "@/lib/actions"

export default async function CircleDashboardPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
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

  await ensureCurrentCycle(circleId, user.id)

  const role = resolveEffectiveRole(membership.role, await getViewPreference(circleId))

  const { data: circle } = await supabase
    .from("fund_circles")
    .select("name, contribution_amount, contribution_frequency, end_date")
    .eq("id", circleId)
    .single()

  const { count: memberCount } = await supabase
    .from("fund_circle_members")
    .select("*", { count: "exact", head: true })
    .eq("fund_circle_id", circleId)
    .eq("active", true)

  const circleMeta = {
    name: circle?.name ?? "",
    amount: Number(circle?.contribution_amount ?? 0),
    frequency: circle?.contribution_frequency ?? "monthly",
    memberCount: memberCount ?? 0,
  }

  const [eligibilityResult, { data: settlementRow }] = await Promise.all([
    getLoanEligibility(circleId, user.id),
    supabase
      .from("circle_settlements")
      .select("status")
      .eq("fund_circle_id", circleId)
      .maybeSingle(),
  ])
  const settlementStatus = settlementRow?.status ?? null
  const endDate = circle?.end_date ?? null
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const showSettlementBanner = endDate && settlementStatus !== "finalized"
    ? Math.ceil((new Date(endDate).getTime() - nowMs) / 86400000) <= 30
    : false
  const endDatePassed = endDate ? new Date(endDate).getTime() < nowMs : false
  const fundsSummary = eligibilityResult.success
    ? eligibilityResult.data
    : {
        totalContributionsPaid: 0,
        totalContributionsCollected: 0,
        assetsValue: 0,
        lendingPoolAvailable: 0,
        totalPrincipalOutstanding: 0,
        activeLoanCount: 0,
        outstandingPrincipal: 0,
        maxByContribution: 0,
        maxByPool: 0,
        eligibleAmount: 0,
        totalDisbursed: 0,
        totalRepaid: 0,
      }

  // Interest income = everything repaid beyond the principal that has come back.
  // (repaid principal = total disbursed − principal still outstanding.)
  const interestEarned = Math.max(
    0,
    fundsSummary.totalRepaid - (fundsSummary.totalDisbursed - fundsSummary.totalPrincipalOutstanding)
  )

  if (isAdminOrOwner(role)) {
    const { data: allCycles } = await supabase
      .from("contribution_cycles")
      .select("id, label, status, contributions(paid_amount, expected_amount)")
      .eq("fund_circle_id", circleId)
      .order("cycle_start", { ascending: false })
      .limit(6)

    const recentCycles = (allCycles ?? []).map((c) => {
      const ct = c.contributions as Array<{ paid_amount: number; expected_amount: number }> | undefined
      const te = ct?.reduce((s, x) => s + Number(x.expected_amount), 0) ?? 0
      const tp = ct?.reduce((s, x) => s + Number(x.paid_amount), 0) ?? 0
      const pc = ct?.filter((x) => Number(x.paid_amount) >= Number(x.expected_amount)).length ?? 0
      const partc = ct?.filter((x) => Number(x.paid_amount) > 0 && Number(x.paid_amount) < Number(x.expected_amount)).length ?? 0
      const uc = ct?.filter((x) => Number(x.paid_amount) === 0).length ?? 0
      return { id: c.id, label: c.label, circleId, circleName: "", totalExpected: te, totalPaid: tp, status: c.status, paidCount: pc, partialCount: partc, unpaidCount: uc }
    })

    return (
      <OwnerDashboard
        data={{
          totalCollected: fundsSummary.totalContributionsCollected,
          recentCycles,
          circleId,
          lendingPoolAvailable: fundsSummary.lendingPoolAvailable,
          assetsValue: fundsSummary.assetsValue,
          totalPrincipalOutstanding: fundsSummary.totalPrincipalOutstanding,
          activeLoanCount: fundsSummary.activeLoanCount,
          interestEarned,
          endDate,
          settlementStatus,
          showSettlementBanner,
          endDatePassed,
        }}
      />
    )
  }

  const { data: myContributions } = await supabase
    .from("contributions_with_status")
    .select("id, contribution_cycle_id, expected_amount, paid_amount, status, contribution_cycles!inner(label, due_date, cycle_start, fund_circle_id)")
    .eq("user_id", user.id)
    .eq("contribution_cycles.fund_circle_id", circleId)

  // PostgREST can't order parent rows by an embedded table's column, so sort
  // here: latest cycle first (newest on top, and currentCycle = cycles[0]).
  const cycles = (myContributions ?? [])
    .map((c) => {
      const cycle = c.contribution_cycles as unknown as { label: string; due_date: string | null; cycle_start: string; fund_circle_id: string }
      return {
        id: c.id,
        label: cycle.label,
        circleId: cycle.fund_circle_id,
        circleName: "",
        dueDate: cycle.due_date,
        cycleStart: cycle.cycle_start,
        expectedAmount: Number(c.expected_amount),
        paidAmount: Number(c.paid_amount),
        status: c.status,
      }
    })
    .sort((a, b) => (a.cycleStart < b.cycleStart ? 1 : a.cycleStart > b.cycleStart ? -1 : 0))

  const totalPaid = cycles.reduce((s, c) => s + c.paidAmount, 0)
  const totalExpected = cycles.reduce((s, c) => s + c.expectedAmount, 0)

  const currentCycle = cycles.length > 0 ? cycles[0] : null

  return (
    <MemberDashboard
      data={{
        circleMeta,
        totalPaid,
        totalExpected,
        currentCycle,
        cycles,
        circleId,
        lendingPoolAvailable: fundsSummary.lendingPoolAvailable,
        assetsValue: fundsSummary.assetsValue,
        myOutstandingLoan: fundsSummary.outstandingPrincipal,
        myLoanEligibility: fundsSummary.eligibleAmount,
        totalPrincipalOutstanding: fundsSummary.totalPrincipalOutstanding,
        interestEarned,
        totalContributionsCollected: fundsSummary.totalContributionsCollected,
        endDate,
        settlementStatus,
        showSettlementBanner,
        endDatePassed,
      }}
    />
  )
}
