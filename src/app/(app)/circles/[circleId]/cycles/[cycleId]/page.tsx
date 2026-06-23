import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlayCircle, CheckCircle2, Landmark, ArrowRight } from "lucide-react"
import ContributionTableClient from "@/components/contributions/ContributionTableClient"
import AssetRecordForm from "@/components/settlement/AssetRecordForm"
import { closeCycleFormAction } from "@/lib/actions"
import { isCycleOverdue } from "@/lib/cycles"
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
      .select("asset_allocation_pct, contribution_late_fee, contribution_grace_days")
      .eq("id", circleId)
      .single(),
  ])

  if (!cycle) redirect(`/circles/${circleId}/cycles`)

  const cycleClosed = cycle.status === "closed"
  const lateFeeAmount = Number(circleMeta?.contribution_late_fee ?? 0)
  const graceDays = Number(circleMeta?.contribution_grace_days ?? 0)
  const cycleOverdue = isCycleOverdue(cycle.due_date, graceDays)

  const { data: rawContribs } = await supabase
    .from("contributions_with_status")
    .select("id, user_id, expected_amount, paid_amount, late_fee, payment_date, notes, status")
    .eq("contribution_cycle_id", cycleId)

  const contribIds = (rawContribs ?? []).map((c) => c.id)
  const userIds = [...new Set((rawContribs ?? []).map((c) => c.user_id))]

  const [{ data: profiles }, { data: rawPending }] = await Promise.all([
    supabase.from("profiles").select("id, name, avatar_url").in("id", userIds.length > 0 ? userIds : ["none"]),
    contribIds.length > 0
      ? supabase
          .from("contribution_payments")
          .select("id, contribution_id, amount, submitted_by")
          .in("contribution_id", contribIds)
          .eq("status", "pending")
      : Promise.resolve({ data: [] }),
  ])

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? [])

  const submitterIds = [...new Set((rawPending ?? []).map((p) => p.submitted_by).filter(Boolean) as string[])]
  const { data: submitterProfiles } = submitterIds.length > 0
    ? await supabase.from("profiles").select("id, name").in("id", submitterIds)
    : { data: [] }
  const submitterMap = new Map((submitterProfiles ?? []).map((p) => [p.id, p.name]))

  const pendingPayments: Record<string, { id: string; amount: number; submittedByName?: string }> = {}
  for (const p of rawPending ?? []) {
    pendingPayments[p.contribution_id] = {
      id: p.id,
      amount: Number(p.amount),
      submittedByName: p.submitted_by ? submitterMap.get(p.submitted_by) ?? undefined : undefined,
    }
  }

  const contributions = (rawContribs ?? []).map((c) => {
    const profile = profileMap.get(c.user_id)
    const storedLateFee = Number(c.late_fee)
    const fullyPaid = c.status === "paid" || c.status === "overpaid"
    // A locked-in fee always wins; otherwise show the prospective fee an
    // overdue, not-yet-settled contribution will incur on payment.
    const effectiveLateFee =
      storedLateFee > 0 ? storedLateFee : cycleOverdue && !fullyPaid && lateFeeAmount > 0 ? lateFeeAmount : 0
    return {
      id: c.id,
      userId: c.user_id,
      userName: profile?.name ?? "Unknown",
      avatarUrl: profile?.avatar_url ?? null,
      expectedAmount: Number(c.expected_amount),
      paidAmount: Number(c.paid_amount),
      lateFee: effectiveLateFee,
      paymentDate: c.payment_date,
      notes: c.notes,
      status: c.status,
    }
  })

  const totalExpected = contributions.reduce((s, c) => s + c.expectedAmount + c.lateFee, 0)
  const totalPaid = contributions.reduce((s, c) => s + c.paidAmount, 0)
  const progress = formatPercentage(totalPaid, totalExpected)
  const assetAllocationPct = Number(circleMeta?.asset_allocation_pct ?? 0)
  const suggestedAssetAmount = Math.round(totalPaid * assetAllocationPct) / 100

  const fullyPaidCount = contributions.filter((c) => c.status === "paid" || c.status === "overpaid").length
  const partialCount = contributions.filter((c) => c.status === "partially_paid").length
  const unpaidCount = contributions.filter((c) => c.status === "unpaid").length
  const remainingToCollect = Math.max(0, totalExpected - totalPaid)
  const membersOutstanding = partialCount + unpaidCount

  return (
    <div className="mx-auto max-w-3xl">
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs">
            {fullyPaidCount > 0 && (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{fullyPaidCount} paid
              </span>
            )}
            {partialCount > 0 && (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{partialCount} partial
              </span>
            )}
            {unpaidCount > 0 && (
              <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-muted)]">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />{unpaidCount} unpaid
              </span>
            )}
            {remainingToCollect > 0 && (
              <span className="text-[var(--text-secondary)]">
                · <span className="font-semibold font-tabular text-[var(--text-primary)]">{formatCurrency(remainingToCollect)}</span> to collect from {membersOutstanding} member{membersOutstanding > 1 ? "s" : ""}
              </span>
            )}
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

      <ContributionTableClient
        initialContributions={contributions}
        initialPendingPayments={pendingPayments}
        contributionCycleId={cycleId}
        circleId={circleId}
        currentUserId={user.id}
        canEdit={canEdit}
        cycleClosed={cycleClosed}
      />
    </div>
  )
}
