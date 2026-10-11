import Link from "next/link";
import { getLeaderboard, sortRows, type LeaderRow } from "@/lib/leaderboard";
import { divisionFor } from "@/lib/divisions";
import { DivisionBadge } from "@/components/division-badge";
import { Logo } from "@/components/brand";
import { pct, shortAddr, signedPct } from "@/lib/format";
import { CallCard } from "@/components/social/call-card";
import { isDbConfigured } from "@/lib/db";
import { listCalls } from "@/lib/social";

/** Leaderboard rows if the cached scan answers quickly; the homepage never waits on a cold scan. */
async function topCallers(limit: number): Promise<LeaderRow[]> {
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 3500));
  const board = await Promise.race([getLeaderboard().catch(() => null), timeout]);
  return board ? sortRows(board.rows, "edge").slice(0, limit) : [];
}

/** Hero card: the current #1 verified caller's record. */
export async function TopCallerCard() {
  const [top] = await topCallers(1);
  if (!top) {
    // Rankings not ready: show the latest real bet on the record instead.
    const latest = isDbConfigured() ? (await listCalls({ limit: 10 }).catch(() => [])).find((c) => c.kind === "verified") : undefined;
    if (latest) {
      return (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Latest real bet on the record</p>
          <CallCard call={latest} />
        </div>
      );
    }
    return (
      <div className="card flex flex-col items-center p-10 text-center">
        <Logo variant="mark" className="h-16" />
        <p className="mt-4 text-sm text-paper-dim">The leaderboard is updating. Records appear here as soon as it&apos;s ready.</p>
      </div>
    );
  }
  const d = divisionFor(top.stats);
  return (
    <Link href={`/u/${top.wallet}`} className="card card-hover block p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">#1 caller right now</span>
        <DivisionBadge d={d} size="md" />
      </div>
      <p className="mt-4 font-mono text-lg font-semibold">{shortAddr(top.wallet, 6)}</p>
      <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-ink p-3">
          <dt className="text-[11px] text-paper-mute">Record</dt>
          <dd className="mt-1 font-display text-2xl font-bold tabular">
            {top.stats.wins}–{top.stats.losses}
          </dd>
        </div>
        <div className="rounded-xl bg-ink p-3">
          <dt className="text-[11px] text-paper-mute">Win rate</dt>
          <dd className="mt-1 font-display text-2xl font-bold tabular">{pct(top.stats.hitRate)}</dd>
        </div>
        <div className="rounded-xl bg-ink p-3">
          <dt className="text-[11px] text-paper-mute">Beat the odds</dt>
          <dd className={`mt-1 font-display text-2xl font-bold tabular ${(top.stats.edge ?? 0) >= 0 ? "text-yes" : "text-no"}`}>
            {signedPct(top.stats.edge, 0)}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-paper-mute">
        Every one of these bets is real money on Panta, checked on Solana. Not a screenshot.
      </p>
    </Link>
  );
}

export function TopCallerCardSkeleton() {
  return <div className="card h-64 animate-pulse" aria-busy="true" aria-label="Loading top caller" />;
}

/** "Who's actually right": the top verified callers. */
export async function TopCallersStrip() {
  const rows = await topCallers(6);
  if (rows.length === 0) {
    return <p className="card p-6 text-center text-sm text-paper-dim">Rankings are updating. Check the full leaderboard in a moment.</p>;
  }
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r, i) => (
        <li key={r.wallet}>
          <Link href={`/u/${r.wallet}`} className="card card-hover flex items-center gap-4 p-4">
            <span className="font-display text-2xl font-bold text-paper-mute tabular">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-sm font-semibold">{shortAddr(r.wallet)}</span>
                <DivisionBadge d={divisionFor(r.stats)} />
              </div>
              <p className="mt-1 text-xs text-paper-mute">
                {r.stats.wins}–{r.stats.losses} · {pct(r.stats.hitRate)} win rate
              </p>
            </div>
            <span className={`font-display text-lg font-bold tabular ${(r.stats.edge ?? 0) >= 0 ? "text-yes" : "text-no"}`}>
              {signedPct(r.stats.edge, 0)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function TopCallersSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading top callers">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="card h-[76px] animate-pulse" />
      ))}
    </div>
  );
}
