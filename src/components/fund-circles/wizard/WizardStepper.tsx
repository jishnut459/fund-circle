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
  return (
    <div className="w-full px-2">
      <div className="relative flex items-start justify-between">

        {/* Track lines between steps */}
        {STEPS.slice(0, -1).map((step) => {
          const filled = step.number < currentStep
          return (
            <div
              key={`line-${step.number}`}
              className={cn(
                "absolute top-5 h-[2px] transition-all duration-500",
                filled ? "bg-teal" : "bg-[var(--border-color)]"
              )}
              style={{
                left: `calc(${((step.number - 1) / (STEPS.length - 1)) * 100}% + 20px)`,
                right: `calc(${100 - (step.number / (STEPS.length - 1)) * 100}% + 20px)`,
              }}
            />
          )
        })}

        {STEPS.map((step) => {
          const done = step.number < currentStep
          const active = step.number === currentStep

          return (
            <div key={step.number} className="relative z-10 flex flex-col items-center gap-2 w-16">
              {/* Circle */}
              <div className="relative flex items-center justify-center">
                {/* Outer pulse ring for active step */}
                {active && (
                  <span className="absolute inset-0 rounded-full bg-teal/20 scale-[1.6]" />
                )}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                    done && "bg-teal text-white shadow-sm",
                    active && "bg-teal text-white shadow-md ring-4 ring-teal/20",
                    !done && !active && "bg-[var(--bg-card)] border-2 border-[var(--border-color)] text-[var(--text-muted)]"
                  )}
                >
                  {done ? <Check className="h-4 w-4 stroke-[2.5]" /> : step.number}
                </div>
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-xs font-semibold whitespace-nowrap tracking-wide",
                  active && "text-teal",
                  done && "text-[var(--text-secondary)]",
                  !done && !active && "text-[var(--text-muted)]"
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
