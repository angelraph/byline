import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { getPositions, getPricedCatalog, getWalletTrades } from "@/lib/panta/api";
import { safe } from "@/lib/data/safe";
import { buildCalls, computeStats, type CallRecord } from "@/lib/stats";
import { cents, marketTitle, pct, relativeTime, shortAddr, signedPct, usdc } from "@/lib/format";
import { EmptyState, Notice, SectionHeader } from "@/components/ui";
import { ShareButton } from "@/components/share-button";
import { CallCard } from "@/components/social/call-card";
import { isDbConfigured } from "@/lib/db";
import { listCalls } from "@/lib/social";
import { DivisionBadge } from "@/components/division-badge";
import { divisionFor } from "@/lib/divisions";

export const revalidate = 30;

function validWallet(w: string): boolean {
  try {
    new PublicKey(w);
    return true;
  } catch {
    return false;
  }
}

async function loadByline(wallet: string) {
  const [positions, trades] = await Promise.all([
    safe(() => getPositions(wallet)),
    safe(() => getWalletTrades(wallet, 200)),
  ]);
  const calls = positions.ok ? buildCalls(positions.data.positions, trades.ok ? trades.data.items : []) : [];
  return { positions, trades, calls, stats: computeStats(calls) };
}

export async function generateMetadata({ params }: { params: Promise<{ wallet: string }> }): Promise<Metadata> {
  const { wallet } = await params;
  if (!validWallet(wallet)) return { title: "Byline" };
  const { stats } = await loadByline(wallet);
  const line =
    stats.hitRate !== null
      ? `${stats.wins}-${stats.losses} · ${pct(stats.hitRate)} hit rate · ${signedPct(stats.roi)} ROI`
      : `${stats.open} open calls`;
  return {
    title: `${shortAddr(wallet)}'s byline`,
    description: `Verified on-chain record on Panta: ${line}.`,
  };
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "yes" | "no" }) {
  return (
    <div className="rounded-xl border border-line bg-ink-2 p-4">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-paper-mute">{label}</dt>
      <dd className={`mt-1 font-mono text-2xl tabular ${tone === "yes" ? "text-yes" : tone === "no" ? "text-no" : ""}`}>{value}</dd>
      {sub ? <p className="mt-0.5 text-xs text-paper-mute">{sub}</p> : null}
    </div>
  );
}

