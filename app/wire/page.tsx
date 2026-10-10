import type { Metadata } from "next";
import Link from "next/link";
import { getBlotter, getTerminal, BIG_TRADE_SHARES } from "@/lib/wire";
import { isBuyable } from "@/lib/panta/api";
import type { Market } from "@/lib/panta/schemas";
import { safe } from "@/lib/data/safe";
import { marketTitle, num, relativeTime, shortAddr } from "@/lib/format";
import { Notice, SectionHeader } from "@/components/ui";
import { MarketCard } from "@/components/market-card";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata: Metadata = {
  title: "The Wire",
  description: "Every Panta market and the live trade blotter in one terminal.",
};
export const revalidate = 30;

type Filter = "open" | "graduated" | "resolved" | "all";
type Sort = "volume" | "closing" | "newest";

function matches(m: Market, f: Filter): boolean {
  if (f === "open") return isBuyable(m);
  if (f === "graduated") return m.phase === "secondary" && !m.resolved;
  if (f === "resolved") return m.resolved || m.phase === "resolved";
  return true;
}

function sortMarkets(ms: Market[], s: Sort): Market[] {
  const copy = [...ms];
  if (s === "closing") return copy.sort((a, b) => (a.endTime ?? Infinity) - (b.endTime ?? Infinity));
  if (s === "newest") return copy.sort((a, b) => (b.startTime ?? 0) - (a.startTime ?? 0));
  return copy.sort((a, b) => (num(b.totalVolumeUsdc ?? b.volumeUsdc) ?? 0) - (num(a.totalVolumeUsdc ?? a.volumeUsdc) ?? 0));
}

export default async function WirePage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; s?: string; c?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const filter: Filter = (["open", "graduated", "resolved", "all"] as const).find((x) => x === sp.f) ?? "open";
  const sort: Sort = (["volume", "closing", "newest"] as const).find((x) => x === sp.s) ?? "volume";
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 80);

  const [terminal, blotter] = await Promise.all([safe(() => getTerminal()), safe(() => getBlotter())]);
  const all = terminal.ok ? terminal.data : [];
  const categories = [...new Set(all.map((m) => m.category))].sort();
  const cat = sp.c && categories.includes(sp.c) ? sp.c : null;
  const rows = sortMarkets(
    all.filter((m) => matches(m, filter) && (!cat || m.category === cat) && (!q || `${marketTitle(m)} ${m.description} ${m.category}`.toLowerCase().includes(q))),
    filter === "open" && sort === "volume" ? "closing" : sort,
  );

  const link = (patch: Partial<{ f: Filter; s: Sort; c: string | null }>) => {
    const p = new URLSearchParams();
    const f = patch.f ?? filter;
    const s = patch.s ?? sort;
    const c = patch.c === undefined ? cat : patch.c;
    if (f !== "open") p.set("f", f);
    if (s !== "volume") p.set("s", s);
    if (c) p.set("c", c);
    if (q) p.set("q", q);
    const qs = p.toString();
    return qs ? `/wire?${qs}` : "/wire";
  };

  const SORT_LABEL: Record<Sort, string> = { volume: "Top", closing: "Closing soon", newest: "New" };
  const STATUS_LABEL: Record<Filter, string> = { open: "Open", graduated: "Graduated", resolved: "Resolved", all: "All" };

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={30} />
      <header className="animate-fade-up">
        <p className="text-sm font-semibold text-accent">Markets</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">{q ? `Results for "${q}"` : "Every market. Every trade."}</h1>
        <p className="mt-2 text-paper-dim">The full Panta catalog with live prices, plus a blotter of trades as they land.</p>
      </header>

      {!terminal.ok ? <Notice tone="error">Panta catalog unavailable: {terminal.error}</Notice> : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line">
            <nav className="no-scrollbar -mb-px flex gap-1 overflow-x-auto" aria-label="Status">
              {(["open", "graduated", "resolved", "all"] as const).map((f) => (
                <Link
                  key={f}
                  href={link({ f })}
                  className={`shrink-0 border-b-2 px-3 pb-2.5 text-sm font-medium ${filter === f ? "border-accent text-paper" : "border-transparent text-paper-dim hover:text-paper"}`}
                >
                  {STATUS_LABEL[f]}
                </Link>
              ))}
            </nav>
            <div className="mb-2 inline-flex rounded-full border border-line bg-ink-2 p-0.5" role="group" aria-label="Sort">
              {(["volume", "closing", "newest"] as const).map((s) => (
                <Link
                  key={s}
                  href={link({ s })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${sort === s ? "bg-accent text-accent-ink" : "text-paper-dim hover:text-paper"}`}
                >
                  {SORT_LABEL[s]}
                </Link>
              ))}
            </div>
          </div>
          <div className="no-scrollbar -mx-4 my-4 flex gap-2 overflow-x-auto px-4">
            <Link href={link({ c: null })} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${!cat ? "border-accent bg-accent-soft text-paper" : "border-line text-paper-dim hover:text-paper"}`}>
              All topics
            </Link>
            {categories.map((c) => (
              <Link key={c} href={link({ c })} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${cat === c ? "border-accent bg-accent-soft text-paper" : "border-line text-paper-dim hover:text-paper"}`}>
                {c.replace(/-/g, " ")}
              </Link>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="card p-10 text-center text-sm text-paper-dim">
              No markets match.{" "}
              {filter === "open" ? <Link href="/forge" className="font-semibold text-accent">Create one →</Link> : null}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {rows.map((m) => (
                <MarketCard key={m.marketId} m={m} buyable={isBuyable(m)} />
              ))}
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <SectionHeader kicker="Live" title="Blotter" />
          {!blotter.ok ? (
            <Notice tone="error">Blotter delayed: {blotter.error}</Notice>
          ) : blotter.data.rows.length === 0 ? (
            <p className="text-sm text-paper-mute">No trades yet.</p>
          ) : (
            <ol className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
              {blotter.data.rows.map((t) => {
                const shares = num(t.shares) ?? 0;
                const big = t.kind === "buy" && shares >= BIG_TRADE_SHARES;
                return (
                  <li key={t.signature} className={`rounded-lg px-3 py-2 ${big ? "border border-accent/40 bg-accent/10" : "bg-ink-2"}`}>
                    <div className="flex items-center justify-between gap-2 font-mono text-[11px] tabular">
                      <span className={t.kind === "claim" ? "text-accent" : t.side === "no" ? "text-no" : "text-yes"}>
                        {t.kind === "claim" ? "CLAIM" : `${big ? "SIZE · " : ""}${(t.side ?? "yes").toUpperCase()}`} {shares.toFixed(2)}
                      </span>
                      <span className="text-paper-mute">{t.blockTime ? relativeTime(t.blockTime * 1000) : ""}</span>
                    </div>
                    <Link href={`/m/${t.marketId}`} className="mt-0.5 line-clamp-1 text-xs text-paper-dim hover:text-paper">
                      {t.title || `Market ${shortAddr(t.marketId)}`}
                    </Link>
                    <Link href={`/u/${t.wallet}`} className="font-mono text-[10px] text-paper-mute hover:text-accent">{shortAddr(t.wallet)}</Link>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}
