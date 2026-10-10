import Link from "next/link";
import type { Fixture, Participant } from "@/lib/sports/espn";
import type { Market } from "@/lib/panta/schemas";
import { cents, marketTitle, usdc } from "@/lib/format";
import { LiveBadge, PhaseBadge } from "@/components/ui";
import { LocalTime } from "@/components/local-time";

function Side({ p, showScore }: { p: Participant | null; showScore: boolean }) {
  if (!p) return <div className="text-paper-mute">TBD</div>;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {p.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logo} alt="" className="h-6 w-6 shrink-0 object-contain" loading="lazy" />
        ) : (
          <span className="h-6 w-6 shrink-0 rounded-full bg-ink-3" aria-hidden="true" />
        )}
        <span className={`truncate ${p.winner ? "font-semibold text-paper" : "text-paper-dim"}`}>{p.name}</span>
      </div>
      {showScore && p.score !== null ? (
        <span className={`font-mono tabular text-lg ${p.winner ? "text-paper" : "text-paper-dim"}`}>{p.score}</span>
      ) : null}
    </div>
  );
}

function MarketLine({ m }: { m: Market }) {
  const open = m.phase === "primary" || m.phase === "secondary";
  return (
    <Link
      href={`/m/${m.marketId}`}
      className="group block rounded-xl border border-line bg-ink px-3 py-2.5 transition hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 text-sm leading-snug text-paper group-hover:underline">{marketTitle(m)}</p>
        <PhaseBadge phase={m.phase} />
      </div>
      <div className="mt-2 flex items-center gap-2 font-mono text-xs tabular">
        {open ? (
          <>
            <span className="rounded-md bg-yes-bg px-2 py-1 text-yes">YES {cents(m.yesPrice)}</span>
            <span className="rounded-md bg-no-bg px-2 py-1 text-no">NO {cents(m.noPrice)}</span>
          </>
        ) : null}
        <span className="ml-auto text-paper-mute">{usdc(m.volumeUsdc ?? m.totalVolumeUsdc, { compact: true })} vol</span>
      </div>
    </Link>
  );
}

export function FixtureCard({ fixture, markets, forgeHref }: { fixture: Fixture; markets: Market[]; forgeHref: string | null }) {
  const showScore = fixture.state !== "pre";
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-ink-2 p-4">
      <header className="mb-3 flex items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-wider text-paper-mute">
        <span>{fixture.leagueLabel}</span>
        {fixture.state === "in" ? (
          <span className="flex items-center gap-2">
            <span className="normal-case tracking-normal text-paper-dim">{fixture.statusDetail}</span>
            <LiveBadge />
          </span>
        ) : fixture.state === "post" ? (
          <span>{fixture.statusDetail || "Final"}</span>
        ) : (
          <LocalTime iso={fixture.startsAt} />
        )}
      </header>
      <div className="space-y-2">
        <Side p={fixture.away} showScore={showScore} />
        <Side p={fixture.home} showScore={showScore} />
      </div>
      {fixture.venue ? <p className="mt-2 truncate text-xs text-paper-mute">{fixture.venue}</p> : null}
      <div className="mt-4 space-y-2 border-t border-line pt-3">
        {markets.length > 0 ? (
          markets.map((m) => <MarketLine key={m.marketId} m={m} />)
        ) : forgeHref ? (
          <Link
            href={forgeHref}
            className="flex items-center justify-between rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-sm text-paper-dim transition hover:border-accent hover:text-paper"
          >
            <span>No market yet</span>
            <span className="font-semibold text-accent">Forge this market →</span>
          </Link>
        ) : (
          <p className="px-1 text-sm text-paper-mute">No market was opened for this one.</p>
        )}
      </div>
    </article>
  );
}
