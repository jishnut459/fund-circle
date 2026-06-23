import { formatDate, formatMonthYear, formatOrdinal } from "./format"

export type CyclePeriod = {
  start: Date
  end: Date
  dueDate: Date
  label: string
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Computes the cycle period (start/end dates), the payment due date, and a
 * display label for the given contribution frequency, anchored to referenceDate.
 *
 * dueDay meaning depends on frequency:
 * - monthly/quarterly: day of month (1-31, clamped to the relevant month's length)
 * - weekly: ISO weekday (1 = Monday ... 7 = Sunday)
 * - daily: ignored (due date is always the same day)
 * If dueDay is not provided, the due date defaults to the end of the period.
 */
export function getCyclePeriod(frequency: string, referenceDate: Date, dueDay?: number | null): CyclePeriod {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const date = referenceDate.getDate()

  switch (frequency) {
    case "daily": {
      const start = new Date(year, month, date)
      return { start, end: start, dueDate: start, label: formatDate(start) }
    }
    case "weekly": {
      const day = referenceDate.getDay()
      const diffToMonday = day === 0 ? -6 : 1 - day
      const start = new Date(year, month, date + diffToMonday)
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
      const offset = dueDay ? Math.min(Math.max(dueDay, 1), 7) - 1 : 6
      const dueDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset)
      return { start, end, dueDate, label: `Week of ${formatDate(start)}` }
    }
    case "quarterly": {
      const quarterStartMonth = Math.floor(month / 3) * 3
      const start = new Date(year, quarterStartMonth, 1)
      const end = new Date(year, quarterStartMonth + 3, 0)
      const quarterNumber = quarterStartMonth / 3 + 1
      const day = dueDay ? Math.min(dueDay, daysInMonth(year, quarterStartMonth)) : end.getDate()
      const dueDate = dueDay ? new Date(year, quarterStartMonth, day) : end
      return { start, end, dueDate, label: `Q${quarterNumber} ${year}` }
    }
    case "monthly":
    default: {
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 0)
      const day = dueDay ? Math.min(dueDay, daysInMonth(year, month)) : end.getDate()
      const dueDate = dueDay ? new Date(year, month, day) : end
      return { start, end, dueDate, label: formatMonthYear(start) }
    }
  }
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/** Human-readable description of a circle's cycle_due_day setting, e.g. "Every Friday" or "5th of each month". */
export function describeCycleDueDay(frequency: string, dueDay: number | null): string {
  switch (frequency) {
    case "weekly":
      return dueDay ? `Every ${WEEKDAY_NAMES[dueDay % 7]}` : "End of each week"
    case "quarterly":
      return dueDay ? `${formatOrdinal(dueDay)} of the quarter's first month` : "Last day of the month"
    case "monthly":
      return dueDay ? `${formatOrdinal(dueDay)} of each month` : "Last day of the month"
    default:
      return "Same day"
  }
}

/**
 * Whether a cycle is past its payment deadline (due date + grace days) as of
 * `asOf` (default: today). Dates are compared by local calendar day so a
 * payment made on the deadline day is still on time.
 */
export function isCycleOverdue(dueDate: string | null, graceDays: number, asOf?: Date): boolean {
  if (!dueDate) return false
  const [y, m, d] = dueDate.split("-").map(Number)
  if (!y || !m || !d) return false
  const deadline = new Date(y, m - 1, d + (graceDays || 0))
  const now = asOf ?? new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return today > deadline
}

/** Formats a Date as YYYY-MM-DD using local date components (avoids UTC day-shift). */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
