import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calculator, Landmark, PlusCircle, Users } from "lucide-react"
import { roundCurrency } from "@/lib/loans"
import AssetRecordList from "@/components/settlement/AssetRecordList"
import AssetRecordForm from "@/components/settlement/AssetRecordForm"
import SettlementSummary from "@/components/settlement/SettlementSummary"
import SettlementPayoutTable from "@/components/settlement/SettlementPayoutTable"
import type { CycleAssetRecord } from "@/lib/types"
import type { SettlementPayoutRow } from "@/components/settlement/SettlementPayoutTable"

export default async function CircleSettlementPage({
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

  const canManage = isAdminOrOwner(membership.role)

  // Asset records
  const { data: rawRecords } = await supabase
    .from("cycle_asset_records")
    .select("id, contribution_cycle_id, asset_type, institution, amount, current_value, notes, recorded_by, recorded_at")
    .eq("fund_circle_id", circleId)
    .order("recorded_at", { ascending: false })

  const recorderIds = [...new Set((rawRecords ?? []).map((r) => r.recorded_by))]

  const [{ data: recorderProfiles }, { data: cycleRows }] = await Promise.all([
    supabase.from("profiles").select("id, name").in("id", recorderIds.length > 0 ? recorderIds : ["none"]),
    supabase.from("contribution_cycles").select("id").eq("fund_circle_id", circleId),
  ])

  const profileMap = new Map(recorderProfiles?.map((p) => [p.id, p.name]) ?? [])

  const records: CycleAssetRecord[] = (rawRecords ?? []).map((r) => ({
    id: r.id,
    contributionCycleId: r.contribution_cycle_id,
    assetType: r.asset_type as CycleAssetRecord["assetType"],
    institution: r.institution,
    amount: Number(r.amount),
    currentValue: r.current_value !== null ? Number(r.current_value) : null,
    notes: r.notes,
    recordedByName: profileMap.get(r.recorded_by) ?? "Unknown",
    recordedAt: r.recorded_at,
  }))

  // Compute breakdown for settlement suggestion
  const cycleIds = (cycleRows ?? []).map((c) => c.id)

  let totalContributionsBase = 0
  if (cycleIds.length > 0) {
    const { data: contribs } = await supabase
      .from("contributions")
      .select("paid_amount")
      .in("contribution_cycle_id", cycleIds)
    totalContributionsBase = (contribs ?? []).reduce((s, c) => s + Number(c.paid_amount), 0)
  }

  const { data: closedLoans } = await supabase
    .from("loans")
    .select("id")
    .eq("fund_circle_id", circleId)
    .eq("status", "closed")
  const closedLoanIds = (closedLoans ?? []).map((l) => l.id)

  let totalLoanInterest = 0
  if (closedLoanIds.length > 0) {
    const { data: installments } = await supabase
      .from("loan_installments")
      .select("interest_component")
      .in("loan_id", closedLoanIds)
    totalLoanInterest = (installments ?? []).reduce((s, li) => s + Number(li.interest_component), 0)
  }

  const totalAssetGains = records.reduce((s, r) => {
    const gain = r.currentValue !== null ? Math.max(0, r.currentValue - r.amount) : 0
    return s + gain
  }, 0)

  const suggestedTotalValue = roundCurrency(totalContributionsBase + totalLoanInterest + totalAssetGains)
  const breakdown = { contributionsBase: totalContributionsBase, loanInterest: totalLoanInterest, assetGains: totalAssetGains }

  // Existing settlement
  const { data: settlementRow } = await supabase
    .from("circle_settlements")
    .select("id, total_value, total_contributions_base, status, calculated_at")
    .eq("fund_circle_id", circleId)
    .maybeSingle()

  const settlement = settlementRow
    ? {
        id: settlementRow.id,
        totalValue: Number(settlementRow.total_value),
        totalContributionsBase: Number(settlementRow.total_contributions_base),
        status: settlementRow.status,
        calculatedAt: settlementRow.calculated_at,
      }
    : null

  // Payouts
  let payouts: SettlementPayoutRow[] = []
  if (settlement) {
    const { data: rawPayouts } = await supabase
      .from("circle_settlement_payouts")
      .select("id, user_id, contribution_total, share_amount, disbursed, disbursed_at")
      .eq("circle_settlement_id", settlement.id)
      .order("share_amount", { ascending: false })

    const payoutUserIds = [...new Set((rawPayouts ?? []).map((p) => p.user_id))]
    const { data: payoutProfiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", payoutUserIds.length > 0 ? payoutUserIds : ["none"])

    const payoutProfileMap = new Map(payoutProfiles?.map((p) => [p.id, p.name]) ?? [])

    payouts = (rawPayouts ?? []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      userName: payoutProfileMap.get(p.user_id) ?? "Unknown",
      contributionTotal: Number(p.contribution_total),
      shareAmount: Number(p.share_amount),
      disbursed: p.disbursed,
      disbursedAt: p.disbursed_at,
    }))
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
        Settlement &amp; Asset Log
      </h2>

      {/* Settlement calculation — admin manages, all members can see if exists */}
      {(canManage || settlement) && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-teal" />
              Circle Settlement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SettlementSummary
              circleId={circleId}
              actorUserId={user.id}
              canManage={canManage}
              settlement={settlement}
              suggestedTotalValue={suggestedTotalValue}
              breakdown={breakdown}
            />
          </CardContent>
        </Card>
      )}

      {/* Payout breakdown — visible to all members once calculated */}
      {settlement && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-teal" />
              Member Payouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SettlementPayoutTable
              payouts={payouts}
              circleId={circleId}
              actorUserId={user.id}
              canManage={canManage}
              settlementFinalized={settlement?.status === "finalized"}
            />
          </CardContent>
        </Card>
      )}

      {/* Asset allocation form — admin only */}
      {canManage && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-teal" />
              Log Asset Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AssetRecordForm circleId={circleId} actorUserId={user.id} />
          </CardContent>
        </Card>
      )}

      {/* Asset records — visible to all members */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-teal" />
            Asset Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AssetRecordList
            records={records}
            circleId={circleId}
            actorUserId={user.id}
            canEdit={canManage}
          />
        </CardContent>
      </Card>
    </div>
  )
}
