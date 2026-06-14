import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center mb-5">
          <Icon className="h-8 w-8 text-teal" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-xs mb-6">
        {description}
      </p>
      {action && (
        <EmptyStateAction action={action} />
      )}
    </div>
  )
}

function EmptyStateAction({
  action,
}: {
  action: NonNullable<EmptyStateProps["action"]>
}) {
  const className =
    "inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-dark transition-all active:scale-[0.98]"

  if (action.href) {
    return (
      <a href={action.href} className={className}>
        {action.label}
      </a>
    )
  }

  return (
    <button onClick={action.onClick} className={className}>
      {action.label}
    </button>
  )
}
