"use client"

import { useEffect, useState } from "react"
import WizardStepper from "./WizardStepper"
import Step1Basics, { type Step1Data } from "./Step1Basics"
import Step2LoanSettings from "./Step2LoanSettings"
import Step3Members from "./Step3Members"
import Step4Review from "./Step4Review"
import type { LoanSettings } from "@/lib/types"
import { getDefaultDueDay } from "@/components/fund-circles/CycleDueDaySelect"

export type Step3Member = {
  email: string
  fullName?: string
  role: "admin" | "member"
  exists: boolean
}

type WizardData = {
  step1: Step1Data
  step2: LoanSettings
  step3: Step3Member[]
}

const DRAFT_KEY = "create-circle-draft"

// Member caps per plan — surfaced in the Members step so the limit is visible
// before the server rejects an over-cap circle. Infinity = unlimited.
export const PLAN_MEMBER_LIMITS: Record<string, number> = {
  free: 20,
  pro: 100,
  premium: Infinity,
}

// Default to savings-only (no lending). Creators opt into lending in step 2,
// which then requires a real interest rate. maxLoan caps stay at sensible
// values so they're pre-filled if lending is turned on.
const DEFAULT_LOAN_SETTINGS: LoanSettings = {
  assetAllocationPct: 100,
  loanAllocationPct: 0,
  loanInterestRatePct: 0,
  maxLoanPctOfContribution: 90,
  maxLoanPctOfLendingPool: 10,
  contributionLateFee: 0,
  contributionGraceDays: 0,
  loanLateFee: 0,
  loanGraceDays: 0,
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const DEFAULT_STEP1: Step1Data = {
  name: "",
  description: "",
  amount: "",
  frequency: "monthly",
  cycleDueDay: getDefaultDueDay("monthly"),
  plan: "free",
  startDate: todayISO(),
  endDate: "",
}

export default function CreateCircleWizard({ userId, userName }: { userId: string; userName: string }) {
  const [step, setStep] = useState(1)
  const [wizardData, setWizardData] = useState<WizardData>({
    step1: DEFAULT_STEP1,
    step2: DEFAULT_LOAN_SETTINGS,
    step3: [],
  })
  // Hydrate any saved draft on the client before rendering the steps, so each
  // step mounts with the restored values instead of the defaults.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { step?: number; wizardData?: WizardData }
        // One-time hydration from sessionStorage after mount (gated by `ready`
        // so server and first client render match).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (parsed.wizardData) setWizardData(parsed.wizardData)
        if (parsed.step && parsed.step >= 1 && parsed.step <= 4) setStep(parsed.step)
      }
    } catch {
      // ignore malformed drafts
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, wizardData }))
    } catch {
      // storage may be unavailable (private mode) — non-fatal
    }
  }, [step, wizardData, ready])

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      // ignore
    }
  }

  const handleStep1Next = (data: Step1Data) => {
    setWizardData((prev) => ({ ...prev, step1: data }))
    setStep(2)
  }

  const handleStep2Next = (data: LoanSettings) => {
    setWizardData((prev) => ({ ...prev, step2: data }))
    setStep(3)
  }

  const handleStep3Next = (members: Step3Member[]) => {
    setWizardData((prev) => ({ ...prev, step3: members }))
    setStep(4)
  }

  const memberLimit = PLAN_MEMBER_LIMITS[wizardData.step1.plan] ?? PLAN_MEMBER_LIMITS.free

  return (
    <div className="space-y-8">
      <div className="sticky top-0 z-10 bg-[var(--bg-page)] -mt-4 md:-mt-6 lg:-mt-8 pt-4 md:pt-6 lg:pt-8 pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            Create Fund Circle
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Set up your new fund circle in a few steps
          </p>
        </div>
        <WizardStepper currentStep={step} onStepClick={(n) => n < step && setStep(n)} />
      </div>

      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-light)] p-6 shadow-[var(--shadow-card)]">
        {!ready ? (
          <div className="min-h-[360px]" />
        ) : (
          <>
            {step === 1 && (
              <Step1Basics
                initialData={wizardData.step1}
                onNext={handleStep1Next}
              />
            )}

            {step === 2 && (
              <Step2LoanSettings
                initialData={wizardData.step2}
                onNext={handleStep2Next}
                onBack={() => setStep(1)}
              />
            )}

            {step === 3 && (
              <Step3Members
                creatorName={userName}
                initialMembers={wizardData.step3}
                memberLimit={memberLimit}
                planLabel={wizardData.step1.plan}
                onNext={handleStep3Next}
                onBack={() => setStep(2)}
              />
            )}

            {step === 4 && (
              <Step4Review
                userId={userId}
                step1={wizardData.step1}
                step2={wizardData.step2}
                step3={wizardData.step3}
                onBack={() => setStep(3)}
                onEditStep={setStep}
                onCreated={clearDraft}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
