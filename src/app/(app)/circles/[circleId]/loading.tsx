export default function CircleLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-40 bg-[var(--border-light)] rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-surface)] p-4 space-y-3">
            <div className="h-3 w-16 bg-[var(--border-light)] rounded" />
            <div className="h-6 w-20 bg-[var(--border-light)] rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-surface)] p-4 space-y-2">
            <div className="h-4 w-32 bg-[var(--border-light)] rounded" />
            <div className="h-1.5 w-full bg-[var(--border-light)] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
