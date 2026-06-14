"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Trash2 } from "lucide-react"

interface Member {
  userId: string
  name: string
  email: string
  role: string
  inCircle: boolean
  active: boolean
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
    <div className="overflow-x-auto -mx-6">
      <Table>
        <TableHeader>
          <TableRow className="border-[var(--border-light)]">
            <TableHead className="text-xs text-[var(--text-muted)] font-medium">Name</TableHead>
            <TableHead className="text-xs text-[var(--text-muted)] font-medium hidden sm:table-cell">
              Email
            </TableHead>
            <TableHead className="text-xs text-[var(--text-muted)] font-medium">Role</TableHead>
            {showRoleManagement && canEdit && (
              <TableHead className="text-xs text-[var(--text-muted)] font-medium hidden md:table-cell">
                Change Role
              </TableHead>
            )}
            {canEdit && (
              <TableHead className="text-xs text-[var(--text-muted)] font-medium w-10" />
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m, i) => (
            <TableRow
              key={m.userId}
              className={`border-[var(--border-light)] hover:bg-[var(--border-light)] ${i % 2 === 0 ? "" : "bg-[var(--border-light)]/30"}`}
            >
              <TableCell className="py-3">
                <div className="flex flex-col">
                  <span className="font-medium text-sm text-[var(--text-primary)]">{m.name}</span>
                  <span className="text-xs text-[var(--text-muted)] sm:hidden">{m.email}</span>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell text-sm text-[var(--text-secondary)]">
                {m.email}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    m.role === "owner" ? "success" :
                    m.role === "admin" ? "warning" : "default"
                  }
                >
                  {m.role}
                </Badge>
              </TableCell>
              {showRoleManagement && canEdit && (
                <TableCell className="hidden md:table-cell">
                  <Select
                    value={m.role}
                    onValueChange={(v) => handleChangeRole(m.userId, v)}
                    disabled={loadingUserId === m.userId}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">member</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="owner">owner</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              )}
              {canEdit && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-[var(--text-muted)] hover:text-red-600"
                    onClick={() => handleRemoveMember(m.userId)}
                    disabled={loadingUserId === m.userId || m.role === "owner"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
