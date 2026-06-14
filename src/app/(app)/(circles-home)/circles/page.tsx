import { getCurrentUser } from "@/lib/get-current-user"
import { createAdminSupabaseClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"
import { EmptyState } from "@/components/ui/empty-state"
import { CircleDollarSign, Users } from "lucide-react"
import NewCircleDialog from "./NewCircleDialog"

export default async function CirclesPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const supabase = createAdminSupabaseClient()

  const { data: circleMemberships } = await supabase
    .from("fund_circle_members")
    .select(`
      fund_circle_id,
      role,
      fund_circles!inner(
        id, name, description, contribution_amount, contribution_frequency, status,
        subscription_plan
      )
    `)
    .eq("user_id", user.id)
    .eq("active", true)
    .order("fund_circle_id")

  const circlesWithProgress = await Promise.all(
    (circleMemberships ?? []).map(async (cm) => {
      const fc = cm.fund_circles as unknown as {
        id: string; name: string; description: string; contribution_amount: number
        contribution_frequency: string; status: string; subscription_plan: string
      }

      const { data: openCycles } = await supabase
        .from("contribution_cycles")
        .select("id, contributions(paid_amount, expected_amount)")
        .eq("fund_circle_id", fc.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)

      const cycle = openCycles?.[0]
      const contribs = cycle?.contributions as Array<{ paid_amount: number; expected_amount: number }> | undefined
      const totalExpected = contribs?.reduce((s, c) => s + Number(c.expected_amount), 0) ?? 0
      const totalPaid = contribs?.reduce((s, c) => s + Number(c.paid_amount), 0) ?? 0

      const { count: memberCount } = await supabase
        .from("fund_circle_members")
        .select("*", { count: "exact", head: true })
        .eq("fund_circle_id", fc.id)
        .eq("active", true)

      return {
        id: fc.id,
        name: fc.name,
        description: fc.description,
        amount: Number(fc.contribution_amount),
        frequency: fc.contribution_frequency,
        status: fc.status,
        plan: fc.subscription_plan,
        role: cm.role,
        memberCount: memberCount ?? 0,
        hasOpenCycle: !!cycle,
        totalExpected,
        totalPaid,
        progress: totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0,
      }
    })
  )

  return (
    <div>
      <div className="sticky top-0 z-10 bg-[var(--bg-page)] pb-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              Fund Circles
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {circlesWithProgress.length} circle{circlesWithProgress.length !== 1 ? "s" : ""}
            </p>
          </div>
          <NewCircleDialog userId={user.id} />
        </div>
      </div>

      {circlesWithProgress.length === 0 ? (
        <div className="pt-8">
          <EmptyState
            icon={CircleDollarSign}
            title="Welcome to Fund Circle"
            description="Create your first fund circle to start tracking contributions with full transparency."
          />
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {circlesWithProgress.map((circle) => (
            <Link key={circle.id} href={`/circles/${circle.id}/dashboard`} className="group">
              <Card className={cn(
                "hover:shadow-[var(--shadow-card-hover)] hover:border-teal/20 transition-all cursor-pointer h-full",
                circle.status !== "active" && "opacity-60"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[13px] text-[var(--text-primary)] truncate leading-snug">
                        {circle.name}
                      </h3>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {circle.hasOpenCycle && (
                        <Badge variant="info" className="text-[10px] h-4 px-1.5">open</Badge>
                      )}
                      <Badge
                        variant={circle.role === "owner" ? "success" : circle.role === "admin" ? "warning" : "default"}
                        className="text-[10px] h-4 px-1.5"
                      >
                        {circle.role}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1.5 mb-3">
                    <span className="text-xl font-bold font-tabular text-[var(--text-primary)]">
                      {formatCurrency(circle.amount)}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      / {circle.frequency.replace(/_/g, " ")}
                    </span>
                  </div>

                  {circle.hasOpenCycle ? (
                    <div className="space-y-1.5">
                      <div className="w-full h-1.5 bg-[var(--border-light)] rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            circle.progress === 100 ? "bg-emerald-500" : "bg-teal"
                          )}
                          style={{ width: `${circle.progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[var(--text-muted)] font-tabular">
                          {formatCurrency(circle.totalPaid)} / {formatCurrency(circle.totalExpected)}
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--text-secondary)] tabular-nums">
                          {circle.progress}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] italic text-[var(--text-muted)]">
                      No active cycle
                    </p>
                  )}

                  <div className="flex items-center gap-1 mt-2.5 text-[11px] text-[var(--text-muted)]">
                    <Users className="h-3 w-3" />
                    <span>{circle.memberCount}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
