import Link from "next/link";
import { Suspense } from "react";
import { getPricedCatalog, isBuyable, isListable } from "@/lib/panta/api";
import { getSlate, type Fixture } from "@/lib/sports/espn";
import { safe } from "@/lib/data/safe";
import { marketTitle, num } from "@/lib/format";
import { MarketCard } from "@/components/market-card";
import { LocalTime } from "@/components/local-time";
import { Logo } from "@/components/brand";
import { Reveal } from "@/components/reveal";
import { FaqList, FAQ_ITEMS } from "@/components/faq";
import { CallCard } from "@/components/social/call-card";
import { TopCallerCard, TopCallerCardSkeleton, TopCallersSkeleton, TopCallersStrip } from "@/components/home/callers";
import { isDbConfigured } from "@/lib/db";
import { listCalls } from "@/lib/social";

export const revalidate = 30;

function GameTile({ f }: { f: Fixture }) {
  const live = f.state === "in";
  return (
    <Link href={`/desks/${f.league}`} className="card card-hover w-56 shrink-0 snap-start p-4">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider">
        <span className="text-paper-mute">{f.leagueLabel}</span>
        {live ? (
          <span className="truncate normal-case tracking-normal text-live">{f.statusDetail || "Live"}</span>
        ) : (
          <span className="text-accent"><LocalTime iso={f.startsAt} /></span>
        )}
      </div>
      {[f.home, f.away].map((p, n) =>
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
            {live && p.score !== null ? <span className="font-display font-bold tabular">{p.score}</span> : null}
          </div>
        ) : null,
      )}
    </Link>
  );
}

function SectionTitle({ kicker, title, href, linkLabel }: { kicker: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-accent">{kicker}</p>
        <h2 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      </div>
      {href && linkLabel ? (
        <Link href={href} className="shrink-0 text-sm font-semibold text-paper-dim hover:text-paper">
          {linkLabel} →
        </Link>
      ) : null}
    </div>
  );
}

const STEPS = [
  { n: "01", title: "Pick a side", body: "Choose a game or a headline and say YES or NO. Every market explains exactly what you're betting on." },
  { n: "02", title: "Back it", body: "Put $1 or more on it from your own wallet, or make a free pick. You see what you'd win before you sign." },
  { n: "03", title: "Build your record", body: "Every real bet lands on your public record: wins, losses, and how often you beat the odds. Anyone can check it." },
] as const;

