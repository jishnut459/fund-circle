"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
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
import { CalendarRange } from "lucide-react"
import { extendCircleEndDate } from "@/lib/actions"
import { formatDate } from "@/lib/format"

export default function ExtendCircleDialog({
  circleId,
  actorUserId,
  currentEndDate,
  startDate,
}: {
  circleId: string
  actorUserId: string
  currentEndDate: string | null
  startDate: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [endDate, setEndDate] = useState(currentEndDate ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    if (value) {
      setEndDate(currentEndDate ?? "")
      setError("")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!endDate) return
    setLoading(true)
    setError("")

    const result = await extendCircleEndDate(circleId, endDate, actorUserId)

    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    toast.success(`Circle end date extended to ${formatDate(endDate)}`)
    setOpen(false)
    router.refresh()
  }

  const minDate = currentEndDate || startDate || undefined

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <CalendarRange className="h-4 w-4" />
          Extend End Date
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend Circle End Date</DialogTitle>
          <DialogDescription>
            {currentEndDate
              ? `The circle currently ends ${formatDate(currentEndDate)}. Choose a later date to extend it.`
              : "Choose an end date for this circle."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="end-date">New End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              min={minDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={loading}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading || !endDate} className="w-full">
            {loading ? "Saving..." : "Save New End Date"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
