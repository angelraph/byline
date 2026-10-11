import { getMarketBrief } from "@/lib/brief";
import { AiError } from "@/lib/ai";
import { relativeTime } from "@/lib/format";

/** Server component; render inside <Suspense> so the market page never waits on the model. */
export async function MarketBrief({ marketId }: { marketId: string }) {
  try {
    const b = await getMarketBrief(marketId);
    return (
      <section aria-label="AI brief" className="rounded-2xl border border-line bg-ink-2 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Brief</p>
        <h2 className="mt-1 font-display text-xl font-semibold leading-snug">{b.headline}</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-semibold text-paper-mute">What the market thinks</dt>
            <dd className="mt-0.5 text-paper">{b.marketView}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-paper-mute">Where the money is going</dt>
            <dd className="mt-0.5 text-paper">{b.moneyFlow}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-paper-mute">What decides it</dt>
            <dd className="mt-0.5 text-paper">{b.decider}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[11px] text-paper-mute">
          AI summary of this market&apos;s price and recent bets · updated {relativeTime(b.generatedAt)} · not financial advice
        </p>
      </section>
    );
  } catch (err) {
    const notConfigured = err instanceof AiError && err.code === "NOT_CONFIGURED";
    return (
      <section className="rounded-2xl border border-dashed border-line-strong p-5 text-sm text-paper-mute">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em]">Brief</p>
        <p className="mt-1">
          {notConfigured ? "AI briefs are switched off on this server." : "The AI brief couldn't be written right now. It will retry on the next visit."}
        </p>
      </section>
    );
  }
}

export function MarketBriefSkeleton() {
  return (
    <section className="animate-pulse rounded-2xl border border-line bg-ink-2 p-5" aria-busy="true" aria-label="Loading AI brief">
      <div className="h-3 w-16 rounded bg-ink-3" />
      <div className="mt-3 h-5 w-3/4 rounded bg-ink-3" />
      <div className="mt-3 h-3 w-full rounded bg-ink-3" />
      <div className="mt-2 h-3 w-5/6 rounded bg-ink-3" />
    </section>
  );
}
