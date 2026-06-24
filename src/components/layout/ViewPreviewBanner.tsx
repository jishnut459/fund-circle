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
        "sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-2 md:px-6 lg:px-8",
        "border-b border-teal-100 bg-teal-50 dark:border-teal-900/40 dark:bg-teal-900/20",
        pending && "opacity-60"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 text-teal shrink-0" aria-hidden />
        <span className="text-xs font-medium text-teal truncate">
          Previewing as member — this is what members see.
        </span>
      </div>
      <button
        type="button"
        onClick={backToAdmin}
        disabled={pending}
        className="shrink-0 inline-flex items-center rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
      >
        Back to admin
      </button>
    </div>
  )
}
