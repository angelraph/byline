import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getMarketMerged, getMarketTrades, isBuyable } from "@/lib/panta/api";
import { PantaError } from "@/lib/panta/client";
import type { Market, Trade } from "@/lib/panta/schemas";
import { safe } from "@/lib/data/safe";
import { cents, marketTitle, num, pct, relativeTime, shortAddr, usdc } from "@/lib/format";
import { Notice, PhaseBadge, SectionHeader } from "@/components/ui";
import { LocalTime } from "@/components/local-time";
import { BuyPanel } from "@/components/trade/buy-panel";
import { ShareButton } from "@/components/share-button";
import { MarketBrief, MarketBriefSkeleton } from "@/components/brief/market-brief";

export const revalidate = 10;

async function loadMarket(id: string): Promise<Market | null> {
  try {
    return await getMarketMerged(id);
  } catch (err) {
    if (err instanceof PantaError && (err.code === "MARKET_NOT_FOUND" || err.status === 404)) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const m = await safe(() => getMarketMerged(id));
  if (!m.ok) return { title: "Market" };
  const title = marketTitle(m.data);
  return {
    title,
    description: `YES ${cents(m.data.yesPrice)} · NO ${cents(m.data.noPrice)} on Panta. Make the call on Byline.`,
  };
}

function TapeRow({ t }: { t: Trade }) {
  const side = t.side ?? (num(t.yesAmount) ? "yes" : "no");
  const shares = t.shares ?? null;
  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-2.5 pr-3">
        <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase ${side === "yes" ? "bg-yes-bg text-yes" : "bg-no-bg text-no"}`}>
          {side}
        </span>
      </td>
      <td className="py-2.5 pr-3 font-mono tabular text-sm">{shares !== null ? Number(shares).toFixed(2) : "—"}</td>
      <td className="py-2.5 pr-3">
        <Link href={`/u/${t.wallet}`} className="font-mono text-sm text-paper-dim hover:text-paper">
          {shortAddr(t.wallet)}
        </Link>
      </td>
      <td className="hidden py-2.5 pr-3 text-xs text-paper-mute sm:table-cell">{t.isPrimary ? "Primary" : "Secondary"}</td>
      <td className="py-2.5 pr-3 text-right text-xs text-paper-mute">
        {t.blockTime ? relativeTime(t.blockTime * 1000) : "—"}
      </td>
      <td className="py-2.5 text-right">
        <a
          href={`https://solscan.io/tx/${t.signature}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-paper-mute hover:text-accent"
          aria-label="View transaction on Solscan"
        >
          tx ↗
        </a>
      </td>
    </tr>
  );
}

