"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Eye } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { setCircleViewMode } from "@/lib/actions"

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

interface UserInfo {
  name: string
  email: string
  role: string
  avatarUrl: string | null
  orgName?: string
  circleName?: string
}

export default function UserDropdown({
  user,
  compact = false,
  side = "top",
  canSwitchView = false,
  viewMode = "admin",
}: {
  user: UserInfo
  compact?: boolean
  side?: "top" | "bottom"
  canSwitchView?: boolean
  viewMode?: "admin" | "member"
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const circleId = pathname.split("/")[2] ?? ""
  const showViewControl = canSwitchView && Boolean(circleId)

  const switchView = (mode: "admin" | "member") => {
    if (pending || !circleId) return
    startTransition(async () => {
      await setCircleViewMode(circleId, mode)
      setOpen(false)
      router.refresh()
    })
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const initials = getInitials(user.name)
  const isTop = side === "top"

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 rounded-xl hover:bg-[var(--border-light)] transition-colors",
          compact ? "p-1.5" : "w-full px-3 py-2"
        )}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
          <AvatarFallback className="bg-teal text-white font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        {!compact && (
          <div className="min-w-0 flex-1 text-left">
            <p className="text-xs font-medium text-[var(--text-primary)] truncate">
              {user.name}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] truncate">
              {user.email}
            </p>
          </div>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute w-56 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[var(--shadow-card-hover)] overflow-hidden z-50",
            isTop ? "bottom-full left-0 mb-2" : "top-full right-0 mt-2"
          )}
        >
          <div className="p-3 border-b border-[var(--border-light)]">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                <AvatarFallback className="bg-teal text-white font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {user.name}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
          <div className="p-1">
            {(user.circleName || user.orgName) && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-muted)]">
                <span>{user.circleName ? `Circle: ${user.circleName}` : user.orgName ? `Org: ${user.orgName}` : ""}</span>
                {user.role && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                    user.role === "owner"
                      ? "bg-teal-100 text-teal"
                      : user.role === "admin"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-[var(--border-light)] text-[var(--text-secondary)]"
                  )}>
                    {user.role}
                  </span>
                )}
              </div>
            )}
            {showViewControl && (
              <button
                onClick={() => switchView(viewMode === "admin" ? "member" : "admin")}
                disabled={pending}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--border-light)] rounded-lg transition-colors disabled:opacity-60"
              >
                <Eye className="h-4 w-4 text-[var(--text-muted)]" aria-hidden />
                {viewMode === "admin" ? "Preview as member" : "Switch to admin view"}
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
