"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { removeCircleMember, changeCircleMemberRole } from "@/lib/actions"
import { Crown, ShieldCheck, Trash2, User as UserIcon } from "lucide-react"

interface Member {
  userId: string
  name: string
  email: string
  avatarUrl?: string | null
  role: string
  inCircle: boolean
  active: boolean
}

const ROLE_META = {
  owner: { icon: Crown, variant: "success" as const },
  admin: { icon: ShieldCheck, variant: "warning" as const },
  member: { icon: UserIcon, variant: "default" as const },
}

export default function MemberTable({
  members,
  circleId,
  canEdit,
  showRoleManagement,
  currentUserId,
}: {
  members: Member[]
  circleId?: string
  canEdit: boolean
  showRoleManagement?: boolean
  currentUserId?: string
}) {
  const router = useRouter()
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null)

  const handleRemoveMember = async (userId: string) => {
    if (!circleId) return
    setLoadingUserId(userId)
    await removeCircleMember(circleId, userId, currentUserId || userId)
    setLoadingUserId(null)
    router.refresh()
  }

  const handleChangeRole = async (userId: string, newRole: string) => {
    if (!circleId) return
    setLoadingUserId(userId)
    await changeCircleMemberRole(circleId, userId, newRole, currentUserId || userId)
    setLoadingUserId(null)
    router.refresh()
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[var(--text-muted)]">No members yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {members.map((m) => {
        const meta = ROLE_META[m.role as keyof typeof ROLE_META] ?? ROLE_META.member
        const RoleIcon = meta.icon

        return (
          <div
            key={m.userId}
            className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-surface)] px-3 py-2.5 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 shrink-0">
                {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name} />}
                <AvatarFallback>{m.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-[var(--text-primary)] truncate">{m.name}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{m.email}</p>
              </div>
              <Badge variant={meta.variant} className="gap-1 shrink-0">
                <RoleIcon className="h-3 w-3" />
                {m.role}
              </Badge>
            </div>
            {canEdit && (
              <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-[var(--border-light)]">
                {showRoleManagement ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) => handleChangeRole(m.userId, v)}
                    disabled={loadingUserId === m.userId}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-[var(--text-muted)] hover:text-red-600"
                  onClick={() => handleRemoveMember(m.userId)}
                  disabled={loadingUserId === m.userId || m.role === "owner"}
                  title="Remove member"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
