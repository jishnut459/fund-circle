"use client"

import { useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { setCircleViewMode } from "@/lib/actions"

/**
 * Persistent banner shown only while an admin/owner is previewing the circle
 * as a member. Makes the downgraded view unmistakable and gives a one-tap exit.
 * View state itself is presentation-only — RLS remains the real access boundary.
 */
export default function ViewPreviewBanner() {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const circleId = pathname.split("/")[2] ?? ""

  const backToAdmin = () => {
    if (pending || !circleId) return
    startTransition(async () => {
      await setCircleViewMode(circleId, "admin")
      router.refresh()
    })
  }

  return (
    <div
      role="status"
      className={cn(
        "sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-1.5 md:px-6 lg:px-8",
        "border-b border-border bg-muted/40 text-muted-foreground",
        pending && "opacity-60"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
        <span className="text-xs truncate">
          Previewing as member
        </span>
      </div>
      <button
        type="button"
        onClick={backToAdmin}
        disabled={pending}
        className="shrink-0 text-xs font-medium text-teal underline-offset-2 transition-colors hover:underline disabled:opacity-60"
      >
        Back to admin
      </button>
    </div>
  )
}
