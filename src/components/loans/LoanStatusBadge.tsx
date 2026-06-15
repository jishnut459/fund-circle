export default function LoanStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending_request: "Pending Review",
    rejected: "Rejected",
    cancelled: "Cancelled",
    active: "Active",
    closed: "Closed",
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          status === "closed" ? "bg-emerald-500" :
          status === "active" ? "bg-blue-500" :
          "bg-gray-300 dark:bg-gray-600"
        }`}
      />
      <span className="text-xs font-medium text-[var(--text-secondary)]">
        {labels[status] ?? status}
      </span>
    </div>
  )
}
