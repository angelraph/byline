import Link from "next/link";
import { getPricedCatalog, isBuyable, isListable } from "@/lib/panta/api";
import { getSlate } from "@/lib/sports/espn";
import { LEAGUES } from "@/lib/sports/leagues";
import type { Market } from "@/lib/panta/schemas";
import { safe } from "@/lib/data/safe";
import { marketTitle, num, usdc } from "@/lib/format";
import { MarketCard } from "@/components/market-card";
import { FeaturedCarousel } from "@/components/featured-carousel";
import { LocalTime } from "@/components/local-time";
import { Logo } from "@/components/brand";
import { Reveal } from "@/components/reveal";
import { FaqList, FAQ_ITEMS } from "@/components/faq";

export const revalidate = 60;

function Ticker({ markets }: { markets: Market[] }) {
  if (markets.length === 0) return null;
  const items = [...markets, ...markets];
  return (
    <div className="marquee relative overflow-hidden border-y border-line bg-ink-2/60 py-3" aria-label="Live markets">
      <div className="marquee-track flex w-max gap-8">
        {items.map((m, i) => {
          const yes = num(m.yesPrice);
          return (
            <Link key={`${m.marketId}-${i}`} href={`/m/${m.marketId}`} className="flex shrink-0 items-center gap-2 text-sm text-paper-dim hover:text-paper" tabIndex={i >= markets.length ? -1 : 0}>
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              <span className="max-w-[260px] truncate">{marketTitle(m)}</span>
              {yes !== null ? <span className="font-semibold text-yes tabular">{Math.round(yes * 100)}%</span> : null}
            </Link>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink to-transparent" />
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Make the call",
    body: "Pick a market from tonight's games, the news, or anything on Panta. Or forge your own in one signature.",
  },
  {
    n: "02",
    title: "Back it on-chain",
    body: "Buy YES or NO with USDC from your own wallet. Your wallet signs, Solana settles, nobody holds your funds.",
  },
  {
    n: "03",
    title: "Keep the receipt",
    body: "Every position lands on your public byline: record, hit rate, and edge over the odds you paid. Checkable by anyone.",
  },
] as const;

const TRUST = [
  {
    href: "/docs#security",
    title: "Non-custodial by design",
    body: "Your wallet signs every trade. BYLINE never holds your funds or keys.",
    icon: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z",
  },
  {
    href: "/docs#scoring",
    title: "Records you can verify",
    body: "Every byline is computed from on-chain Panta positions, never typed in.",
    icon: "M9 12l2 2 4-4M12 21a9 9 0 100-18 9 9 0 000 18z",
  },
  {
    href: "/legal#risk",
    title: "Play responsibly",
    body: "Clear quotes, slippage limits and risk notes before anything is signed.",
    icon: "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  },
] as const;

const FEATURES = [
  { href: "/slate", title: "Sports slate", body: "Real fixtures across 8 leagues with live scores and the markets on each game.", icon: "M12 3a9 9 0 100 18 9 9 0 000-18z" },
  { href: "/wire", title: "Markets", body: "Every Panta market in one terminal, with a live blotter of trades as they land.", icon: "M3 17l5-6 4 4 8-9" },
  { href: "/desks", title: "Fan desks", body: "Rooms for each league and topic, ranked by the callers who actually get it right.", icon: "M4 20v-8l8-6 8 6v8" },
  { href: "/leaderboard", title: "Leaderboard", body: "Verified records from the chain, ranked by edge, not by who shouts loudest.", icon: "M8 21h8M12 17v4M6 4h12v5a6 6 0 01-12 0z" },
  { href: "/forge", title: "Create a market", body: "Turn any game or headline into a live market. Earn creator fees as it trades.", icon: "M12 5v14M5 12h14" },
  { href: "/brief", title: "AI Brief", body: "Paste the news, get the read, the markets already pricing it, and a draft to forge.", icon: "M4 6h16M4 12h10M4 18h7" },
] as const;

export default async function HomePage() {
  const [catalog, slate] = await Promise.all([
    safe(() => getPricedCatalog()),
    safe(() => getSlate({ daysBack: 0, daysAhead: 7 })),
  ]);
  const markets = catalog.ok ? catalog.data.filter(isListable) : [];
  const open = markets.filter((m) => isBuyable(m));
  const priced = open.filter((m) => m.yesPrice !== null);
  const trending = [...open].sort((a, b) => (num(b.volumeUsdc) ?? 0) - (num(a.volumeUsdc) ?? 0)).slice(0, 6);
  const tickerMarkets = (priced.length >= 3 ? priced : markets.slice(0, 12)).slice(0, 14);
  const totalVolume = markets.reduce((s, m) => s + (num(m.totalVolumeUsdc ?? m.volumeUsdc) ?? 0), 0);
  const fixtures = slate.ok ? slate.data.fixtures : [];
  const live = fixtures.filter((f) => f.state === "in").length;
  // Spotlight only priced markets when any exist; fall back to the open board otherwise.
  const featured = (priced.length > 0 ? priced : open)
    .slice()
    .sort((a, b) => (num(b.volumeUsdc) ?? 0) - (num(a.volumeUsdc) ?? 0))
    .slice(0, 6);
  const upcoming = fixtures
    .filter((f) => f.state !== "post" && f.home && f.away)
    .sort((a, b) => Number(b.state === "in") - Number(a.state === "in") || a.startsAt.localeCompare(b.startsAt))
    .slice(0, 12);

  const stats = [
    { label: "Open markets", value: catalog.ok ? String(open.length) : "—" },
    { label: "Volume traded on Panta", value: catalog.ok ? usdc(totalVolume, { compact: true }) : "—" },
    { label: "Games this week", value: slate.ok ? String(fixtures.length) : "—" },
    { label: "Leagues covered", value: String(Object.keys(LEAGUES).length) },
  ];

  return (
    <div className="-mt-6 space-y-24">
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden px-4 pb-6 pt-14 sm:pt-20">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="grid-fade pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div className="animate-fade-up text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-ink-2/80 px-3 py-1 text-xs font-medium text-paper-dim">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-yes" aria-hidden="true" />
              Live on Solana · Powered by Panta
              {live > 0 ? <span className="text-live">· {live} games live</span> : null}
            </p>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              <span className="text-gradient">Your call.</span>
              <br />
              <span className="text-accent">On-chain.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-paper-dim lg:mx-0">
              Make a prediction, back it with a real position, and build a track record nobody can fake. Receipts, not screenshots.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link href="/wire" className="brand-gradient rounded-full px-7 py-3.5 text-center font-semibold text-white shadow-[0_10px_40px_-10px_var(--glow)] transition hover:brightness-110">
                Explore markets
              </Link>
              <Link href="/slate" className="rounded-full border border-line-strong bg-ink-2/60 px-7 py-3.5 text-center font-semibold text-paper transition hover:border-accent">
                Today&apos;s sports
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-paper-mute lg:justify-start">
              <li>✓ Non-custodial</li>
              <li>✓ Settled on Solana</li>
              <li>✓ Verified public records</li>
            </ul>
          </div>

          <div className="animate-fade-up relative mx-auto w-full max-w-md" style={{ animationDelay: "120ms" }}>
            <div className="absolute -inset-6 rounded-[2rem] bg-accent/10 blur-3xl" aria-hidden="true" />
            <div className="relative">
              {featured.length > 0 ? (
                <FeaturedCarousel markets={featured} />
              ) : (
                <div className="card flex flex-col items-center p-10 text-center">
                  <Logo variant="mark" className="h-16" />
                  <p className="mt-4 text-sm text-paper-dim">Live markets appear here as soon as Panta responds.</p>
                </div>
              )}
              <div className="card mt-3 flex items-center justify-between p-4">
                <div>
                  <p className="text-xs text-paper-mute">Your receipt</p>
                  <p className="mt-0.5 text-sm font-semibold">Signed · Timestamped · Settled</p>
                </div>
                <span className="rounded-full bg-yes-bg px-3 py-1 text-xs font-semibold text-yes">Verified</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="-mx-4 -mt-16">
        <Ticker markets={tickerMarkets} />
      </div>

      {/* Stats */}
      <Reveal>
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-ink-2 p-6 text-center">
              <dd className="font-display text-3xl font-bold tabular sm:text-4xl">{s.value}</dd>
              <dt className="mt-1 text-sm text-paper-mute">{s.label}</dt>
            </div>
          ))}
        </dl>
      </Reveal>

      {/* Trust */}
      <section className="mx-auto grid max-w-6xl gap-3 md:grid-cols-3">
        {TRUST.map((t, i) => (
          <Reveal key={t.title} delay={i * 70}>
            <Link href={t.href} className="card card-hover flex h-full items-start gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={t.icon} />
                </svg>
              </span>
              <span>
                <span className="block font-semibold">{t.title}</span>
                <span className="mt-0.5 block text-sm text-paper-dim">{t.body}</span>
              </span>
            </Link>
          </Reveal>
        ))}
      </section>

      {/* Upcoming games */}
      {upcoming.length > 0 ? (
        <section className="mx-auto max-w-6xl">
          <Reveal>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-accent">On the board</p>
                <h2 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Upcoming games</h2>
              </div>
              <Link href="/slate" className="shrink-0 text-sm font-semibold text-paper-dim hover:text-paper">Full slate →</Link>
            </div>
          </Reveal>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {upcoming.map((f) => (
              <Link
                key={f.id}
                href={`/desks/${f.league}`}
                className="card card-hover w-56 shrink-0 snap-start p-4"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider">
                  <span className="text-paper-mute">{f.leagueLabel}</span>
                  {f.state === "in" ? (
                    <span className="inline-flex items-center gap-1 text-live"><span className="live-dot h-1.5 w-1.5 rounded-full bg-live" aria-hidden="true" />Live</span>
                  ) : (
                    <span className="text-accent"><LocalTime iso={f.startsAt} /></span>
                  )}
                </div>
                {[f.away, f.home].map((p, n) =>
                  p ? (
                    <div key={n} className="mt-3 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        {p.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.logo} alt="" className="h-6 w-6 shrink-0 object-contain" loading="lazy" />
                        ) : (
                          <span className="h-6 w-6 shrink-0 rounded-full bg-ink-3" aria-hidden="true" />
                        )}
                        <span className="truncate text-sm font-medium">{p.short}</span>
                      </span>
                      {f.state === "in" && p.score !== null ? <span className="font-display font-bold tabular">{p.score}</span> : null}
                    </div>
                  ) : null,
                )}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Trending */}
      <section className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-accent">Trending now</p>
              <h2 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Markets moving today</h2>
            </div>
            <Link href="/wire" className="shrink-0 text-sm font-semibold text-paper-dim hover:text-paper">View all →</Link>
          </div>
        </Reveal>
        {trending.length === 0 ? (
          <div className="card p-10 text-center text-paper-dim">
            {catalog.ok ? (
              <>
                No markets are open right now.{" "}
                <Link href="/forge" className="font-semibold text-accent">Create the first one →</Link>
              </>
            ) : (
              "Panta is taking a moment to respond. Markets reappear automatically."
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trending.map((m, i) => (
              <Reveal key={m.marketId} delay={i * 60}>
                <MarketCard m={m} buyable={isBuyable(m)} />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-accent">How it works</p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Three steps to a record that counts</h2>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <div className="card h-full p-6">
                <span className="font-display text-sm font-bold text-accent">{s.n}</span>
                <h3 className="mt-3 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-paper-dim">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Why receipts */}
      <Reveal>
        <section className="mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-3xl border border-line bg-ink-2 p-8 sm:p-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-accent">Why BYLINE</p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">&ldquo;I called it&rdquo; is finally checkable</h2>
            <p className="mt-4 text-paper-dim">
              Every sports chat is full of people who say they saw it coming. On BYLINE a call only counts if it&apos;s a real position on Panta. Your
              byline shows wins, losses, and your <strong className="text-paper">edge</strong>: how much you beat the odds you actually paid.
            </p>
            <Link href="/leaderboard" className="mt-6 inline-block font-semibold text-accent hover:underline">See who actually calls it →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-ink p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-no">A screenshot</p>
              <ul className="mt-3 space-y-2 text-sm text-paper-dim">
                <li>✕ Posted after the result</li>
                <li>✕ Losses quietly deleted</li>
                <li>✕ No stake, no risk</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-accent/40 bg-accent-soft p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-yes">A BYLINE receipt</p>
              <ul className="mt-3 space-y-2 text-sm text-paper">
                <li>✓ Timestamped on Solana</li>
                <li>✓ Every call stays on record</li>
                <li>✓ Real money behind it</li>
              </ul>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Features */}
      <section className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-accent">Everything in one place</p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Built for fans, callers and creators</h2>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.href} delay={i * 50}>
              <Link href={f.href} className="card card-hover group block h-full p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={f.icon} />
                  </svg>
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-paper-dim">{f.body}</p>
                <span className="mt-4 inline-block text-sm font-semibold text-accent opacity-0 transition group-hover:opacity-100">Open →</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ teaser */}
      <section className="mx-auto max-w-3xl">
        <Reveal>
          <div className="text-center">
            <p className="text-sm font-semibold text-accent">FAQ</p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Questions, answered</h2>
          </div>
        </Reveal>
        <div className="mt-8">
          <FaqList items={FAQ_ITEMS.slice(0, 5)} />
        </div>
        <p className="mt-6 text-center text-sm">
          <Link href="/faq" className="font-semibold text-accent hover:underline">All questions →</Link>
          <span className="mx-3 text-paper-mute">·</span>
          <Link href="/docs" className="font-semibold text-accent hover:underline">Read the docs →</Link>
        </p>
      </section>

      {/* Final CTA */}
      <Reveal>
        <section className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-line p-10 text-center sm:p-16">
          <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative">
            <Logo variant="full" className="mx-auto block h-14 sm:h-20" />
            <p className="mx-auto mt-6 max-w-lg text-paper-dim">Connect a wallet, make your first call, and start a record that speaks for itself.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/slate" className="brand-gradient rounded-full px-7 py-3.5 font-semibold text-white transition hover:brightness-110">Make your first call</Link>
              <Link href="/forge" className="rounded-full border border-line-strong px-7 py-3.5 font-semibold transition hover:border-accent">Create a market</Link>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
