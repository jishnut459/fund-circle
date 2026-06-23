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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { HandCoins } from "lucide-react"
import { adminRequestLoanOnBehalf } from "@/lib/actions"

export interface PickableMember {
  id: string
  name: string
  isManaged: boolean
}

export default function RequestLoanForMemberDialog({
  circleId,
  actorUserId,
  members,
  maxTermMonths,
}: {
  circleId: string
  actorUserId: string
  members: PickableMember[]
  maxTermMonths?: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [memberId, setMemberId] = useState("")
  const [amount, setAmount] = useState("")
  const [term, setTerm] = useState("")
  const [purpose, setPurpose] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const reset = () => {
    setMemberId("")
    setAmount("")
    setTerm("")
    setPurpose("")
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    const amountNum = Number(amount)
    const termNum = Number(term)
    if (!memberId) {
      setError("Select a member")
      return
    }
    if (!amountNum || amountNum <= 0) {
      setError("Enter a loan amount greater than zero")
      return
    }
    if (!termNum || termNum <= 0) {
      setError("Enter a term of at least 1 month")
      return
    }
    if (maxTermMonths != null && termNum > maxTermMonths) {
      setError(`Term can't exceed ${maxTermMonths} months (circle end date)`)
      return
    }

    setLoading(true)
    setError("")
    const result = await adminRequestLoanOnBehalf(circleId, memberId, amountNum, termNum, purpose.trim(), actorUserId)
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    const memberName = members.find((m) => m.id === memberId)?.name ?? "member"
    toast.success(`Loan request created for ${memberName}`, {
      description: "Review and approve it from Pending Requests.",
    })
    setOpen(false)
    reset()
    router.refresh()
  }

  if (members.length === 0) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <HandCoins className="h-4 w-4" />
          Request for member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request loan for a member</DialogTitle>
          <DialogDescription>
            Open a loan request on a member&apos;s behalf. You&apos;ll approve it from Pending Requests.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="loan-member">Member</Label>
            <Select value={memberId} onValueChange={setMemberId} disabled={loading}>
              <SelectTrigger id="loan-member">
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                    {m.isManaged ? " · Managed" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loan-amount">Amount (₹)</Label>
            <Input
              id="loan-amount"
              type="number"
              inputMode="numeric"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10000"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loan-term">
              Term (months){maxTermMonths != null && <span className="text-[var(--text-muted)] font-normal"> · max {maxTermMonths}</span>}
            </Label>
            <Input
              id="loan-term"
              type="number"
              inputMode="numeric"
              min={1}
              max={maxTermMonths}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="6"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loan-purpose">
              Purpose <span className="text-[var(--text-muted)] font-normal">(optional)</span>
            </Label>
            <Input
              id="loan-purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Medical, education…"
              disabled={loading}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating…" : "Create Request"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
