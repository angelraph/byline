import { getExplainer } from "@/lib/explain";

/**
 * "What you're betting on": the market in plain words, right above the bet buttons.
 * Render inside <Suspense>; renders nothing if the summary can't be produced.
 */
export async function MarketExplainer({ marketId, source }: { marketId: string; source: string | null }) {
  let e: Awaited<ReturnType<typeof getExplainer>>;
  try {
    e = await getExplainer(marketId);
  } catch {
    return null;
  }
  return (
    <section aria-label="What you're betting on" className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">What you&apos;re betting on</p>
      <p className="mt-2 text-sm text-paper">{e.plain}</p>
      <ul className="mt-3 space-y-2 text-sm">
        <li className="flex gap-2">
          <span className="mt-0.5 shrink-0 rounded bg-yes-bg px-1.5 py-0.5 text-[10px] font-bold text-yes">YES</span>
          <span className="text-paper-dim">{e.yesWins}</span>
        </li>
        <li className="flex gap-2">
          <span className="mt-0.5 shrink-0 rounded bg-no-bg px-1.5 py-0.5 text-[10px] font-bold text-no">NO</span>
          <span className="text-paper-dim">{e.noWins}</span>
        </li>
      </ul>
      <p className="mt-3 text-xs text-paper-mute">
        <span className="font-semibold text-paper-dim">Decided by:</span> {e.decidedBy}
      </p>
      <p className="mt-2 text-[11px] text-paper-mute">
        Plain-English summary by AI. The official result comes from the market&apos;s source{source ? "" : " named by its creator"}.
      </p>
    </section>
  );
}

export function MarketExplainerSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-line bg-ink-2 p-4" aria-busy="true" aria-label="Loading explanation">
      <div className="h-3 w-32 rounded bg-ink-3" />
      <div className="mt-3 h-3 w-full rounded bg-ink-3" />
      <div className="mt-2 h-3 w-4/5 rounded bg-ink-3" />
    </div>
  );
}
