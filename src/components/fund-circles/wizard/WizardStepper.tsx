"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = [
  { number: 1, label: "Basics" },
  { number: 2, label: "Loans" },
  { number: 3, label: "Members" },
  { number: 4, label: "Review" },
]

export default function WizardStepper({
  currentStep,
  onStepClick,
}: {
  currentStep: number
  onStepClick?: (n: number) => void
}) {
  return (
    <div className="flex items-start w-full">
      {STEPS.map((step, i) => {
        const done = step.number < currentStep
        const active = step.number === currentStep
        const clickable = done && !!onStepClick

        return (
          <div key={step.number} className={cn("flex items-start", i < STEPS.length - 1 && "flex-1")}>
            {/* Step bubble + label — completed steps are clickable to jump back */}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(step.number)}
              className={cn(
                "flex flex-col items-center gap-2 shrink-0",
                clickable ? "cursor-pointer group" : "cursor-default"
              )}
              aria-label={clickable ? `Go back to ${step.label}` : step.label}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200",
                  done && "bg-teal text-white group-hover:ring-[3px] group-hover:ring-teal/30",
                  active && "bg-teal text-white ring-[3px] ring-teal/30",
                  !done && !active && "bg-[var(--bg-card)] border-2 border-[var(--border-color)] text-[var(--text-muted)]"
                )}
              >
                {done ? <Check className="h-4 w-4 stroke-[2.5]" /> : step.number}
              </div>
              <span className={cn(
                "text-xs font-medium",
                active && "text-teal font-semibold",
                done && "text-[var(--text-secondary)]",
                !done && !active && "text-[var(--text-muted)]"
              )}>
                {step.label}
              </span>
            </button>

            {/* Connector — mt-[18px] centers it on the 36px (h-9) circle */}
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mt-[17px] mx-1 bg-[var(--border-color)]">
                <div className={cn("h-full bg-teal transition-all duration-300", done ? "w-full" : "w-0")} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
