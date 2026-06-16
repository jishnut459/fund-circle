"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Plus } from "lucide-react"

export default function RequestLoanButton({
  href,
  disabled,
  disabledReason,
}: {
  href: string
  disabled: boolean
  disabledReason?: string
}) {
  if (!disabled) {
    return (
      <Button asChild>
        <Link href={href}>
          <Plus className="h-4 w-4" />
          Request Loan
        </Link>
      </Button>
    )
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span wrapper needed — disabled buttons don't fire pointer events */}
          <span className="cursor-not-allowed inline-flex">
            <Button disabled className="pointer-events-none">
              <Plus className="h-4 w-4" />
              Request Loan
            </Button>
          </span>
        </TooltipTrigger>
        {disabledReason && (
          <TooltipContent side="bottom" className="max-w-[220px] text-center">
            {disabledReason}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}
