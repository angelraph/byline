import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDesk } from "@/lib/desks";
import { getFixtures, type Fixture } from "@/lib/sports/espn";
import { marketsForFixture } from "@/lib/sports/match";
import { getPricedCatalog, isBuyable } from "@/lib/panta/api";
import type { Market } from "@/lib/panta/schemas";
import { getLeaderboard, sortRows } from "@/lib/leaderboard";
import { safe } from "@/lib/data/safe";
import { cents, marketTitle, shortAddr, signedPct, usdc } from "@/lib/format";
import { FixtureCard } from "@/components/slate/fixture-card";
import { EmptyState, Notice, PhaseBadge, SectionHeader } from "@/components/ui";

export const revalidate = 60;
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const desk = getDesk(slug);
  return desk ? { title: `${desk.name} desk`, description: desk.blurb } : { title: "Desk" };
}

function forgeHref(f: Fixture): string | null {
  if (f.state === "post") return null;
  return `/forge?fixture=${encodeURIComponent(f.id)}&d=${f.startsAt.slice(0, 10).replace(/-/g, "")}`;
}

function MarketRow({ m }: { m: Market }) {
  return (
    <li>
      <Link href={`/m/${m.marketId}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-2 p-3 hover:border-line-strong">
        <div className="min-w-0">
          <p className="line-clamp-1 text-sm">{marketTitle(m)}</p>
          <div className="mt-1 flex items-center gap-2"><PhaseBadge phase={m.resolved ? "resolved" : m.phase} /></div>
        </div>
        <div className="shrink-0 text-right font-mono text-xs tabular">
          {isBuyable(m) ? <p><span className="text-yes">{cents(m.yesPrice)}</span> / <span className="text-no">{cents(m.noPrice)}</span></p> : null}
          <p className="text-paper-mute">{usdc(m.totalVolumeUsdc ?? m.volumeUsdc, { compact: true })}</p>
        </div>
      </Link>
    </li>
  );
}

async function DeskCallers({ category }: { category: string }) {
  const board = await safe(() => getLeaderboard());
  if (!board.ok) return <p className="text-sm text-paper-mute">Caller rankings are recalculating.</p>;
  const callers = sortRows(board.data.rows.filter((r) => r.categories.includes(category)), "edge").slice(0, 10);
  if (callers.length === 0) {
    return <p className="text-sm text-paper-mute">No qualifying bylines in this desk yet. Three resolved calls gets you on the board.</p>;
  }
  return (
    <ol className="space-y-1.5">
      {callers.map((r, i) => (
        <li key={r.wallet}>
          <Link href={`/u/${r.wallet}`} className="flex items-center justify-between gap-2 rounded-lg bg-ink-2 px-3 py-2 font-mono text-sm tabular hover:bg-ink-3">
            <span className="text-paper-mute">{i + 1}</span>
            <span className="flex-1 truncate">{shortAddr(r.wallet)}</span>
            <span className="text-paper-dim">{r.stats.wins}–{r.stats.losses}</span>
            <span className={(r.stats.edge ?? 0) >= 0 ? "text-yes" : "text-no"}>{signedPct(r.stats.edge)}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export default async function DeskPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const desk = getDesk(slug);
  if (!desk) notFound();

  const catalog = await safe(() => getPricedCatalog());
  const markets = catalog.ok ? catalog.data : [];

  let fixtures: { fixture: Fixture; markets: Market[] }[] = [];
  let feedError: string | null = null;
  let deskMarkets: Market[] = [];
  let boardCategory: string;

  if (desk.kind === "league") {
    boardCategory = "sports";
    const res = await safe(() => getFixtures(desk.league));
    if (res.ok) {
      fixtures = res.data
        .filter((f) => f.state !== "post" || Date.parse(f.startsAt) > Date.now() - 2 * 86_400_000)
        .map((f) => ({ fixture: f, markets: marketsForFixture(f, markets) }));
      const ids = new Set(fixtures.flatMap((x) => x.markets.map((m) => m.marketId)));
      deskMarkets = markets.filter((m) => ids.has(m.marketId));
    } else feedError = res.error;
  } else {
    boardCategory = desk.category;
    deskMarkets = markets.filter((m) => m.category === desk.category && (m.title || m.description));
  }

  const open = deskMarkets.filter((m) => isBuyable(m));
  const settled = deskMarkets.filter((m) => !isBuyable(m)).slice(0, 12);
  const live = fixtures.filter((x) => x.fixture.state === "in");
  const upcoming = fixtures.filter((x) => x.fixture.state === "pre");
  const finals = fixtures.filter((x) => x.fixture.state === "post");

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/desks" className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent hover:underline">← Fan Desks</Link>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">{desk.name} desk</h1>
          <p className="mt-2 max-w-2xl text-paper-dim">{desk.blurb}</p>
        </div>
        <Link href="/forge" className="self-start rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink sm:self-auto">
          Forge a market here
        </Link>
      </header>

      {feedError ? <Notice tone="error">Live games are delayed: {feedError}</Notice> : null}
      {!catalog.ok ? <Notice tone="error">Panta markets unavailable: {catalog.error}</Notice> : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-8">
          {desk.kind === "league" ? (
            <>
              {live.length + upcoming.length === 0 ? (
                <EmptyState title="No games on the board" body={`${desk.name} has nothing scheduled in this window.`} />
              ) : (
                <section>
                  <SectionHeader kicker={live.length ? "Live and upcoming" : "Upcoming"} title="On the board" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[...live, ...upcoming].map((x) => (
                      <FixtureCard key={x.fixture.id} fixture={x.fixture} markets={x.markets} forgeHref={forgeHref(x.fixture)} />
                    ))}
                  </div>
                </section>
              )}
              {finals.length > 0 ? (
                <section>
                  <SectionHeader kicker="Results" title="Finals" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {finals.map((x) => <FixtureCard key={x.fixture.id} fixture={x.fixture} markets={x.markets} forgeHref={null} />)}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <>
              <section>
                <SectionHeader kicker="Trade now" title={`Open markets (${open.length})`} />
                {open.length === 0 ? (
                  <EmptyState title="Nothing open in this desk" body="Open the first one and the room trades on your question." action={<Link href="/forge" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Forge a market</Link>} />
                ) : (
                  <ul className="space-y-2">{open.map((m) => <MarketRow key={m.marketId} m={m} />)}</ul>
                )}
              </section>
              {settled.length > 0 ? (
                <section>
                  <SectionHeader kicker="On the record" title="Recently settled" />
                  <ul className="space-y-2">{settled.map((m) => <MarketRow key={m.marketId} m={m} />)}</ul>
                </section>
              ) : null}
            </>
          )}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <SectionHeader kicker="Verified" title={desk.kind === "league" ? "Top sports callers" : `Top ${desk.name} callers`} />
          <Suspense fallback={<p className="text-sm text-paper-mute">Ranking callers…</p>}>
            <DeskCallers category={boardCategory} />
          </Suspense>
        </aside>
      </div>
    </div>
  );
}
