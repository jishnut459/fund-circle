"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { calculateCircleSettlement, finalizeCircleSettlement } from "@/lib/actions"
import { formatCurrency, formatDateTime } from "@/lib/format"

interface Settlement {
  id: string
  totalValue: number
  totalContributionsBase: number
  status: string
  calculatedAt: string
}

interface Breakdown {
  contributionsBase: number
  loanInterest: number
  assetGains: number
}

export default function SettlementSummary({
  circleId,
  actorUserId,
  canManage,
  settlement,
  suggestedTotalValue,
  breakdown,
}: {
  circleId: string
  actorUserId: string
  canManage: boolean
  settlement: Settlement | null
  suggestedTotalValue: number
  breakdown: Breakdown
}) {
  const router = useRouter()
  const [overrideValue, setOverrideValue] = useState("")
  const [useOverride, setUseOverride] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [error, setError] = useState("")

  const isFinalized = settlement?.status === "finalized"

  const handleCalculate = async () => {
    setCalculating(true)
    setError("")

    const override = useOverride && overrideValue ? Number(overrideValue) : undefined
    const result = await calculateCircleSettlement(circleId, actorUserId, override)

    setCalculating(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    toast.success(settlement ? "Settlement recalculated" : "Settlement calculated")
    router.refresh()
  }

  const handleFinalize = async () => {
    setFinalizing(true)
    setError("")

    const result = await finalizeCircleSettlement(circleId, actorUserId)

    setFinalizing(false)

    if (!result.success) {
      setError(result.error)
      setFinalizeOpen(false)
      return
    }

    toast.success("Settlement finalized — circle is now closed")
    setFinalizeOpen(false)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* Breakdown */}
      <div className="space-y-1.5 p-4 rounded-xl bg-[var(--border-light)]">
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
          Suggested total value breakdown
        </p>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Contributions collected</span>
          <span className="font-tabular text-[var(--text-primary)]">{formatCurrency(breakdown.contributionsBase)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Loan interest earned</span>
          <span className="font-tabular text-[var(--text-primary)]">{formatCurrency(breakdown.loanInterest)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">Asset appreciation</span>
          <span className="font-tabular text-[var(--text-primary)]">{formatCurrency(breakdown.assetGains)}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold pt-2 border-t border-[var(--border-color)]">
          <span className="text-[var(--text-primary)]">Suggested total</span>
          <span className="font-tabular text-teal">{formatCurrency(suggestedTotalValue)}</span>
        </div>
      </div>

      {/* Existing settlement */}
      {settlement && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-2xl font-bold font-tabular text-[var(--text-primary)]">
              {formatCurrency(settlement.totalValue)}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Calculated {formatDateTime(settlement.calculatedAt)}
            </p>
          </div>
          <Badge variant={isFinalized ? "success" : "warning"}>
            {settlement.status}
          </Badge>
        </div>
      )}

      {/* Admin controls */}
      {canManage && !isFinalized && (
        <div className="space-y-3 pt-2 border-t border-[var(--border-light)]">
          <div className="flex items-center gap-2">
            <input
              id="use-override"
              type="checkbox"
              checked={useOverride}
              onChange={(e) => setUseOverride(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="use-override" className="text-sm cursor-pointer">
              Override total value
            </Label>
          </div>
          {useOverride && (
            <div className="space-y-2">
              <Label htmlFor="override-value">Total Value (₹)</Label>
              <Input
                id="override-value"
                type="number"
                min="0"
                step="0.01"
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
                placeholder={String(suggestedTotalValue)}
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCalculate} disabled={calculating}>
              {calculating ? "Calculating..." : settlement ? "Recalculate" : "Calculate Settlement"}
            </Button>
            {settlement && (
              <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Finalize Settlement</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Finalize Settlement</DialogTitle>
                    <DialogDescription>
                      This will lock the settlement at {formatCurrency(settlement.totalValue)} and permanently close the circle. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="p-3 rounded-xl bg-[var(--border-light)] text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Total to distribute</span>
                        <span className="font-tabular font-semibold text-[var(--text-primary)]">
                          {formatCurrency(settlement.totalValue)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Based on contributions</span>
                        <span className="font-tabular text-[var(--text-primary)]">
                          {formatCurrency(settlement.totalContributionsBase)}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={handleFinalize}
                      disabled={finalizing}
                      className="w-full"
                      variant="destructive"
                    >
                      {finalizing ? "Finalizing..." : "Yes, finalize and close circle"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
