import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { writeAuditLog } from "@/lib/audit"

interface GoogleUserMetadata {
  full_name?: string
  avatar_url?: string
  name?: string
  picture?: string
}

export async function resolveUserOnSignIn(
  userId: string,
  email: string,
  metadata: GoogleUserMetadata
): Promise<void> {
  const supabase = createAdminSupabaseClient()

  await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      name: metadata.full_name || metadata.name || email.split("@")[0],
      avatar_url: metadata.avatar_url || metadata.picture || null,
    },
    { onConflict: "id" }
  )

  const { data: invites } = await supabase
    .from("org_invites")
    .select("*")
    .eq("email", email)
    .eq("status", "pending")

  if (!invites || invites.length === 0) return

  for (const invite of invites) {
    if (invite.fund_circle_id) {
      await supabase.from("fund_circle_members").upsert(
        {
          fund_circle_id: invite.fund_circle_id,
          user_id: userId,
          role: invite.role === "owner" || invite.role === "admin" ? invite.role : "member",
          active: true,
        },
        { onConflict: "fund_circle_id, user_id", ignoreDuplicates: true }
      )

      await supabase
        .from("org_invites")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", invite.id)

      await writeAuditLog({
        circleId: invite.fund_circle_id,
        userId,
        action: "invite_accepted",
        entityType: "fund_circle_member",
        entityId: userId,
        newValue: { email, role: invite.role },
      })
    }
  }
}
