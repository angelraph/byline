import type { Metadata } from "next";
import Link from "next/link";
import { getBlotter, getTerminal, BIG_TRADE_SHARES } from "@/lib/wire";
import { isBuyable } from "@/lib/panta/api";
import type { Market } from "@/lib/panta/schemas";
import { safe } from "@/lib/data/safe";
import { cents, marketTitle, num, relativeTime, shortAddr, usdc } from "@/lib/format";
import { Notice, PhaseBadge, SectionHeader } from "@/components/ui";
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
  const now = Date.now() / 1000;
  const rows = sortMarkets(
    all.filter((m) => matches(m, filter) && (!cat || m.category === cat) && (!q || marketTitle(m).toLowerCase().includes(q))),
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

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={30} />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">The Wire</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">Every market. Every trade.</h1>
        </div>
        <form action="/wire" className="flex w-full gap-2 sm:w-80">
          {filter !== "open" ? <input type="hidden" name="f" value={filter} /> : null}
          {cat ? <input type="hidden" name="c" value={cat} /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search markets"
            aria-label="Search markets"
            className="w-full rounded-full border border-line bg-ink-2 px-4 py-2 text-sm outline-none focus:border-paper-mute"
          />
        </form>
      </header>

      {!terminal.ok ? <Notice tone="error">Panta catalog unavailable: {terminal.error}</Notice> : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-2">
            {(["open", "graduated", "resolved", "all"] as const).map((f) => (
              <Link key={f} href={link({ f })} className={`rounded-full border px-3 py-1.5 text-sm capitalize ${filter === f ? "border-paper bg-paper text-ink" : "border-line text-paper-dim hover:text-paper"}`}>
                {f}
              </Link>
            ))}
            <span className="mx-1 hidden h-5 w-px self-center bg-line sm:block" aria-hidden="true" />
            {(["volume", "closing", "newest"] as const).map((s) => (
              <Link key={s} href={link({ s })} className={`rounded-full px-3 py-1.5 text-sm capitalize ${sort === s ? "bg-ink-3 text-paper" : "text-paper-dim hover:text-paper"}`}>
                {s}
              </Link>
            ))}
          </div>
          <div className="-mx-4 mb-4 flex gap-2 no-scrollbar overflow-x-auto px-4">
            <Link href={link({ c: null })} className={`shrink-0 rounded-full px-3 py-1 text-xs ${!cat ? "bg-ink-3 text-paper" : "text-paper-mute hover:text-paper"}`}>All categories</Link>
            {categories.map((c) => (
              <Link key={c} href={link({ c })} className={`shrink-0 rounded-full px-3 py-1 text-xs capitalize ${cat === c ? "bg-ink-3 text-paper" : "text-paper-mute hover:text-paper"}`}>
                {c.replace(/-/g, " ")}
              </Link>
            ))}
          </div>

          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong p-8 text-center text-sm text-paper-mute">
              No markets match. {filter === "open" ? <Link href="/forge" className="text-accent underline">Forge one</Link> : null}
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {rows.map((m) => {
                const closes = m.endTime ? m.endTime - now : null;
                return (
                  <li key={m.marketId}>
                    <Link href={`/m/${m.marketId}`} className="flex items-center gap-3 bg-ink-2 px-4 py-3 transition hover:bg-ink-3">
                      {m.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.images[0]} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" loading="lazy" />
                      ) : (
                        <span className="h-10 w-10 shrink-0 rounded-lg bg-ink-3" aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm">{marketTitle(m)}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-paper-mute">
                          <span className="capitalize">{m.category.replace(/-/g, " ")}</span>
                          <PhaseBadge phase={m.resolved ? "resolved" : m.phase} />
                          {m.endTime !== null && closes !== null && closes > 0 && isBuyable(m) ? <span>closes {relativeTime(m.endTime * 1000)}</span> : null}
                        </p>
                      </div>
                      <div className="shrink-0 text-right font-mono text-xs tabular">
                        {isBuyable(m) ? (
                          <p><span className="text-yes">{cents(m.yesPrice)}</span> <span className="text-paper-mute">/</span> <span className="text-no">{cents(m.noPrice)}</span></p>
                        ) : null}
                        <p className="text-paper-mute">{usdc(m.totalVolumeUsdc ?? m.volumeUsdc, { compact: true })}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
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
