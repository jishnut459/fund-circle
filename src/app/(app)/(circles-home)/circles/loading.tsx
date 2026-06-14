export default function CirclesLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-9 w-44 bg-[var(--border-light)] rounded-lg mb-2" />
      <div className="h-4 w-24 bg-[var(--border-light)] rounded mb-8" />

      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-surface)] p-4 space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-28 bg-[var(--border-light)] rounded" />
              <div className="flex gap-1">
                <div className="h-4 w-10 bg-[var(--border-light)] rounded-full" />
                <div className="h-4 w-12 bg-[var(--border-light)] rounded-full" />
              </div>
            </div>
            <div className="h-6 w-20 bg-[var(--border-light)] rounded" />
            <div className="h-1.5 w-full bg-[var(--border-light)] rounded-full" />
            <div className="flex justify-between">
              <div className="h-3 w-24 bg-[var(--border-light)] rounded" />
              <div className="h-3 w-8 bg-[var(--border-light)] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
