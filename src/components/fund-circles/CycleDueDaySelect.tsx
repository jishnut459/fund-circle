"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { formatOrdinal } from "@/lib/format"

const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
]

const MONTH_DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

/** Sensible default cycle_due_day for a given frequency (null = no setting needed). */
export function getDefaultDueDay(frequency: string): number | null {
  switch (frequency) {
    case "weekly": return 7
    case "monthly": return 1
    case "quarterly": return 1
    default: return null
  }
}

export default function CycleDueDaySelect({
  frequency,
  value,
  onChange,
  disabled,
}: {
  frequency: string
  value: number | null
  onChange: (value: number) => void
  disabled?: boolean
}) {
  if (frequency === "daily") return null

  if (frequency === "weekly") {
    return (
      <div className="space-y-2">
        <Label htmlFor="dueDay">Payment due by</Label>
        <Select value={String(value ?? 7)} onValueChange={(v) => onChange(Number(v))} disabled={disabled}>
          <SelectTrigger id="dueDay">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEEKDAYS.map((d) => (
              <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="dueDay">Payment due by</Label>
      <Select value={String(value ?? 1)} onValueChange={(v) => onChange(Number(v))} disabled={disabled}>
        <SelectTrigger id="dueDay">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTH_DAYS.map((d) => (
            <SelectItem key={d} value={String(d)}>
              {formatOrdinal(d)}{frequency === "quarterly" ? " of the quarter" : " of the month"}
            </SelectItem>
          ))}
          <SelectItem value="0">Last day of the month</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
