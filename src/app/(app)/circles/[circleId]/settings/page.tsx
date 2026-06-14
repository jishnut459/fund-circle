import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Settings, Shield } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { formatCurrency } from "@/lib/format"

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
    <div className="max-w-2xl space-y-6">
      <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
        Circle Settings
      </h2>

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

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-teal" />
            Admins & Owners
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
            <div className="space-y-2">
              {adminList.map((a) => (
                <div
                  key={a.userId}
                  className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-light)]"
                >
                  <div>
                    <p className="font-medium text-sm text-[var(--text-primary)]">{a.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{a.email}</p>
                  </div>
                  <Badge variant={a.role === "owner" ? "success" : "warning"}>
                    {a.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
