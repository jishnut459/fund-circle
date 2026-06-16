"use client"

import { useState } from "react"
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

const DEFAULT_LOAN_SETTINGS: LoanSettings = {
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
        <WizardStepper currentStep={step} />
      </div>

      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-light)] p-6 shadow-[var(--shadow-card)]">
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
          />
        )}
      </div>
    </div>
  )
}