const TRUST = [
  {
    href: "/docs#security",
    title: "You keep your money",
    body: "Every bet is signed in your own wallet. BYLINE never holds your funds.",
    icon: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z",
  },
  {
    href: "/docs#scoring",
    title: "Records can't be faked",
    body: "Wins and losses come from real bets on Solana, not from anything typed in.",
    icon: "M9 12l2 2 4-4M12 21a9 9 0 100-18 9 9 0 000 18z",
  },
  {
    href: "/legal#risk",
    title: "No surprises",
    body: "See what you'd win or lose before you sign. Start free, bet only what you're fine losing.",
    icon: "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  },
] as const;

const FEATURES = [
  { href: "/leaderboard", title: "Leaderboard", body: "Who actually calls it right, ranked by skill: wins, beating the odds, divisions.", icon: "M8 21h8M12 17v4M6 4h12v5a6 6 0 01-12 0z" },
  { href: "/desks", title: "Fan desks", body: "A room for every league and topic, with live chat and its own top callers.", icon: "M4 20v-8l8-6 8 6v8" },
  { href: "/slate", title: "Sports", body: "Real games across 8 leagues with live scores, and a market on any game.", icon: "M12 3a9 9 0 100 18 9 9 0 000-18z" },
  { href: "/forge", title: "Create a market", body: "Turn a game or a headline into a market for your audience, and earn fees.", icon: "M12 5v14M5 12h14" },
  { href: "/brief", title: "AI Brief", body: "Paste the news and get the plain-English read plus the markets pricing it.", icon: "M4 6h16M4 12h10M4 18h7" },
  { href: "/wire", title: "All markets", body: "Every open market in one place, with the latest bets as they land.", icon: "M3 17l5-6 4 4 8-9" },
] as const;

export default async function HomePage() {
  const [catalog, slate, latestCalls] = await Promise.all([
    safe(() => getPricedCatalog()),
    safe(() => getSlate({ daysBack: 0, daysAhead: 7 })),
    isDbConfigured() ? listCalls({ limit: 6 }).catch(() => []) : Promise.resolve([]),
  ]);
  const markets = catalog.ok ? catalog.data.filter(isListable) : [];
  const open = markets.filter((m) => isBuyable(m));
  const trending = [...open].sort((a, b) => (num(b.volumeUsdc) ?? 0) - (num(a.volumeUsdc) ?? 0)).slice(0, 3);
  const titleById = new Map(markets.map((m) => [m.marketId, marketTitle(m)]));
  const fixtures = slate.ok ? slate.data.fixtures : [];
  const liveGames = fixtures.filter((f) => f.state === "in" && f.home && f.away).slice(0, 12);
  const upcoming = fixtures
    .filter((f) => f.state === "pre" && f.home && f.away)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 12);

  return (
    <div className="-mt-6 space-y-24">
      {/* Hero: the problem and the proof */}
      <section className="relative -mx-4 overflow-hidden px-4 pb-6 pt-14 sm:pt-20">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="grid-fade pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div className="animate-fade-up text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-ink-2/80 px-3 py-1 text-xs font-medium text-paper-dim">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-yes" aria-hidden="true" />
              Panta runs the markets. BYLINE proves who&apos;s right.
            </p>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              <span className="text-gradient">Everyone says they called it.</span>
              <br />
              <span className="text-accent">Prove it.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-paper-dim lg:mx-0">
              Make your picks on games and headlines, back them with a real bet, and build a public track record nobody can fake.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link href="/slate" className="brand-gradient rounded-full px-7 py-3.5 text-center font-semibold text-white shadow-[0_10px_40px_-10px_var(--glow)] transition hover:brightness-110">
                Make a pick
              </Link>
              <Link href="/leaderboard" className="rounded-full border border-line-strong bg-ink-2/60 px-7 py-3.5 text-center font-semibold text-paper transition hover:border-accent">
                See who&apos;s right
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-paper-mute lg:justify-start">
              <li>✓ Free picks to start</li>
              <li>✓ Real bets from $1</li>
              <li>✓ Records anyone can check</li>
            </ul>
          </div>
          <div className="animate-fade-up relative mx-auto w-full max-w-md" style={{ animationDelay: "120ms" }}>
            <div className="absolute -inset-6 rounded-[2rem] bg-accent/10 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <Suspense fallback={<TopCallerCardSkeleton />}>
                <TopCallerCard />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      {/* Who's actually right */}
      <section className="mx-auto max-w-6xl">
        <Reveal>
          <SectionTitle kicker="Verified on Solana" title="Who's actually right" href="/leaderboard" linkLabel="Full leaderboard" />
        </Reveal>
        <Suspense fallback={<TopCallersSkeleton />}>
          <TopCallersStrip />
        </Suspense>
        <p className="mt-3 text-xs text-paper-mute">
          Ranked by how much they beat the odds they paid, so backing favourites doesn&apos;t inflate a record.
        </p>
      </section>

      {/* Fans' latest picks */}
      <section className="mx-auto max-w-6xl">
        <Reveal>
          <SectionTitle kicker="Picks with reasons" title="What fans are calling" href="/wire" linkLabel="Find a market" />
        </Reveal>
        {latestCalls.length === 0 ? (
          <div className="card p-8 text-center text-sm text-paper-dim">
            No picks yet. Be the first on the record:{" "}
            <Link href="/slate" className="font-semibold text-accent">make a pick →</Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {latestCalls.map((c, i) => (
              <Reveal key={c.id} delay={i * 50}>
                <CallCard call={c} marketTitle={titleById.get(c.market_id)} />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* Today's games */}
      {liveGames.length + upcoming.length > 0 ? (
        <section className="mx-auto max-w-6xl space-y-6">
          <Reveal>
            <SectionTitle kicker="Real fixtures" title={liveGames.length > 0 ? "Live now & coming up" : "Coming up"} href="/slate" linkLabel="All games" />
          </Reveal>
          {liveGames.length > 0 ? (
            <div>
              <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-live">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" aria-hidden="true" /> Live now
              </p>
              <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
                {liveGames.map((f) => <GameTile key={f.id} f={f} />)}
              </div>
            </div>
          ) : null}
          {upcoming.length > 0 ? (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-paper-mute">Upcoming</p>
              <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
                {upcoming.map((f) => <GameTile key={f.id} f={f} />)}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

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

      {/* Why a record beats a screenshot */}
      <Reveal>
        <section className="mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-3xl border border-line bg-ink-2 p-8 sm:p-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-accent">Why BYLINE</p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">A record beats a screenshot</h2>
            <p className="mt-4 text-paper-dim">
              Every group chat has someone who &ldquo;saw it coming&rdquo;. On BYLINE a pick only counts if there&apos;s a real bet behind it, placed before the result.
              Your record shows every win and every loss, and how often you beat the odds.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-ink p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-no">A screenshot</p>
              <ul className="mt-3 space-y-2 text-sm text-paper-dim">
                <li>✕ Posted after the result</li>
                <li>✕ Losses quietly deleted</li>
                <li>✕ Nothing at stake</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-accent/40 bg-accent-soft p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-yes">A BYLINE record</p>
              <ul className="mt-3 space-y-2 text-sm text-paper">
                <li>✓ Time-stamped on Solana</li>
                <li>✓ Every pick stays on record</li>
                <li>✓ Real money behind it</li>
              </ul>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Markets to call now */}
      {trending.length > 0 ? (
        <section className="mx-auto max-w-6xl">
          <Reveal>
            <SectionTitle kicker="Open now" title="Markets to call" href="/wire" linkLabel="All markets" />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trending.map((m, i) => (
              <Reveal key={m.marketId} delay={i * 60}>
                <MarketCard m={m} buyable={isBuyable(m)} />
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

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

      {/* Everything else */}
      <section className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-accent">For fans, punters and creators</p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Everything around your record</h2>
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
        </p>
      </section>

      {/* Final CTA */}
      <Reveal>
        <section className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-line p-10 text-center sm:p-16">
          <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="relative">
            <Logo variant="full" className="mx-auto block h-14 sm:h-20" />
            <p className="mx-auto mt-6 max-w-lg text-paper-dim">Your picks, your record, your proof. Start free and put money on it when you&apos;re sure.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/slate" className="brand-gradient rounded-full px-7 py-3.5 font-semibold text-white transition hover:brightness-110">Make your first pick</Link>
              <Link href="/forge" className="rounded-full border border-line-strong px-7 py-3.5 font-semibold transition hover:border-accent">Create a market</Link>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
