import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import MemberTable from "@/components/members/MemberTable"
import AddMemberDialog from "@/components/members/AddMemberDialog"
import PendingInvitesList from "@/components/members/PendingInvitesList"
import { EmptyState } from "@/components/ui/empty-state"
import { Users } from "lucide-react"

export default async function CircleMembersPage({
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

  if (!membership) redirect("/circles")

  const role = membership.role
  const canEdit = isAdminOrOwner(role)

  const { data: rawMembers } = await supabase
    .from("fund_circle_members")
    .select("user_id, role, active")
    .eq("fund_circle_id", circleId)
    .eq("active", true)
    .order("role")

  const { data: pendingInviteRows } = canEdit
    ? await supabase
        .from("org_invites")
        .select("id, email, role, invited_name, created_at")
        .eq("fund_circle_id", circleId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: null }

  const pendingInvites = (pendingInviteRows ?? []).map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    invitedName: invite.invited_name,
    createdAt: invite.created_at,
  }))

  if (!rawMembers || rawMembers.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-teal" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight truncate">
                Members
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">0 members</p>
            </div>
          </div>
          {canEdit && (
            <AddMemberDialog circleId={circleId} currentUserId={user.id} />
          )}
        </div>
        {pendingInvites.length === 0 && (
          <EmptyState
            icon={Users}
            title="No members yet"
            description="Add members to this circle to start collecting contributions."
          />
        )}
        {canEdit && (
          <PendingInvitesList invites={pendingInvites} circleId={circleId} currentUserId={user.id} />
        )}
      </div>
    )
  }

  const userIds = rawMembers.map((m) => m.user_id)

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, name, email, avatar_url, is_managed, phone")
    .in("id", userIds)

  const profileMap = new Map(profileRows?.map((p) => [p.id, p]) ?? [])

  const members = rawMembers.map((m) => {
    const profile = profileMap.get(m.user_id)
    const isSelf = m.user_id === user.id
    const isManaged = profile?.is_managed ?? false
    return {
      userId: m.user_id,
      name: profile?.name ?? (isSelf ? user.name : "Unknown"),
      email: isManaged ? (profile?.phone ?? profile?.email ?? "No login") : (profile?.email ?? (isSelf ? user.email : "—")),
      avatarUrl: profile?.avatar_url ?? (isSelf ? user.avatarUrl : null),
      role: m.role,
      inCircle: true,
      active: m.active,
      isManaged,
    }
  })

  return (
    <div>
      <div className="flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-teal" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight truncate">
              Members
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              {members.length} member{members.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {canEdit && (
          <AddMemberDialog circleId={circleId} currentUserId={user.id} />
        )}
      </div>

      <MemberTable
        members={members}
        circleId={circleId}
        canEdit={canEdit}
        showRoleManagement={canEdit}
        currentUserId={user.id}
      />

      {canEdit && (
        <PendingInvitesList invites={pendingInvites} circleId={circleId} currentUserId={user.id} />
      )}
    </div>
  )
}
