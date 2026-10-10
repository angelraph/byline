import Link from "next/link";
import { getSlate, type Fixture } from "@/lib/sports/espn";
import { LEAGUES, isLeagueKey, type LeagueKey } from "@/lib/sports/leagues";
import { marketsForFixture } from "@/lib/sports/match";
import { getPricedCatalog, isBuyable, isListable, isOpen } from "@/lib/panta/api";
import type { Market } from "@/lib/panta/schemas";
import { safe } from "@/lib/data/safe";
import { FixtureCard } from "@/components/slate/fixture-card";
import { EmptyState, Notice, SectionHeader } from "@/components/ui";
import { cents, marketTitle, usdc } from "@/lib/format";

export const revalidate = 60;

function forgeHref(f: Fixture): string | null {
  if (f.state === "post") return null;
  const d = f.startsAt.slice(0, 10).replace(/-/g, "");
  return `/forge?fixture=${encodeURIComponent(f.id)}&d=${d}`;
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export default async function SlatePage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string }>;
}) {
  const { league: leagueParam } = await searchParams;
  const league: LeagueKey | null = leagueParam && isLeagueKey(leagueParam) ? leagueParam : null;

  const [slate, catalog] = await Promise.all([
    safe(() => getSlate({ daysBack: 1, daysAhead: 7 })),
    safe(() => getPricedCatalog()),
  ]);

  const markets: Market[] = catalog.ok ? catalog.data : [];
  const allFixtures = slate.ok ? slate.data.fixtures : [];
  const fixtures = league ? allFixtures.filter((f) => f.league === league) : allFixtures;

  const matched = new Set<string>();
  const withMarkets = fixtures.map((f) => {
    const ms = marketsForFixture(f, markets);
    ms.forEach((m) => matched.add(m.marketId));
    return { fixture: f, markets: ms };
  });

  const live = withMarkets.filter((x) => x.fixture.state === "in");
  const upcoming = withMarkets.filter((x) => x.fixture.state === "pre");
  const finals = withMarkets.filter((x) => x.fixture.state === "post").reverse();

  // Upcoming fixtures that already have a market come first; then by kickoff.
  const upcomingByDay = new Map<string, typeof upcoming>();
  for (const x of upcoming) {
    const k = dayKey(x.fixture.startsAt);
    upcomingByDay.set(k, [...(upcomingByDay.get(k) ?? []), x]);
  }

  const openUnmatched = markets
    .filter((m) => isOpen(m) && isListable(m) && !matched.has(m.marketId))
    .sort((a, b) => Number(isBuyable(b)) - Number(isBuyable(a)));
  const feedDown = !slate.ok || (slate.ok && allFixtures.length === 0 && slate.data.failed.length > 0);
  const withMarketCount = withMarkets.filter((x) => x.markets.length > 0).length;

  return (
    <div className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
        <div>
          <p className="text-sm font-semibold text-accent">Sports slate</p>
          <h1 className="mt-2 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Tonight&apos;s games, priced live
          </h1>
          <p className="mt-3 max-w-2xl text-paper-dim">
            Real fixtures across 8 leagues with the Panta markets on each one. No market yet? Forge it in one signature.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 font-mono tabular">
          <div className="rounded-xl border border-line bg-ink-2 p-3">
            <dt className="text-[10px] uppercase tracking-wider text-paper-mute">Fixtures</dt>
            <dd className="mt-1 text-xl">{fixtures.length}</dd>
          </div>
          <div className="rounded-xl border border-line bg-ink-2 p-3">
            <dt className="text-[10px] uppercase tracking-wider text-paper-mute">With market</dt>
            <dd className="mt-1 text-xl">{withMarketCount}</dd>
          </div>
          <div className="rounded-xl border border-line bg-ink-2 p-3">
            <dt className="text-[10px] uppercase tracking-wider text-paper-mute">Live</dt>
            <dd className="mt-1 text-xl text-live">{live.length}</dd>
          </div>
        </dl>
      </section>

      {!catalog.ok ? <Notice tone="error">Panta markets unavailable: {catalog.error}</Notice> : null}
      {feedDown ? (
        <Notice tone="error">
          The live sports feed is temporarily unavailable. Fixtures will reappear automatically; Panta markets below are live.
        </Notice>
      ) : slate.ok && slate.data.failed.length > 0 ? (
        <Notice tone="warn">
          Delayed: {slate.data.failed.map((k) => LEAGUES[k].label).join(", ")}. Showing the leagues that responded.
        </Notice>
      ) : null}

      <nav aria-label="Leagues" className="-mx-4 flex gap-2 no-scrollbar overflow-x-auto px-4 pb-1">
        <Link
          href="/slate"
          className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${!league ? "border-paper bg-paper text-ink" : "border-line text-paper-dim hover:text-paper"}`}
        >
          All
        </Link>
        {(Object.keys(LEAGUES) as LeagueKey[]).map((k) => (
          <Link
            key={k}
            href={`/slate?league=${k}`}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${league === k ? "border-paper bg-paper text-ink" : "border-line text-paper-dim hover:text-paper"}`}
          >
            {LEAGUES[k].short}
          </Link>
        ))}
      </nav>

      {live.length > 0 ? (
        <section>
          <SectionHeader kicker="In play" title="Live now" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {live.map((x) => (
              <FixtureCard key={x.fixture.id} fixture={x.fixture} markets={x.markets} forgeHref={forgeHref(x.fixture)} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          {!feedDown && upcomingByDay.size === 0 && live.length === 0 ? (
            <EmptyState
              title="No fixtures in this window"
              body={league ? `${LEAGUES[league].label} has nothing scheduled in the next 7 days.` : "No scheduled games in the next 7 days."}
              action={
                <Link href="/forge" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
                  Forge a market
                </Link>
              }
            />
          ) : null}
          {[...upcomingByDay.entries()].map(([day, items]) => (
            <section key={day}>
              <SectionHeader
                kicker="Upcoming"
                title={new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {[...items]
                  .sort((a, b) => Number(b.markets.length > 0) - Number(a.markets.length > 0))
                  .map((x) => (
                    <FixtureCard key={x.fixture.id} fixture={x.fixture} markets={x.markets} forgeHref={forgeHref(x.fixture)} />
                  ))}
              </div>
            </section>
          ))}
          {finals.length > 0 ? (
            <section>
              <SectionHeader kicker="Settled on the pitch" title="Finals" />
              <div className="grid gap-4 sm:grid-cols-2">
                {finals.slice(0, 12).map((x) => (
                  <FixtureCard key={x.fixture.id} fixture={x.fixture} markets={x.markets} forgeHref={null} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <SectionHeader
            kicker="Panta"
            title="Open markets"
            action={<Link href="/wire" className="text-sm text-accent hover:underline">Wire →</Link>}
          />
          {openUnmatched.length === 0 ? (
            <p className="text-sm text-paper-mute">Every open market is on the slate.</p>
          ) : (
            <ul className="space-y-2">
              {openUnmatched.slice(0, 10).map((m) => (
                <li key={m.marketId}>
                  <Link href={`/m/${m.marketId}`} className="block rounded-xl border border-line bg-ink-2 p-3 transition hover:border-line-strong">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-paper-mute">{m.category}</p>
                    <p className="mt-1 line-clamp-2 text-sm">{marketTitle(m)}</p>
                    <p className="mt-2 flex gap-2 font-mono text-xs tabular">
                      <span className="text-yes">YES {cents(m.yesPrice)}</span>
                      <span className="text-no">NO {cents(m.noPrice)}</span>
                      <span className="ml-auto text-paper-mute">{usdc(m.volumeUsdc, { compact: true })}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
