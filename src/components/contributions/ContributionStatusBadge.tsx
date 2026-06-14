import { Badge } from "@/components/ui/badge"

export default function ContributionStatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "success" | "warning" | "info"> = {
    unpaid: "default",
    partially_paid: "warning",
    paid: "success",
    overpaid: "info",
  }

  const labels: Record<string, string> = {
    unpaid: "Unpaid",
    partially_paid: "Partial",
    paid: "Paid",
    overpaid: "Overpaid",
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          status === "paid" ? "bg-emerald-500" :
          status === "partially_paid" ? "bg-amber-500" :
          status === "overpaid" ? "bg-blue-500" :
          "bg-gray-300 dark:bg-gray-600"
        }`}
      />
      <span className="text-xs font-medium text-[var(--text-secondary)]">
        {labels[status] ?? status}
      </span>
    </div>
  )
}
