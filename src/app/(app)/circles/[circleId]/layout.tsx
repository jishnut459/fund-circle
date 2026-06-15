import { getCurrentUser } from "@/lib/get-current-user"
import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/layout/AppShell"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, Users } from "lucide-react"
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
    <AppShell currentUser={currentUser}>
      <div className="sticky top-0 z-10 bg-[var(--bg-page)] pb-4 -mt-4 pt-4">
        <Link
          href="/circles"
          className="inline-flex items-center gap-1.5 text-sm text-teal hover:text-teal-700 font-medium mb-3 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All Circles
        </Link>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] p-4 sm:p-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-teal flex items-center justify-center shrink-0 text-white font-bold text-lg sm:text-xl">
              {circle.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight truncate">
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
            <div className="text-right shrink-0 pl-3 sm:pl-4 sm:border-l sm:border-[var(--border-light)]">
              <p className="text-xl sm:text-2xl font-bold font-tabular text-[var(--text-primary)]">
                {formatCurrency(Number(circle.contribution_amount))}
              </p>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] capitalize">
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
