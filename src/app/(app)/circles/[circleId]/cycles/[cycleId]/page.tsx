import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlayCircle, CheckCircle2, Landmark, ArrowRight } from "lucide-react"
import ContributionTable from "@/components/contributions/ContributionTable"
import AssetRecordForm from "@/components/settlement/AssetRecordForm"
import { closeCycleFormAction } from "@/lib/actions"
import { formatCurrency, formatISODate, formatPercentage } from "@/lib/format"
import Link from "next/link"

export default async function CycleDetailPage({
  params,
}: {
  params: Promise<{ circleId: string; cycleId: string }>
}) {
  const { circleId, cycleId } = await params
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

  const role = membership.role
  const canEdit = isAdminOrOwner(role)

  const [{ data: cycle }, { data: circleMeta }] = await Promise.all([
    supabase
      .from("contribution_cycles")
      .select("id, label, cycle_start, cycle_end, due_date, status, fund_circle_id")
      .eq("id", cycleId)
      .single(),
    supabase
      .from("fund_circles")
      .select("asset_allocation_pct")
      .eq("id", circleId)
      .single(),
  ])

  if (!cycle) redirect(`/circles/${circleId}/cycles`)

  const cycleClosed = cycle.status === "closed"

  const { data: rawContribs } = await supabase
    .from("contributions_with_status")
    .select("id, user_id, expected_amount, paid_amount, payment_date, notes, status")
    .eq("contribution_cycle_id", cycleId)

  const userIds = [...new Set((rawContribs ?? []).map((c) => c.user_id))]

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", userIds.length > 0 ? userIds : ["none"])

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? [])

  const contributions = (rawContribs ?? []).map((c) => {
    const profile = profileMap.get(c.user_id)
    return {
      id: c.id,
      userId: c.user_id,
      userName: profile?.name ?? "Unknown",
      avatarUrl: profile?.avatar_url ?? null,
      expectedAmount: Number(c.expected_amount),
      paidAmount: Number(c.paid_amount),
      paymentDate: c.payment_date,
      notes: c.notes,
      status: c.status,
    }
  })

  const totalExpected = contributions.reduce((s, c) => s + c.expectedAmount, 0)
  const totalPaid = contributions.reduce((s, c) => s + c.paidAmount, 0)
  const progress = formatPercentage(totalPaid, totalExpected)
  const assetAllocationPct = Number(circleMeta?.asset_allocation_pct ?? 0)
  const suggestedAssetAmount = Math.round(totalPaid * assetAllocationPct) / 100

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
              {cycle.label}
            </h2>
            <Badge variant={cycleClosed ? "default" : "info"} className="gap-1">
              {cycleClosed ? <CheckCircle2 className="h-3 w-3" /> : <PlayCircle className="h-3 w-3" />}
              {cycle.status}
            </Badge>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {formatISODate(cycle.cycle_start)} → {formatISODate(cycle.cycle_end)}
            {cycle.due_date && ` · Pay by ${formatISODate(cycle.due_date)}`}
          </p>
          <div className="flex items-baseline gap-3 mt-2">
            <span className="text-2xl font-bold font-tabular text-[var(--text-primary)]">
              {formatCurrency(totalPaid)}
            </span>
            <span className="text-sm text-[var(--text-muted)]">
              of {formatCurrency(totalExpected)} collected
            </span>
          </div>
          <div className="w-full max-w-sm h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-teal rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
        {canEdit && !cycleClosed && (
          <form action={closeCycleFormAction}>
            <input type="hidden" name="cycleId" value={cycleId} />
            <input type="hidden" name="circleId" value={circleId} />
            <input type="hidden" name="userId" value={user.id} />
            <Button variant="outline" size="sm" type="submit">Close Cycle</Button>
          </form>
        )}
      </div>

      {cycleClosed && canEdit && assetAllocationPct > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-teal" />
              Log Asset Allocation
            </CardTitle>
            <p className="text-sm text-[var(--text-muted)]">
              {formatCurrency(suggestedAssetAmount)} ({assetAllocationPct}%) of this cycle&apos;s collections should be allocated to assets.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <AssetRecordForm
              circleId={circleId}
              actorUserId={user.id}
              cycleId={cycleId}
              suggestedAmount={suggestedAssetAmount}
            />
            <Link
              href={`/circles/${circleId}/settlement`}
              className="inline-flex items-center gap-1 text-xs text-teal hover:text-teal-dark font-medium"
            >
              View full asset log <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      )}

      <ContributionTable
        contributions={contributions}
        contributionCycleId={cycleId}
        circleId={circleId}
        currentUserId={user.id}
        canEdit={canEdit}
        cycleClosed={cycleClosed}
      />
    </div>
  )
}
