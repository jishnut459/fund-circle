import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { resolveEffectiveRole, getViewPreference } from "@/lib/view-mode"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollText } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency, formatDateTime } from "@/lib/format"

interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string | null
  previousValue: unknown
  newValue: unknown
  createdAt: string
  userName: string
}

function formatAuditAction(entry: AuditEntry): string {
  const action = entry.action.replace(/_/g, " ")
  switch (entry.action) {
    case "payment_recorded": {
      const prev = entry.previousValue as { paid_amount: number } | null
      const next = entry.newValue as { paid_amount: number; payment_amount: number } | null
      return `${entry.userName} recorded ${formatCurrency(next?.payment_amount ?? 0)} payment${prev?.paid_amount != null ? ` (was ${formatCurrency(prev.paid_amount)})` : ""}`
    }
    case "loan_payment_recorded_on_behalf": {
      const v = entry.newValue as { amount: number; paymentType: "regular" | "prepayment" | "foreclosure" } | null
      const kind =
        v?.paymentType === "foreclosure" ? "foreclosure" :
        v?.paymentType === "prepayment" ? "prepayment" : "EMI payment"
      return `${entry.userName} recorded a ${kind} of ${formatCurrency(v?.amount ?? 0)} on a member's behalf`
    }
    case "cycle_started": {
      const v = entry.newValue as { circleName: string; label: string } | null
      return `${entry.userName} started a new cycle: ${v?.circleName ?? ""} — ${v?.label ?? ""}`
    }
    case "cycle_closed":
      return `${entry.userName} closed a contribution cycle`
    case "cycle_auto_closed":
      return `Cycle closed automatically — all contributions collected`
    case "member_role_changed": {
      const v = entry.newValue as { role: string } | null
      return `${entry.userName} changed a member's role to ${v?.role ?? ""}`
    }
    case "circle_member_role_changed": {
      const v = entry.newValue as { role: string } | null
      return `${entry.userName} changed a circle member's role to ${v?.role ?? ""}`
    }
    case "member_added": {
      const v = entry.newValue as { name: string } | null
      return `${entry.userName} added ${v?.name ?? "a new member"} to the organization`
    }
    case "member_added_to_circle": {
      const v = entry.newValue as { email: string; name: string } | null
      return `${entry.userName} added ${v?.name ?? v?.email ?? "a member"} to the circle`
    }
    case "member_removed_from_circle": {
      return `${entry.userName} removed a member from the circle`
    }
    case "managed_member_added": {
      const v = entry.newValue as { name: string; role: string } | null
      return `${entry.userName} added ${v?.name ?? "a managed member"} (no app login) to the circle`
    }
    case "loan_request_created_on_behalf": {
      const v = entry.newValue as { requestedAmount: number; requestedTermMonths: number } | null
      return `${entry.userName} created a loan request of ${formatCurrency(v?.requestedAmount ?? 0)} on a member's behalf`
    }
    case "managed_member_link_pending": {
      const v = entry.newValue as { email: string } | null
      return `${entry.userName} invited a managed member to claim their account${v?.email ? ` (${v.email})` : ""}`
    }
    case "managed_member_claimed": {
      const v = entry.newValue as { email: string } | null
      return `A managed member's history was linked to their new account${v?.email ? ` (${v.email})` : ""}`
    }
    case "org_created":
      return `${entry.userName} created the organization`
    case "fund_circle_created": {
      const v = entry.newValue as { name: string } | null
      return `${entry.userName} created fund circle "${v?.name ?? ""}"`
    }
    case "invite_sent": {
      const v = entry.newValue as { email: string; role: string } | null
      return `${entry.userName} invited ${v?.email ?? "someone"} as ${v?.role ?? "member"}`
    }
    case "invite_revoked":
      return `${entry.userName} revoked an invitation`
    case "invite_accepted":
      return `${entry.userName} accepted an invitation`
    case "cycle_asset_recorded": {
      const v = entry.newValue as { assetType: string; institution: string | null; amount: number } | null
      const label = v?.assetType?.replace(/_/g, " ") ?? "asset"
      const inst = v?.institution ? ` at ${v.institution}` : ""
      return `${entry.userName} logged ${formatCurrency(v?.amount ?? 0)} in ${label}${inst}`
    }
    case "asset_record_revalued": {
      const v = entry.newValue as { currentValue: number } | null
      return `${entry.userName} updated an asset's current value to ${formatCurrency(v?.currentValue ?? 0)}`
    }
    case "circle_settlement_calculated": {
      const v = entry.newValue as { totalValue: number; memberCount: number } | null
      return `${entry.userName} calculated settlement: ${formatCurrency(v?.totalValue ?? 0)} across ${v?.memberCount ?? 0} member(s)`
    }
    case "circle_settlement_finalized":
      return `${entry.userName} finalized the circle settlement — circle is now closed`
    case "settlement_payout_disbursed": {
      const v = entry.newValue as { memberName?: string; shareAmount?: number } | null
      const name = v?.memberName ? ` to ${v.memberName}` : ""
      const amt = v?.shareAmount ? ` (${formatCurrency(v.shareAmount)})` : ""
      return `${entry.userName} recorded settlement payout disbursement${name}${amt}`
    }
    default:
      return `${entry.userName} ${action}`
  }
}

function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="No audit log entries yet"
        description="Actions like recording payments and starting cycles will appear here."
      />
    )
  }

  return (
    <div className="relative pl-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--border-color)]">
      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="relative">
            <div className="absolute -left-[29px] top-1.5 w-[18px] h-[18px] rounded-full border-2 border-[var(--border-color)] bg-[var(--bg-surface)] timeline-dot" />
            <div className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-surface)] p-4">
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                {formatAuditAction(entry)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] text-[var(--text-muted)]">
                  {formatDateTime(entry.createdAt)}
                </span>
                <span className="inline-flex items-center rounded-full bg-[var(--border-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                  {entry.entityType.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function CircleAuditLogsPage({
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
  // Admin-only page — also redirect an admin who is currently in member view.
  if (!isAdminOrOwner(resolveEffectiveRole(membership.role, await getViewPreference(circleId)))) {
    redirect(`/circles/${circleId}/dashboard`)
  }

  const { data: logs } = await supabase
    .from("audit_logs")
    .select(`
      id, action, entity_type, entity_id, previous_value, new_value, created_at,
      profiles!inner(name)
    `)
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })
    .limit(100)

  const entries = (logs ?? []).map((log) => {
    const profile = log.profiles as unknown as { name: string }
    return {
      id: log.id,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      previousValue: log.previous_value,
      newValue: log.new_value,
      createdAt: log.created_at,
      userName: profile.name,
    }
  })

  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight pb-4">
        Audit Logs
      </h2>
      <Card>
        <CardContent className="p-6">
          <AuditTimeline entries={entries} />
        </CardContent>
      </Card>
    </div>
  )
}
