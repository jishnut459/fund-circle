"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, IndianRupee } from "lucide-react"
import { formatCurrency } from "@/lib/format"

interface FundCircle {
  id: string
  name: string
  description: string | null
  contribution_amount: number
  contribution_frequency: string
  status: string
  member_count?: number
}

export default function FundCircleCard({
  circle,
  cycleProgress,
}: {
  circle: FundCircle
  cycleProgress?: { totalPaid: number; totalExpected: number; progress: number }
}) {
  const router = useRouter()

  return (
    <Card
      className="cursor-pointer hover:shadow-[var(--shadow-card-hover)] hover:border-teal/20 transition-all active:scale-[0.99]"
      onClick={() => router.push(`/circles/${circle.id}/dashboard`)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1 mr-3">
            <h3 className="font-semibold text-[var(--text-primary)] truncate">
              {circle.name}
            </h3>
            {circle.description && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">
                {circle.description}
              </p>
            )}
          </div>
          <Badge
            variant={
              circle.status === "active"
                ? "success"
                : circle.status === "paused"
                  ? "warning"
                  : "default"
            }
            className="shrink-0"
          >
            {circle.status}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-[var(--text-secondary)] font-medium">
            <IndianRupee className="h-3.5 w-3.5 text-teal" />
            <span className="font-tabular font-semibold text-[var(--text-primary)]">
              {formatCurrency(Number(circle.contribution_amount))}
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              / {circle.contribution_frequency.replace("_", " ")}
            </span>
          </span>
          {circle.member_count !== undefined && (
            <span className="flex items-center gap-1 text-[var(--text-muted)] text-xs">
              <Users className="h-3 w-3" />
              {circle.member_count}
            </span>
          )}
        </div>
        {cycleProgress && cycleProgress.totalExpected > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border-light)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-[var(--text-muted)]">Current cycle</span>
              <span className="text-[11px] font-medium text-teal">{cycleProgress.progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
              <div
                className="h-full bg-teal rounded-full transition-all"
                style={{ width: `${cycleProgress.progress}%` }}
              />
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5 font-tabular">
              {formatCurrency(cycleProgress.totalPaid)} / {formatCurrency(cycleProgress.totalExpected)} collected
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
