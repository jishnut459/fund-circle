import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowRight, CalendarRange, HandCoins, Landmark, Settings, Shield } from "lucide-react"
import Link from "next/link"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency, formatDate } from "@/lib/format"
import { describeCycleDueDay } from "@/lib/cycles"
import ExtendCircleDialog from "@/components/loans/ExtendCircleDialog"
import LoanSettingsForm from "@/components/loans/LoanSettingsForm"

export default async function CircleSettingsPage({
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

  if (!membership || !isAdminOrOwner(membership.role)) {
    redirect(`/circles/${circleId}/dashboard`)
  }

  const { data: circle } = await supabase
    .from("fund_circles")
    .select("*")
    .eq("id", circleId)
    .single()

  if (!circle) redirect("/circles")

  const { count: memberCount } = await supabase
    .from("fund_circle_members")
    .select("*", { count: "exact", head: true })
    .eq("fund_circle_id", circleId)
    .eq("active", true)

  const { data: admins } = await supabase
    .from("fund_circle_members")
    .select("user_id, role, profiles!inner(name, email)")
    .eq("fund_circle_id", circleId)
    .eq("active", true)
    .in("role", ["owner", "admin"])

  const adminList = admins?.map((a) => {
    const p = a.profiles as unknown as { name: string; email: string }
    return { userId: a.user_id, name: p.name, email: p.email, role: a.role }
  }) ?? []

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
        Circle Settings
      </h2>

      {/* Two-column layout on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-teal" />
                Circle Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Circle Name</Label>
                <Input defaultValue={circle.name} disabled />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input defaultValue={circle.description ?? ""} disabled />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contribution Amount</Label>
                  <Input defaultValue={formatCurrency(Number(circle.contribution_amount))} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Input defaultValue={circle.contribution_frequency.replace(/_/g, " ")} disabled />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Payment Due</Label>
                <Input defaultValue={describeCycleDueDay(circle.contribution_frequency, circle.cycle_due_day)} disabled />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Badge
                  variant={circle.status === "active" ? "success" : circle.status === "paused" ? "warning" : "default"}
                >
                  {circle.status}
                </Badge>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Editing is not available in this version.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-teal" />
                Circle Term
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input defaultValue={circle.start_date ? formatDate(circle.start_date) : "Not set"} disabled />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input defaultValue={circle.end_date ? formatDate(circle.end_date) : "Not set"} disabled />
                </div>
              </div>
              <ExtendCircleDialog
                circleId={circleId}
                actorUserId={user.id}
                currentEndDate={circle.end_date}
                startDate={circle.start_date}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <HandCoins className="h-4 w-4 text-teal" />
                Loan &amp; Asset Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LoanSettingsForm
                circleId={circleId}
                actorUserId={user.id}
                initialSettings={{
                  assetAllocationPct: Number(circle.asset_allocation_pct),
                  loanAllocationPct: Number(circle.loan_allocation_pct),
                  loanInterestRatePct: Number(circle.loan_interest_rate_pct),
                  maxLoanPctOfContribution: Number(circle.max_loan_pct_of_contribution),
                  maxLoanPctOfLendingPool: Number(circle.max_loan_pct_of_lending_pool),
                  contributionLateFee: Number(circle.contribution_late_fee),
                  contributionGraceDays: circle.contribution_grace_days,
                  loanLateFee: Number(circle.loan_late_fee),
                  loanGraceDays: circle.loan_grace_days,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-teal" />
                Asset Allocation Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--text-muted)] mb-3">
                Track where asset-allocated contributions are invested. Visible to all circle members.
              </p>
              <Link
                href={`/circles/${circleId}/settlement`}
                className="inline-flex items-center gap-1.5 text-sm text-teal hover:text-teal-dark font-medium"
              >
                View asset allocation log <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Full-width: Admins & Owners */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-teal" />
            Admins &amp; Owners
          </CardTitle>
        </CardHeader>
        <CardContent>
          {adminList.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No admins found"
              description="Promote members to admin or owner from the Members page."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {adminList.map((a) => (
                <div
                  key={a.userId}
                  className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-light)]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-[var(--text-primary)] truncate">{a.name}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{a.email}</p>
                  </div>
                  <Badge variant={a.role === "owner" ? "success" : "warning"} className="ml-2 shrink-0">
                    {a.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full-width: Plan */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--border-light)]">
            <div>
              <p className="font-semibold text-[var(--text-primary)] capitalize">{circle.subscription_plan} Plan</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {memberCount} member{memberCount !== 1 ? "s" : ""}
              </p>
            </div>
            <Badge variant="success">{circle.subscription_plan}</Badge>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Upgrade and payment integration is not available in this version.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
