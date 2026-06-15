"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { addCycleAssetRecord } from "@/lib/actions"
import type { AssetType } from "@/lib/types"

const ASSET_TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: "recurring_deposit", label: "Recurring Deposit" },
  { value: "fixed_deposit", label: "Fixed Deposit" },
  { value: "cash_in_hand", label: "Cash in Hand" },
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "other", label: "Other" },
]

export default function AssetRecordForm({
  circleId,
  actorUserId,
  cycleId,
  suggestedAmount,
}: {
  circleId: string
  actorUserId: string
  cycleId?: string | null
  suggestedAmount?: number
}) {
  const router = useRouter()
  const [assetType, setAssetType] = useState<AssetType>("recurring_deposit")
  const [institution, setInstitution] = useState("")
  const [amount, setAmount] = useState(suggestedAmount !== undefined ? String(suggestedAmount) : "")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) < 0) return
    setLoading(true)
    setError("")

    const result = await addCycleAssetRecord(
      circleId,
      cycleId ?? null,
      assetType,
      institution,
      Number(amount),
      notes,
      actorUserId
    )

    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    toast.success("Asset allocation recorded")
    setInstitution("")
    setAmount(suggestedAmount !== undefined ? String(suggestedAmount) : "")
    setNotes("")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="asset-type">Asset Type</Label>
          <Select
            value={assetType}
            onValueChange={(v) => setAssetType(v as AssetType)}
            disabled={loading}
          >
            <SelectTrigger id="asset-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="asset-amount">Amount (₹)</Label>
          <Input
            id="asset-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
            disabled={loading}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="asset-institution">Institution (optional)</Label>
        <Input
          id="asset-institution"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          placeholder="SBI"
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="asset-notes">Notes (optional)</Label>
        <Input
          id="asset-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="RD opened for Q2 collections"
          disabled={loading}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading || !amount || Number(amount) < 0}>
        {loading ? "Saving..." : "Add Asset Record"}
      </Button>
    </form>
  )
}