export default async function MarketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ side?: string }>;
}) {
  const { id } = await params;
  const { side: sideParam } = await searchParams;
  const initialSide = sideParam === "no" ? "no" : "yes";
  const market = await loadMarket(id);
  if (!market) notFound();

  const tape = await safe(() => getMarketTrades(id, 50));
  const yes = num(market.yesPrice);
  const no = num(market.noPrice);
  const buyable = isBuyable(market);
  const image = market.images[0];

  const timeline = [
    { label: "Opens", t: market.startTime },
    { label: "Trading closes", t: market.endTime },
    { label: "Resolves", t: market.resolutionTime },
  ].filter((x): x is { label: string; t: number } => x.t !== null);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-8">
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-paper-mute">
            <span>{market.category}</span>
            <span aria-hidden="true">·</span>
            <PhaseBadge phase={market.resolved ? "resolved" : market.phase} />
            {market.marketType === "breaking" ? (
              <span className="rounded-full bg-live/15 px-2 py-0.5 text-[10px] font-semibold text-live">Breaking</span>
            ) : null}
          </div>
          <div className="flex gap-4">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover sm:h-20 sm:w-20" />
            ) : null}
            <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{marketTitle(market)}</h1>
          </div>
          {market.description ? <p className="max-w-3xl text-paper-dim">{market.description}</p> : null}
          <ShareButton
            path={`/m/${market.marketId}`}
            text={`${marketTitle(market)} YES ${cents(market.yesPrice)} / NO ${cents(market.noPrice)}. Make the call on Byline.`}
          />
        </header>

        <section aria-label="Current line" className="rounded-2xl border border-line bg-ink-2 p-5">
          {yes !== null && no !== null ? (
            <>
              <div className="flex items-end justify-between font-mono tabular">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-paper-mute">Yes</p>
                  <p className="text-4xl text-yes">{cents(yes)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider text-paper-mute">No</p>
                  <p className="text-4xl text-no">{cents(no)}</p>
                </div>
              </div>
              <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-ink-3" role="img" aria-label={`Market implies ${pct(yes)} yes`}>
                <div className="bg-yes" style={{ width: `${Math.max(0, Math.min(100, yes * 100))}%` }} />
                <div className="bg-no" style={{ width: `${Math.max(0, Math.min(100, no * 100))}%` }} />
              </div>
              <p className="mt-3 text-sm text-paper-dim">
                The market gives this a <span className="font-semibold text-paper">{pct(yes)}</span> chance.
              </p>
            </>
          ) : (
            <p className="text-sm text-paper-dim">
              {market.resolved ? "This market has resolved." : "Live prices are unavailable for this market right now."}
            </p>
          )}
        </section>

        <Suspense fallback={<MarketBriefSkeleton />}>
          <MarketBrief marketId={market.marketId} />
        </Suspense>

        <section>
          <SectionHeader kicker="Panta tape" title="Recent trades" />
          {!tape.ok ? (
            <Notice tone="error">Trade tape unavailable: {tape.error}</Notice>
          ) : tape.data.items.length === 0 ? (
            <p className="text-sm text-paper-mute">No trades yet. The first call on this market sets the record.</p>
          ) : (
            <div className="-mx-4 no-scrollbar overflow-x-auto px-4">
              <table className="w-full min-w-[340px] text-left">
                <thead>
                  <tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-paper-mute">
                    <th className="pb-2 font-normal">Side</th>
                    <th className="pb-2 font-normal">Shares</th>
                    <th className="pb-2 font-normal">Wallet</th>
                    <th className="hidden pb-2 font-normal sm:table-cell">Phase</th>
                    <th className="pb-2 text-right font-normal">When</th>
                    <th className="pb-2 text-right font-normal"><span className="sr-only">Transaction</span></th>
                  </tr>
                </thead>
                <tbody>
                  {tape.data.items.map((t) => (
                    <TapeRow key={t.signature} t={t} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-line bg-ink-2 p-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-paper-mute">Make the call</p>
          {buyable ? (
            <div className="mt-4">
              <BuyPanel marketId={market.marketId} yesPrice={market.yesPrice} noPrice={market.noPrice} initialSide={initialSide} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-paper-dim">
              {market.resolved
                ? "Resolved. Holders of the winning side can claim from their Book."
                : "This market has graduated from the primary curve, so new positions can't be opened through Byline."}
            </p>
          )}
        </div>

        <dl className="divide-y divide-line rounded-2xl border border-line bg-ink-2 text-sm">
          <div className="flex justify-between gap-3 p-4">
            <dt className="text-paper-mute">Volume</dt>
            <dd className="font-mono tabular">{usdc(market.totalVolumeUsdc ?? market.volumeUsdc)}</dd>
          </div>
          {timeline.map((x) => (
            <div key={x.label} className="flex justify-between gap-3 p-4">
              <dt className="text-paper-mute">{x.label}</dt>
              <dd className="text-right">
                <LocalTime iso={new Date(x.t * 1000).toISOString()} withDate />
              </dd>
            </div>
          ))}
          {market.oracle ? (
            <div className="flex justify-between gap-3 p-4">
              <dt className="text-paper-mute">Source</dt>
              <dd className="truncate text-right">{market.oracle}</dd>
            </div>
          ) : null}
          {market.creatorAddress ? (
            <div className="flex justify-between gap-3 p-4">
              <dt className="text-paper-mute">Creator</dt>
              <dd>
                <Link href={`/u/${market.creatorAddress}`} className="font-mono hover:text-accent">
                  {shortAddr(market.creatorAddress)}
                </Link>
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3 p-4">
            <dt className="text-paper-mute">Market</dt>
            <dd>
              <a href={`https://solscan.io/account/${market.marketId}`} target="_blank" rel="noreferrer" className="font-mono hover:text-accent">
                {shortAddr(market.marketId)} ↗
              </a>
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
