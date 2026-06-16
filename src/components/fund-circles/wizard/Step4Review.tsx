"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Shield, User, CheckCircle2 } from "lucide-react"
import { createFundCircle, addCircleMember } from "@/lib/actions"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Step1Data } from "./Step1Basics"
import type { Step3Member } from "./CreateCircleWizard"
import type { LoanSettings } from "@/lib/types"
import { cn } from "@/lib/utils"

interface Step4ReviewProps {
  userId: string
  step1: Step1Data
  step2: LoanSettings
  step3: Step3Member[]
  onBack: () => void
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free · up to 20 members",
  pro: "Pro · up to 100 members",
  premium: "Premium · unlimited members",
}

const FREQ_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{title}</h3>
      {children}
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border-light)] last:border-none">
      <span className="text-sm text-[var(--text-muted)] shrink-0">{label}</span>
      <span className="text-sm font-medium text-[var(--text-primary)] text-right">{value}</span>
    </div>
  )
}

const DEFAULT_LOAN: LoanSettings = {
  assetAllocationPct: 0,
  loanAllocationPct: 100,
  loanInterestRatePct: 0,
  maxLoanPctOfContribution: 90,
  maxLoanPctOfLendingPool: 10,
  contributionLateFee: 0,
  contributionGraceDays: 0,
  loanLateFee: 0,
  loanGraceDays: 0,
}

function isDefaultLoanSettings(s: LoanSettings): boolean {
  return (
    s.assetAllocationPct === DEFAULT_LOAN.assetAllocationPct &&
    s.loanAllocationPct === DEFAULT_LOAN.loanAllocationPct &&
    s.loanInterestRatePct === DEFAULT_LOAN.loanInterestRatePct &&
    s.contributionLateFee === DEFAULT_LOAN.contributionLateFee &&
    s.loanLateFee === DEFAULT_LOAN.loanLateFee
  )
}

export default function Step4Review({ userId, step1, step2, step3, onBack }: Step4ReviewProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [memberErrors, setMemberErrors] = useState<string[]>([])

  const handleCreate = async () => {
    setLoading(true)
    setError("")
    setMemberErrors([])

    const result = await createFundCircle(
      step1.name,
      step1.description,
      Number(step1.amount),
      step1.frequency,
      userId,
      step1.plan,
      step1.cycleDueDay,
      {
        loanSettings: step2,
        startDate: step1.startDate || null,
        endDate: step1.endDate || null,
      }
    )

    if (!result.success) {
      setError(result.error)
      setLoading(false)
      return
    }

    const circleId = result.data.circleId
    const errs: string[] = []

    for (const member of step3) {
      const addResult = await addCircleMember({
        circleId,
        email: member.email,
        fullName: member.fullName,
        role: member.role,
        actorUserId: userId,
      })
      if (!addResult.success) {
        errs.push(`${member.email}: ${addResult.error}`)
      }
    }

    if (errs.length > 0) {
      setMemberErrors(errs)
    }

    router.push(`/circles/${circleId}/dashboard`)
  }

  const loanIsDefault = isDefaultLoanSettings(step2)

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--text-muted)]">
        Review your circle settings before creating. You can go back to make changes.
      </p>

      {/* Basics */}
      <ReviewSection title="Circle Basics">
        <div className="rounded-xl border border-[var(--border-light)] px-4 divide-y divide-[var(--border-light)]">
          <ReviewRow label="Name" value={step1.name} />
          {step1.description && <ReviewRow label="Description" value={step1.description} />}
          <ReviewRow
            label="Contribution"
            value={`${formatCurrency(Number(step1.amount))} / ${FREQ_LABELS[step1.frequency] ?? step1.frequency}`}
          />
          <ReviewRow label="Plan" value={PLAN_LABELS[step1.plan] ?? step1.plan} />
          {step1.startDate && (
            <ReviewRow label="Start date" value={formatDate(step1.startDate)} />
          )}
          {step1.endDate && (
            <ReviewRow label="End date" value={formatDate(step1.endDate)} />
          )}
        </div>
      </ReviewSection>

      {/* Loan settings */}
      <ReviewSection title={`Loan & Asset Settings${loanIsDefault ? " (defaults)" : ""}`}>
        <div className="rounded-xl border border-[var(--border-light)] px-4 divide-y divide-[var(--border-light)]">
          <ReviewRow
            label="Allocation"
            value={`${step2.assetAllocationPct}% asset · ${step2.loanAllocationPct}% loans`}
          />
          <ReviewRow label="Loan interest" value={`${step2.loanInterestRatePct}% p.a.`} />
          {(step2.contributionLateFee > 0 || step2.loanLateFee > 0) && (
            <ReviewRow
              label="Late fees"
              value={`${formatCurrency(step2.contributionLateFee)} contrib · ${formatCurrency(step2.loanLateFee)} loan`}
            />
          )}
        </div>
      </ReviewSection>

      {/* Members */}
      <ReviewSection title={`Members (${step3.length + 1})`}>
        {step3.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            Only you as owner. Add members from the members page after creating the circle.
          </p>
        ) : (
          <div className="space-y-2">
            {step3.map((m) => (
              <div
                key={m.email}
                className="flex items-center gap-3 rounded-lg border border-[var(--border-light)] px-3 py-2"
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold",
                  m.role === "admin"
                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700"
                    : "bg-[var(--border-light)] text-[var(--text-muted)]"
                )}>
                  {m.role === "admin" ? <Shield className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate text-[var(--text-primary)]">
                    {m.fullName ?? m.email}
                  </p>
                  {m.fullName && (
                    <p className="text-[11px] text-[var(--text-muted)] truncate">{m.email}</p>
                  )}
                </div>
                <Badge
                  variant={m.role === "admin" ? "warning" : "default"}
                  className="text-[10px] capitalize shrink-0"
                >
                  {m.role}
                </Badge>
                {!m.exists && (
                  <Badge variant="info" className="text-[10px] shrink-0">invite</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </ReviewSection>

      {error && (
        <p className="text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-2">
          {error}
        </p>
      )}

      {memberErrors.length > 0 && (
        <div className="text-sm rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 space-y-1">
          <p className="font-medium text-amber-800 dark:text-amber-300">Circle created — some invites failed:</p>
          {memberErrors.map((e) => (
            <p key={e} className="text-amber-700 dark:text-amber-400 text-xs">{e}</p>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button onClick={handleCreate} disabled={loading} className="gap-2">
          {loading ? (
            "Creating…"
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Create Circle
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
