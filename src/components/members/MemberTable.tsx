"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { deleteCircleMemberPermanently, changeCircleMemberRole } from "@/lib/actions"
import LinkManagedMemberDialog from "./LinkManagedMemberDialog"
import { Crown, Lock, ShieldCheck, Trash2, User as UserIcon, UserCog } from "lucide-react"

interface Member {
  userId: string
  name: string
  email: string
  avatarUrl?: string | null
  role: string
  inCircle: boolean
  active: boolean
  isManaged?: boolean
  hasPaidHistory?: boolean
  hasOutstandingDues?: boolean
  hasActiveLoan?: boolean
}

const ROLE_META = {
  owner: { icon: Crown, variant: "success" as const },
  admin: { icon: ShieldCheck, variant: "warning" as const },
  member: { icon: UserIcon, variant: "default" as const },
}

const isLocked = (m: Member) => Boolean(m.hasPaidHistory || m.hasOutstandingDues || m.hasActiveLoan)

function lockReasons(m: Member): string[] {
  const reasons: string[] = []
  if (m.hasOutstandingDues) reasons.push("Has outstanding dues in an open cycle.")
  if (m.hasActiveLoan) reasons.push("Has an active or pending loan.")
  if (m.hasPaidHistory && !m.hasOutstandingDues && !m.hasActiveLoan) {
    reasons.push("Has contribution history — kept for the record.")
  }
  return reasons
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
  const [confirmDelete, setConfirmDelete] = useState<Member | null>(null)
  const [lockedInfo, setLockedInfo] = useState<Member | null>(null)

  const handleDeleteMember = async (member: Member) => {
    if (!circleId) return
    setLoadingUserId(member.userId)
    const result = await deleteCircleMemberPermanently(circleId, member.userId, currentUserId || member.userId)
    setLoadingUserId(null)
    setConfirmDelete(null)
    if (result.success) {
      toast.success(`${member.name} removed from this circle`)
      router.refresh()
    } else {
      toast.error(result.error)
    }
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
        const locked = isLocked(m)

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
              <div className="flex items-center justify-end shrink-0">
                {m.isManaged ? (
                  <Badge variant="default" className="gap-1">
                    <UserCog className="h-3 w-3" />
                    Managed
                  </Badge>
                ) : (
                  <Badge variant={meta.variant} className="gap-1">
                    <RoleIcon className="h-3 w-3" />
                    {m.role}
                  </Badge>
                )}
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-[var(--border-light)]">
                <div className="flex items-center gap-2 min-w-0">
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
                  ) : null}
                  {m.isManaged && currentUserId && (
                    <LinkManagedMemberDialog
                      managedId={m.userId}
                      memberName={m.name}
                      actorUserId={currentUserId}
                    />
                  )}
                </div>
                {m.role === "owner" ? null : locked ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-[var(--text-muted)]"
                    onClick={() => setLockedInfo(m)}
                    title="Why can't this member be removed?"
                  >
                    <Lock className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-[var(--text-muted)] hover:text-red-600"
                    onClick={() => setConfirmDelete(m)}
                    disabled={loadingUserId === m.userId}
                    title="Remove member"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )
      })}

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {confirmDelete?.name}?</DialogTitle>
            <DialogDescription>
              This permanently removes {confirmDelete?.name} from this circle. They have no
              payments, dues, or loans, so nothing on the ledger is affected. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={loadingUserId !== null}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && handleDeleteMember(confirmDelete)}
              disabled={loadingUserId !== null}
            >
              Remove member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lockedInfo !== null} onOpenChange={(open) => !open && setLockedInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lockedInfo?.name} can&apos;t be removed</DialogTitle>
            <DialogDescription>
              Members who have taken part in the fund stay on the ledger so the record
              remains complete and transparent.
            </DialogDescription>
          </DialogHeader>
          {lockedInfo && (
            <ul className="space-y-1.5 text-sm text-[var(--text-secondary)]">
              {lockReasons(lockedInfo).map((reason) => (
                <li key={reason} className="flex items-start gap-2">
                  <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--text-muted)]" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockedInfo(null)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
