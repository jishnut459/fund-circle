"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Mail, RotateCw, X } from "lucide-react"
import { resendCircleInvite, revokeInvite } from "@/lib/actions"
import { formatDate } from "@/lib/format"

interface PendingInvite {
  id: string
  email: string
  role: string
  invitedName: string | null
  createdAt: string
}

export default function PendingInvitesList({
  invites,
  circleId,
  currentUserId,
}: {
  invites: PendingInvite[]
  circleId: string
  currentUserId: string
}) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (invites.length === 0) return null

  const handleResend = async (invite: PendingInvite) => {
    setLoadingId(invite.id)
    const result = await resendCircleInvite(circleId, invite.id, currentUserId)
    setLoadingId(null)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    if (result.data.emailSent) {
      toast.success(`Invite resent to ${invite.email}`)
    } else {
      toast.info("Invite updated", {
        description: `We couldn't send an email automatically. Ask ${invite.email} to sign in with Google to join.`,
      })
    }
  }

  const handleRevoke = async (invite: PendingInvite) => {
    setLoadingId(invite.id)
    const result = await revokeInvite(circleId, invite.id, currentUserId)
    setLoadingId(null)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(`Invite to ${invite.email} revoked`)
    router.refresh()
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
        <Mail className="h-4 w-4 text-teal" />
        Pending Invites
      </h3>
      <div className="space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-light)] bg-[var(--border-light)]/30 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {invite.invitedName || invite.email}
              </p>
              {invite.invitedName && (
                <p className="text-xs text-[var(--text-muted)] truncate">{invite.email}</p>
              )}
              <p className="text-xs text-[var(--text-muted)]">Invited {formatDate(invite.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant={invite.role === "admin" ? "warning" : "default"}>{invite.role}</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => handleResend(invite)}
                disabled={loadingId === invite.id}
                title="Resend invite"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-[var(--text-muted)] hover:text-red-600"
                onClick={() => handleRevoke(invite)}
                disabled={loadingId === invite.id}
                title="Revoke invite"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
