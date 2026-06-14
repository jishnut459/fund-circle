import { createServerSupabaseClient } from "./supabase-server"

export interface CurrentUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar_url")
    .eq("id", user.id)
    .maybeSingle()

  const name = profile?.name ?? user.email
  const avatarUrl = profile?.avatar_url ?? null

  return {
    id: user.id,
    email: user.email,
    name,
    avatarUrl,
  }
}

export async function getCurrentUserWithCircleRole(circleId: string): Promise<(CurrentUser & { circleRole: string }) | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createServerSupabaseClient()
  const { data: membership } = await supabase
    .from("fund_circle_members")
    .select("role")
    .eq("fund_circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle()

  return { ...user, circleRole: membership?.role ?? "member" }
}
