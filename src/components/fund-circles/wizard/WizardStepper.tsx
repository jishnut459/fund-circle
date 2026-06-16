"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = [
  { number: 1, label: "Basics" },
  { number: 2, label: "Loans" },
  { number: 3, label: "Members" },
  { number: 4, label: "Review" },
]

export default function WizardStepper({ currentStep }: { currentStep: number }) {
  const pct = (currentStep - 1) / (STEPS.length - 1)
  const progressWidth = `calc(${pct * 100}% - ${pct * 2}rem)`

  return (
    <div className="w-full">
      <div className="relative flex items-center justify-between">
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-[var(--border-light)]" />
        <div
          className="absolute top-4 left-4 h-0.5 bg-teal transition-all duration-300"
          style={{ width: progressWidth }}
        />
        {STEPS.map((step) => {
          const done = step.number < currentStep
          const active = step.number === currentStep
          return (
            <div key={step.number} className="relative z-10 flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-200",
                  done && "border-teal bg-teal text-white",
                  active && "border-teal bg-teal text-white shadow-[0_0_0_4px_color-mix(in_srgb,#1D9E75_15%,transparent)]",
                  !done && !active && "border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-muted)]"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : step.number}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium whitespace-nowrap",
                  active ? "text-teal" : done ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
                )}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
