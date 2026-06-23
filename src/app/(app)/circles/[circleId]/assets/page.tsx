import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { resolveEffectiveRole, getViewPreference } from "@/lib/view-mode"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Landmark, TrendingUp, Clock, Info } from "lucide-react"
import { formatCurrency } from "@/lib/format"

export default async function AssetsPage({ params }: { params: Promise<{ circleId: string }> }) {
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

  const isAdmin = isAdminOrOwner(resolveEffectiveRole(membership.role, await getViewPreference(circleId)))

  // Placeholder — asset tracking table not yet created.
  // When the assets table is added, fetch and display here.
  const assets: never[] = []
  const totalAssetsValue = 0

  return (
    <div>
      <div className="flex items-center justify-between gap-3 pb-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Assets</h2>
        {isAdmin && (
          <Badge variant="outline" className="text-xs text-[var(--text-muted)]">
            Coming soon
          </Badge>
        )}
      </div>

      {/* Summary banner */}
      <Card className="mb-6 overflow-hidden">
        <CardContent className="p-0">
          <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">
              Total Assets Value
            </p>
            <p className="text-5xl font-bold font-tabular leading-none text-teal">
              {formatCurrency(totalAssetsValue)}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-2.5">
              Combined value of all circle investments and holdings
            </p>
          </div>
          <div className="border-t border-[var(--border-light)] divide-y divide-[var(--border-light)]">
            <div className="flex items-center justify-between px-5 py-2.5 sm:px-6">
              <span className="text-sm text-[var(--text-secondary)]">Fixed deposits</span>
              <span className="text-sm font-tabular font-semibold text-[var(--text-primary)]">{formatCurrency(0)}</span>
            </div>
            <div className="flex items-center justify-between px-5 py-2.5 sm:px-6">
              <span className="text-sm text-[var(--text-secondary)]">Other investments</span>
              <span className="text-sm font-tabular font-semibold text-[var(--text-primary)]">{formatCurrency(0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info banner — explains what this section will track */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-700 mb-6">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Asset tracking coming soon</p>
          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1 leading-relaxed">
            When the circle invests collected funds — for example in a fixed deposit or other instruments — those holdings will appear here. All members can see the full picture of where the money is working, so every rupee stays accounted for.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Investments &amp; Holdings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No assets recorded"
              description={
                isAdmin
                  ? "Once the circle places money in an FD or other investment, record it here so all members can track its value."
                  : "The circle admin hasn't recorded any investments yet. Check back later."
              }
            />
          ) : null}
        </CardContent>
      </Card>

      {/* Planned asset types — gives members clarity on what will be tracked */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          {
            icon: Clock,
            label: "Fixed Deposits",
            description: "Bank FDs with maturity date and interest rate",
            iconClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
          },
          {
            icon: TrendingUp,
            label: "Other Investments",
            description: "Mutual funds, bonds, or any other instruments",
            iconClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
          },
        ].map((type) => (
          <Card key={type.label} className="opacity-60">
            <CardContent className="p-4 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${type.iconClass}`}>
                <type.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{type.label}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{type.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
