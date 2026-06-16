import { getCurrentUser } from "@/lib/get-current-user"
import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import AppShell from "@/components/layout/AppShell"

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

  const currentUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    circleRole: membership.role,
    avatarUrl: user.avatarUrl,
  }

  return (
    <AppShell currentUser={currentUser} circleName={circle.name}>
      {children}
    </AppShell>
  )
}
