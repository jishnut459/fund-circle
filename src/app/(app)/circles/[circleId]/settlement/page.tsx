import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Landmark, PlusCircle } from "lucide-react"
import AssetRecordList from "@/components/settlement/AssetRecordList"
import AssetRecordForm from "@/components/settlement/AssetRecordForm"
import type { CycleAssetRecord } from "@/lib/types"

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

  const canEdit = isAdminOrOwner(membership.role)

  const { data: rawRecords } = await supabase
    .from("cycle_asset_records")
    .select("id, contribution_cycle_id, asset_type, institution, amount, current_value, notes, recorded_by, recorded_at")
    .eq("fund_circle_id", circleId)
    .order("recorded_at", { ascending: false })

  const recorderIds = [...new Set((rawRecords ?? []).map((r) => r.recorded_by))]

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", recorderIds.length > 0 ? recorderIds : ["none"])

  const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) ?? [])

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

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
        Asset Allocation Log
      </h2>

      {canEdit && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-teal" />
              Log Asset Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AssetRecordForm
              circleId={circleId}
              actorUserId={user.id}
            />
          </CardContent>
        </Card>
      )}

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
            canEdit={canEdit}
          />
        </CardContent>
      </Card>
    </div>
  )
}
