import { getCurrentUser } from "@/lib/get-current-user"
import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import AppShell from "@/components/layout/AppShell"
import { isAdminOrOwner } from "@/lib/permissions"
import { getViewPreference, resolveEffectiveRole } from "@/lib/view-mode"

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
    .select("id, name")
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

  // Admins/owners may preview the member experience via the view toggle. The effective
  // role drives all UI gating; it can only ever downgrade an admin to "member" — never
  // escalate — and RLS remains the real access boundary.
  const viewPref = await getViewPreference(circleId)
  const canSwitchView = isAdminOrOwner(membership.role)
  const effectiveRole = resolveEffectiveRole(membership.role, viewPref)

  const currentUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    circleRole: effectiveRole,
    avatarUrl: user.avatarUrl,
  }

  return (
    <AppShell
      currentUser={currentUser}
      circleName={circle.name}
      canSwitchView={canSwitchView}
      viewMode={canSwitchView ? viewPref : "admin"}
    >
      {children}
    </AppShell>
  )
}
