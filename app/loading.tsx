/** Instant feedback on every navigation while the page's live data streams in. */
export default function Loading() {
  return (
    <div className="animate-fade-up space-y-8 py-4" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <div className="h-4 w-24 animate-pulse rounded-full bg-accent-soft" />
        <div className="h-10 w-2/3 max-w-lg animate-pulse rounded-xl bg-ink-2" />
        <div className="h-4 w-1/2 max-w-md animate-pulse rounded-full bg-ink-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="card space-y-4 p-4">
            <div className="flex gap-3">
              <div className="h-11 w-11 animate-pulse rounded-xl bg-ink-3" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-ink-3" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-ink-3" />
              </div>
            </div>
            <div className="h-1.5 animate-pulse rounded-full bg-ink-3" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-9 animate-pulse rounded-lg bg-ink-3" />
              <div className="h-9 animate-pulse rounded-lg bg-ink-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
