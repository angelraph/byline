import type { Metadata } from "next";
import Link from "next/link";
import { getLeaderboard, MIN_RESOLVED, sortRows, type SortKey } from "@/lib/leaderboard";
import { safe } from "@/lib/data/safe";
import { pct, relativeTime, shortAddr, signedPct } from "@/lib/format";
import { EmptyState, Notice } from "@/components/ui";
import { DivisionBadge } from "@/components/division-badge";
import { divisionFor } from "@/lib/divisions";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Top verified bylines on Panta, ranked by edge over the odds they paid.",
};
export const revalidate = 600;
export const maxDuration = 60;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "edge", label: "Beat the odds" },
  { key: "hit", label: "Win rate" },
  { key: "roi", label: "Profit" },
  { key: "record", label: "Most wins" },
];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const sort: SortKey = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as SortKey) : "edge";
  const board = await safe(() => getLeaderboard());

  const allRows = board.ok ? board.data.rows : [];
  const categories = [...new Set(allRows.flatMap((r) => r.categories))].sort();
  const category = sp.category && categories.includes(sp.category) ? sp.category : null;
  const rows = sortRows(category ? allRows.filter((r) => r.categories.includes(category)) : allRows, sort);

  const href = (next: { sort?: SortKey; category?: string | null }) => {
    const p = new URLSearchParams();
    const s = next.sort ?? sort;
    const c = next.category === undefined ? category : next.category;
    if (s !== "edge") p.set("sort", s);
    if (c) p.set("category", c);
    const q = p.toString();
    return q ? `/leaderboard?${q}` : "/leaderboard";
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-accent">Leaderboard</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Who&apos;s actually right</h1>
        <p className="mt-2 max-w-2xl text-paper-dim">
          Ranked by how much they <strong className="text-paper">beat the odds</strong>. Anyone can win by backing favourites; winning more often
          than the odds said you would is the real skill. Only real bets count, after at least {MIN_RESOLVED} settled bets.
        </p>
      </header>

      {!board.ok ? <Notice tone="warn">Rankings are refreshing. Check back in a minute.</Notice> : null}

      <div className="flex flex-wrap items-center gap-2">
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={href({ sort: s.key })}
            className={`rounded-full border px-3 py-1.5 text-sm ${sort === s.key ? "border-paper bg-paper text-ink" : "border-line text-paper-dim hover:text-paper"}`}
          >
            {s.label}
          </Link>
        ))}
        {categories.length > 0 ? <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" /> : null}
        <div className="-mx-4 flex gap-2 no-scrollbar overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Link href={href({ category: null })} className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${!category ? "bg-ink-3 text-paper" : "text-paper-dim hover:text-paper"}`}>
            All
          </Link>
          {categories.map((c) => (
            <Link key={c} href={href({ category: c })} className={`shrink-0 rounded-full px-3 py-1.5 text-sm capitalize ${category === c ? "bg-ink-3 text-paper" : "text-paper-dim hover:text-paper"}`}>
              {c.replace(/-/g, " ")}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No records yet" body={`A bettor appears here after ${MIN_RESOLVED} settled bets. Rankings fill in as results come in.`} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-2 font-mono text-[10px] uppercase tracking-wider text-paper-mute">
              <tr>
                <th className="px-3 py-3 font-normal sm:px-4">#</th>
                <th className="px-2 py-3 font-normal">Bettor</th>
                <th className="px-2 py-3 text-right font-normal">Record</th>
                <th className="px-2 py-3 text-right font-normal">Beat the odds</th>
                <th className="hidden px-2 py-3 text-right font-normal sm:table-cell">Win rate</th>
                <th className="hidden px-2 py-3 text-right font-normal sm:table-cell">Profit</th>
                <th className="hidden px-4 py-3 text-right font-normal md:table-cell">Streak</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular">
              {rows.map((r, i) => (
                <tr key={r.wallet} className="border-t border-line hover:bg-ink-2">
                  <td className="px-3 py-3 text-paper-mute sm:px-4">{i + 1}</td>
                  <td className="px-2 py-3">
                    <span className="flex items-center gap-2">
                      <Link href={`/u/${r.wallet}`} className="hover:text-accent">{shortAddr(r.wallet)}</Link>
                      <DivisionBadge d={divisionFor(r.stats)} />
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right">{r.stats.wins}–{r.stats.losses}</td>
                  <td className={`px-2 py-3 text-right ${(r.stats.edge ?? 0) >= 0 ? "text-yes" : "text-no"}`}>{signedPct(r.stats.edge)}</td>
                  <td className="hidden px-2 py-3 text-right sm:table-cell">{pct(r.stats.hitRate)}</td>
                  <td className={`hidden px-2 py-3 text-right sm:table-cell ${(r.stats.roi ?? 0) >= 0 ? "text-yes" : "text-no"}`}>{signedPct(r.stats.roi)}</td>
                  <td className="hidden px-4 py-3 text-right md:table-cell">
                    {r.stats.streak ? `${r.stats.streak.kind === "won" ? "W" : "L"}${r.stats.streak.count}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {board.ok ? (
        <p className="text-xs text-paper-mute">
          Records from {board.data.scannedWallets} active bettors
          {board.data.lastConfirmed ? ` · last confirmed ${relativeTime(board.data.lastConfirmed)}` : ""} · more are checked every few minutes.
        </p>
      ) : null}
    </div>
  );
}
