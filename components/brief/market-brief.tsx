import { getMarketBrief } from "@/lib/brief";
import { AiError } from "@/lib/ai";
import { relativeTime } from "@/lib/format";

/** Server component; render inside <Suspense> so the market page never waits on the model. */
export async function MarketBrief({ marketId }: { marketId: string }) {
  try {
    const b = await getMarketBrief(marketId);
    return (
      <section aria-label="AI brief" className="rounded-2xl border border-line bg-ink-2 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Brief</p>
        <h2 className="mt-1 font-serif text-xl font-semibold leading-snug">{b.headline}</h2>
        <p className="mt-2 text-sm text-paper-dim">{b.read}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-yes-bg p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-yes">The YES case</p>
            <p className="mt-1 text-sm">{b.yesCase}</p>
          </div>
          <div className="rounded-xl bg-no-bg p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-no">The NO case</p>
            <p className="mt-1 text-sm">{b.noCase}</p>
          </div>
        </div>
        <p className="mt-3 text-sm"><span className="text-paper-mute">Watch:</span> {b.watch}</p>
        <p className="mt-3 text-[11px] text-paper-mute">
          Written by AI from Panta&apos;s live price and trade tape · {relativeTime(b.generatedAt)} · not advice.
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
