import { getCurrentUser } from "@/lib/get-current-user"
import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/layout/AppShell"
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
          className="inline-flex items-center gap-1.5 text-sm text-teal hover:text-teal-700 font-medium mb-2 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          All Circles
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight truncate">
            {circle.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
          <span className="text-lg font-bold text-[var(--text-primary)] font-tabular">
            {formatCurrency(Number(circle.contribution_amount))}
          </span>
          <span className="text-sm text-[var(--text-muted)]">
            / {circle.contribution_frequency.replace(/_/g, " ")}
          </span>
          <span className="text-[var(--border-color)]">·</span>
          <span className="flex items-center gap-1 text-sm text-[var(--text-muted)]">
            <Users className="h-3.5 w-3.5" />
            {memberCount ?? 0} member{memberCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      {children}
    </AppShell>
  )
}
