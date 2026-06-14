import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { getCurrentUser } from "@/lib/get-current-user"
import { redirect } from "next/navigation"
import { isAdminOrOwner } from "@/lib/permissions"
import { Card, CardContent } from "@/components/ui/card"
import MemberTable from "@/components/members/MemberTable"
import AddMemberDialog from "@/components/members/AddMemberDialog"
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

  if (!rawMembers || rawMembers.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between pb-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
              Members
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">0 members</p>
          </div>
          {canEdit && (
            <AddMemberDialog circleId={circleId} currentUserId={user.id} />
          )}
        </div>
        <EmptyState
          icon={Users}
          title="No members yet"
          description="Add members to this circle to start collecting contributions."
        />
      </div>
    )
  }

  const userIds = rawMembers.map((m) => m.user_id)

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, name, email")
    .in("id", userIds)

  const profileMap = new Map(profileRows?.map((p) => [p.id, p]) ?? [])

  const members = rawMembers.map((m) => {
    const profile = profileMap.get(m.user_id)
    const isSelf = m.user_id === user.id
    return {
      userId: m.user_id,
      name: profile?.name ?? (isSelf ? user.name : "Unknown"),
      email: profile?.email ?? (isSelf ? user.email : "—"),
      role: m.role,
      inCircle: true,
      active: m.active,
    }
  })

  return (
    <div>
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Members
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canEdit && (
          <AddMemberDialog circleId={circleId} currentUserId={user.id} />
        )}
      </div>

      <Card>
        <CardContent>
          <MemberTable
            members={members}
            circleId={circleId}
            canEdit={canEdit}
            showRoleManagement={canEdit}
            currentUserId={user.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}
