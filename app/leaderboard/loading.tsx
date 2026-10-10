export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading leaderboard">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Leaderboard</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Who actually calls it</h1>
        <p className="mt-2 text-paper-dim">Scoring every active wallet&apos;s on-chain record…</p>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-2" />
        ))}
      </div>
    </div>
  );
}
