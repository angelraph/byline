import type { Metadata } from "next";
import Link from "next/link";
import { DESKS } from "@/lib/desks";
import { getSlate } from "@/lib/sports/espn";
import { isBuyable, listAllMarkets } from "@/lib/panta/api";
import { safe } from "@/lib/data/safe";
import { SectionHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Fan Desks",
  description: "Rooms for every league and topic: live games, the markets on them, and the callers who get it right.",
};
export const revalidate = 120;

export default async function DesksPage() {
  const [slate, catalog] = await Promise.all([safe(() => getSlate({ daysBack: 0, daysAhead: 3 })), safe(() => listAllMarkets())]);
  const fixtures = slate.ok ? slate.data.fixtures : [];
  const markets = catalog.ok ? catalog.data : [];

  const league = DESKS.filter((d) => d.kind === "league");
  const topics = DESKS.filter((d) => d.kind === "category");

  return (
    <div className="space-y-10">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Fan Desks</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">Pick your room</h1>
        <p className="mt-2 max-w-2xl text-paper-dim">Each desk gathers the games, the markets on them, and the callers with the best verified record in that world.</p>
      </header>

      <section>
        <SectionHeader kicker="Sports" title="League desks" />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {league.map((d) => {
            const games = d.kind === "league" ? fixtures.filter((f) => f.league === d.league) : [];
            const live = games.filter((g) => g.state === "in").length;
            return (
              <li key={d.slug}>
                <Link href={`/desks/${d.slug}`} className="flex h-full flex-col rounded-2xl border border-line bg-ink-2 p-4 transition hover:border-line-strong">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-xl font-semibold">{d.name}</span>
                    {live > 0 ? <span className="rounded-full bg-live/15 px-2 py-0.5 font-mono text-[10px] text-live">{live} LIVE</span> : null}
                  </div>
                  <p className="mt-1 flex-1 text-sm text-paper-dim">{d.blurb}</p>
                  <p className="mt-3 font-mono text-xs text-paper-mute">{games.length} games in the next 3 days</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <SectionHeader kicker="Beyond sport" title="Topic desks" />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {topics.map((d) => {
            const inCat = d.kind === "category" ? markets.filter((m) => m.category === d.category) : [];
            const open = inCat.filter((m) => isBuyable(m)).length;
            return (
              <li key={d.slug}>
                <Link href={`/desks/${d.slug}`} className="flex h-full flex-col rounded-2xl border border-line bg-ink-2 p-4 transition hover:border-line-strong">
                  <span className="font-serif text-xl font-semibold">{d.name}</span>
                  <p className="mt-1 flex-1 text-sm text-paper-dim">{d.blurb}</p>
                  <p className="mt-3 font-mono text-xs text-paper-mute">
                    {open} open · {inCat.length} total markets
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
