import { getCurrentUser } from "@/lib/get-current-user"
import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import AppShell from "@/components/layout/AppShell"
import { Badge } from "@/components/ui/badge"
import { Users } from "lucide-react"
import { formatCurrency } from "@/lib/format"

export default async function CircleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ circleId: string }>
}) {
  const { circleId } = await params
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const supabase = createAdminSupabaseClient()

  const { data: circle } = await supabase
    .from("fund_circles")
    .select("id, name, contribution_amount, contribution_frequency, status, max_members")
    .eq("id", circleId)
    .single()

  if (!circle) redirect("/circles")

  const { data: membership } = await supabase
    .from("fund_circle_members")
    .select("role")
    .eq("fund_circle_id", circleId)
    .eq("user_id", user.id)
    .eq("active", true)
    .single()

  if (!membership) redirect("/circles")

  const { count: memberCount } = await supabase
    .from("fund_circle_members")
    .select("*", { count: "exact", head: true })
    .eq("fund_circle_id", circleId)
    .eq("active", true)

  const currentUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    circleRole: membership.role,
    avatarUrl: user.avatarUrl,
  }

  return (
    <AppShell currentUser={currentUser} circleName={circle.name}>
      <div className="hidden lg:block sticky top-0 z-10 bg-[var(--bg-page)] -mt-8 pt-8 pb-4 -mx-8 px-8">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] p-5">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-teal flex items-center justify-center shrink-0 text-white font-bold text-xl">
              {circle.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight truncate">
                  {circle.name}
                </h1>
                <Badge
                  variant={
                    circle.status === "active"
                      ? "success"
                      : circle.status === "paused"
                        ? "warning"
                        : "default"
                  }
                  className="shrink-0"
                >
                  {circle.status}
                </Badge>
              </div>
              <span className="flex items-center gap-1 text-sm text-[var(--text-muted)] mt-1">
                <Users className="h-3.5 w-3.5" />
                {memberCount ?? 0} member{memberCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="text-right shrink-0 pl-4 border-l border-[var(--border-light)]">
              <p className="text-2xl font-bold font-tabular text-[var(--text-primary)]">
                {formatCurrency(Number(circle.contribution_amount))}
              </p>
              <p className="text-sm text-[var(--text-muted)] capitalize">
                per {circle.contribution_frequency.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        </div>
      </div>
      {children}
    </AppShell>
  )
}
