export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateLike: string | Date): string {
  const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function formatDateTime(dateLike: string | Date): string {
  const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike
  if (isNaN(d.getTime())) return "—"
  return `${formatDate(d)} at ${d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleString("en-IN", { month: "long", year: "numeric" })
}

export function formatISODate(iso: string): string {
  if (!iso) return "—"
  return formatDate(iso)
}

export function formatPercentage(paid: number, expected: number): number {
  if (expected <= 0) return 0
  return Math.round((paid / expected) * 100)
}