function CallRow({ c }: { c: CallRecord }) {
  const badge = {
    open: "bg-ink-3 text-paper-dim",
    won: "bg-yes-bg text-yes",
    lost: "bg-no-bg text-no",
    cancelled: "bg-ink-3 text-paper-mute",
  }[c.status];
  const result =
    c.status === "open"
      ? c.currentValue !== null
        ? `Worth ${usdc(c.currentValue)}`
        : "Open"
      : c.status === "won"
        ? c.payoutEstimated
          ? `Won · claim ~${usdc(c.payout)}`
          : `Paid ${usdc(c.payout)}`
        : c.status === "lost"
          ? "Paid $0.00"
          : "Cancelled";
  return (
    <li>
      <Link href={`/m/${c.marketId}`} className="flex gap-3 rounded-xl border border-line bg-ink-2 p-3 transition hover:border-line-strong sm:p-4">
        {c.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />
        ) : (
          <span className="h-12 w-12 shrink-0 rounded-lg bg-ink-3" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm leading-snug">{c.title || `Market ${shortAddr(c.marketId)}`}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${badge}`}>{c.status}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs tabular text-paper-dim">
            <span className={c.side === "yes" ? "text-yes" : "text-no"}>{c.side.toUpperCase()}</span>
            <span>{c.shares.toFixed(2)} sh</span>
            {c.entryPrice !== null ? <span>@ {cents(c.entryPrice)}</span> : null}
            {c.cost !== null && c.cost > 0 ? <span>{c.hedged ? "market cost" : "cost"} {usdc(c.cost)}</span> : null}
            <span className="text-paper">{result}</span>
            {c.hedged ? <span className="text-accent">hedged · not scored</span> : null}
            {c.calledAt ? <span className="ml-auto text-paper-mute">{relativeTime(c.calledAt * 1000)}</span> : null}
          </div>
        </div>
      </Link>
    </li>
  );
}

export default async function BylinePage({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  if (!validWallet(wallet)) notFound();
  const { positions, trades, calls, stats } = await loadByline(wallet);
  const written = isDbConfigured() ? await listCalls({ wallet, limit: 30 }).catch(() => []) : [];
  const titles = new Map<string, string>();
  if (written.length > 0) {
    const catalog = await safe(() => getPricedCatalog());
    if (catalog.ok) for (const m of catalog.data) titles.set(m.marketId, marketTitle(m));
  }
  const fallbackTrades = !positions.ok && trades.ok ? trades.data.items.filter((t) => t.kind === "buy") : [];

  const open = calls.filter((c) => c.status === "open");
  const settled = calls.filter((c) => c.status !== "open");

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Byline · verified on Panta</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="break-all font-display text-3xl font-bold sm:text-4xl">{shortAddr(wallet, 6)}</h1>
            {positions.ok ? <DivisionBadge d={divisionFor(stats)} size="md" /> : null}
          </div>
          <p className="mt-1 text-sm text-paper-dim">
            Every call below is an on-chain Panta position. Outcomes and payouts come from the chain, not from this page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <ShareButton
            path={`/u/${wallet}`}
            text={
              stats.resolved > 0
                ? `Verified on-chain record on Byline: ${stats.wins}–${stats.losses}, ${signedPct(stats.edge)} edge vs the market. Receipts, not screenshots.`
                : "My calls are on-chain on Byline. Receipts, not screenshots."
            }
          />
          <a
            href={`https://solscan.io/account/${wallet}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-line-strong px-4 py-2 text-sm hover:border-paper-mute"
          >
            Solscan ↗
          </a>
        </div>
      </header>

      {!positions.ok ? (
        <Notice tone="warn">
          Panta&apos;s positions service isn&apos;t answering for this wallet right now, so outcomes and the scored record are paused.
          The on-chain trade history below is live; the full record returns automatically when Panta recovers.
        </Notice>
      ) : null}

      {fallbackTrades.length > 0 ? (
        <section>
          <SectionHeader kicker="On-chain" title={`Trade history (${fallbackTrades.length})`} />
          <ul className="space-y-2">
            {fallbackTrades.map((t) => (
              <li key={t.signature} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-2 p-3 font-mono text-sm tabular">
                <Link href={`/m/${t.marketId}`} className="min-w-0 truncate hover:text-accent">{shortAddr(t.marketId, 6)}</Link>
                <span className={t.side === "no" ? "text-no" : "text-yes"}>{(t.side ?? "yes").toUpperCase()}</span>
                <span>{t.shares !== null ? `${Number(t.shares).toFixed(2)} sh` : "—"}</span>
                <span className="hidden text-paper-mute sm:inline">{t.blockTime ? relativeTime(t.blockTime * 1000) : ""}</span>
                <a href={`https://solscan.io/tx/${t.signature}`} target="_blank" rel="noreferrer" className="text-xs text-paper-mute hover:text-accent">tx ↗</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {positions.ok ? (
        <>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Record"
          value={stats.resolved > 0 ? `${stats.wins}–${stats.losses}` : "—"}
          sub={stats.resolved > 0 ? `${pct(stats.hitRate)} hit rate` : "No resolved calls yet"}
        />
        <Stat
          label="Edge vs market"
          value={stats.edge !== null ? signedPct(stats.edge) : "—"}
          sub={stats.expectedHitRate !== null ? `Paid for ${pct(stats.expectedHitRate)}, hit ${pct(stats.hitRate)}` : "Beat the odds you paid"}
          tone={stats.edge === null ? undefined : stats.edge >= 0 ? "yes" : "no"}
        />
        <Stat
          label="ROI (resolved)"
          value={signedPct(stats.roi)}
          sub={stats.costResolved > 0 ? `${usdc(stats.payoutResolved)} back on ${usdc(stats.costResolved)}` : undefined}
          tone={stats.roi === null ? undefined : stats.roi >= 0 ? "yes" : "no"}
        />
        <Stat
          label="Streak"
          value={stats.streak ? `${stats.streak.kind === "won" ? "W" : "L"}${stats.streak.count}` : "—"}
          sub={`${stats.open} open · ${usdc(stats.openValue)} live value`}
          tone={stats.streak ? (stats.streak.kind === "won" ? "yes" : "no") : undefined}
        />
      </dl>
      {stats.hitRate !== null && stats.expectedHitRate !== null ? (
        <div className="card p-5" aria-label="Odds paid versus results">
          <p className="text-sm font-semibold">Beat the market?</p>
          <p className="mt-0.5 text-xs text-paper-mute">The odds this byline paid for, against how often the calls actually hit.</p>
          <div className="mt-4 space-y-3 text-sm">
            {[
              { label: "Paid for", value: stats.expectedHitRate, cls: "bg-paper-mute" },
              { label: "Hit", value: stats.hitRate, cls: stats.hitRate >= stats.expectedHitRate ? "bg-yes" : "bg-no" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-paper-dim">{row.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-3">
                  <div className={`bar-grow h-full rounded-full ${row.cls}`} style={{ width: `${Math.round(row.value * 100)}%` }} />
                </div>
                <span className="w-12 shrink-0 text-right font-semibold tabular">{pct(row.value)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {stats.hedgedMarkets > 0 ? (
        <p className="text-xs text-paper-mute">
          {stats.hedgedMarkets} market{stats.hedgedMarkets === 1 ? "" : "s"} held on both sides {stats.hedgedMarkets === 1 ? "is" : "are"} excluded from scoring.
        </p>
      ) : null}

      <section>
        <SectionHeader kicker="Live" title={`Open calls (${open.length})`} />
        {open.length === 0 ? (
          <EmptyState
            title="No open calls"
            body="Back a market from the Slate and it shows up here the moment it lands on-chain."
            action={<Link href="/slate" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Open the Slate</Link>}
          />
        ) : (
          <ul className="space-y-2">{open.map((c) => <CallRow key={`${c.marketId}-${c.side}`} c={c} />)}</ul>
        )}
      </section>

      {written.length > 0 ? (
        <section>
          <SectionHeader kicker="In their words" title={`Written calls (${written.length})`} />
          <div className="space-y-3">
            {written.map((c) => (
              <CallCard key={c.id} call={c} marketTitle={titles.get(c.market_id)} showActions={false} />
            ))}
          </div>
        </section>
      ) : null}

      {settled.length > 0 ? (
        <section>
          <SectionHeader kicker="On the record" title={`Settled (${settled.length})`} />
          <ul className="space-y-2">{settled.map((c) => <CallRow key={`${c.marketId}-${c.side}`} c={c} />)}</ul>
        </section>
      ) : null}
        </>
      ) : null}
    </div>
  );
}
