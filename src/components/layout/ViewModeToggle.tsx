"use client"

import { useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { setCircleViewMode } from "@/lib/actions"

const OPTIONS: { value: "admin" | "member"; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
]

export default function ViewModeToggle({ viewMode }: { viewMode: "admin" | "member" }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const circleId = pathname.split("/")[2] ?? ""

  const switchTo = (mode: "admin" | "member") => {
    if (mode === viewMode || pending || !circleId) return
    startTransition(async () => {
      await setCircleViewMode(circleId, mode)
      router.refresh()
    })
  }

  return (
    <div
      role="group"
      aria-label="View mode"
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-[var(--border-light)] bg-[var(--bg-page)] p-0.5",
        pending && "opacity-60"
      )}
    >
      <Eye className="h-3.5 w-3.5 text-[var(--text-muted)] ml-1.5" aria-hidden />
      {OPTIONS.map((opt) => {
        const active = opt.value === viewMode
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => switchTo(opt.value)}
            disabled={pending}
            aria-pressed={active}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              active
                ? "bg-teal-50 text-teal dark:bg-teal-900/20 dark:text-teal-400"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
