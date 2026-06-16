"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PiggyBank, Landmark, Banknote, TrendingUp, HandCoins, Pencil, type LucideIcon } from "lucide-react"
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
import { EmptyState } from "@/components/ui/empty-state"
import { updateAssetRecordValue } from "@/lib/actions"
import { formatCurrency, formatDate } from "@/lib/format"
import type { AssetType, CycleAssetRecord } from "@/lib/types"

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  recurring_deposit: "Recurring Deposit",
  fixed_deposit: "Fixed Deposit",
  cash_in_hand: "Cash in Hand",
  mutual_fund: "Mutual Fund",
  other: "Other",
}

const ASSET_TYPE_ICONS: Record<AssetType, LucideIcon> = {
  recurring_deposit: PiggyBank,
  fixed_deposit: Landmark,
  cash_in_hand: Banknote,
  mutual_fund: TrendingUp,
  other: HandCoins,
}

function RevalueDialog({
  record,
  circleId,
  actorUserId,
}: {
  record: CycleAssetRecord
  circleId: string
  actorUserId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(record.currentValue !== null ? String(record.currentValue) : "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setValue(record.currentValue !== null ? String(record.currentValue) : "")
      setError("")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value || Number(value) < 0) return
    setLoading(true)
    setError("")

    const result = await updateAssetRecordValue(record.id, Number(value), actorUserId, circleId)

    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    toast.success("Asset value updated")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <Pencil className="h-3 w-3" />
          {record.currentValue !== null ? "Update value" : "Set current value"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Asset Current Value</DialogTitle>
          <DialogDescription>
            Set the current value of this asset (e.g. after maturity or returns).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 p-3 rounded-xl bg-[var(--border-light)]">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">Original amount</span>
              <span className="font-tabular font-medium text-[var(--text-primary)]">
                {formatCurrency(record.amount)}
              </span>
            </div>
            {record.currentValue !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Previous current value</span>
                <span className="font-tabular text-[var(--text-primary)]">
                  {formatCurrency(record.currentValue)}
                </span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="current-value">Current Value (₹)</Label>
            <Input
              id="current-value"
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder={String(record.amount)}
              disabled={loading}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading || !value || Number(value) < 0} className="w-full">
            {loading ? "Updating..." : "Update Value"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AssetRecordList({
  records,
  circleId,
  actorUserId,
  canEdit,
}: {
  records: CycleAssetRecord[]
  circleId: string
  actorUserId: string
  canEdit: boolean
}) {
  if (records.length === 0) {
    return (
      <EmptyState
        icon={Landmark}
        title="No asset records yet"
        description={
          canEdit
            ? "Use the form above to log where asset-allocated contributions are invested."
            : "Asset allocations will appear here once the admin logs them."
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      {records.map((record) => {
        const Icon = ASSET_TYPE_ICONS[record.assetType] ?? HandCoins
        const label = ASSET_TYPE_LABELS[record.assetType] ?? record.assetType
        const hasGain = record.currentValue !== null && record.currentValue > record.amount
        const hasLoss = record.currentValue !== null && record.currentValue < record.amount

        return (
          <div
            key={record.id}
            className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border-light)]"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-teal-50 dark:bg-teal-900/20 text-teal mt-0.5">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm text-[var(--text-primary)] truncate">
                  {label}{record.institution ? ` · ${record.institution}` : ""}
                </p>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold font-tabular text-[var(--text-primary)]">
                    {formatCurrency(record.amount)}
                  </p>
                  {record.currentValue !== null && (
                    <p className={`text-xs font-tabular ${hasGain ? "text-emerald-600 dark:text-emerald-400" : hasLoss ? "text-amber-600 dark:text-amber-400" : "text-[var(--text-muted)]"}`}>
                      now {formatCurrency(record.currentValue)}
                    </p>
                  )}
                </div>
              </div>
              {record.notes && (
                <p className="text-xs text-[var(--text-muted)]">{record.notes}</p>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-[var(--text-muted)]">
                  {formatDate(record.recordedAt)} · {record.recordedByName}
                </p>
                {canEdit && (
                  <RevalueDialog record={record} circleId={circleId} actorUserId={actorUserId} />
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
