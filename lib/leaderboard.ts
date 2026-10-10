import "server-only";
import { unstable_cache } from "next/cache";
import { getMarketTrades, getPositions, listAllMarkets } from "@/lib/panta/api";
import { buildCalls, computeStats, type BylineStats } from "@/lib/stats";
import { num } from "@/lib/format";

export type LeaderRow = {
  wallet: string;
  stats: BylineStats;
  trades: number;
  categories: string[];
};

/** Run async work with bounded concurrency so we stay inside Panta's per-minute limits. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        out[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export const MIN_RESOLVED = 3;

async function compute(): Promise<{ rows: LeaderRow[]; scannedMarkets: number; scannedWallets: number; delayed: number; computedAt: string }> {
  const markets = await listAllMarkets();
  const traded = markets
    .filter((m) => (num(m.volumeUsdc) ?? 0) > 0 || m.resolved)
    .sort((a, b) => (num(b.volumeUsdc) ?? 0) - (num(a.volumeUsdc) ?? 0))
    .slice(0, 50);
  const categoryOf = new Map(markets.map((m) => [m.marketId, m.category]));

  const tapes = await mapLimit(traded, 8, (m) => getMarketTrades(m.marketId, 200));
  const activity = new Map<string, { trades: number; categories: Set<string> }>();
  for (const t of tapes) {
    if (t.status !== "fulfilled") continue;
    for (const row of t.value.items) {
      const a = activity.get(row.wallet) ?? { trades: 0, categories: new Set<string>() };
      a.trades++;
      const cat = categoryOf.get(row.marketId);
      if (cat) a.categories.add(cat);
      activity.set(row.wallet, a);
    }
  }

  // Hard budget for the positions phase so a slow Panta never stalls the scan; misses
  // are reported as delayed and retried on the next refresh.
  const deadline = Date.now() + 30_000;

  // Positions are the expensive call (60/min); score the most active wallets.
  const candidates = [...activity.entries()].sort((a, b) => b[1].trades - a[1].trades).slice(0, 30);
  const score = async ([wallet, a]: [string, { trades: number; categories: Set<string> }]): Promise<LeaderRow> => {
    if (Date.now() > deadline) throw new Error("Scan budget exhausted");
    const p = await getPositions(wallet, { fresh: true });
    const calls = buildCalls(p.positions, []);
    return { wallet, stats: computeStats(calls), trades: a.trades, categories: [...a.categories] };
  };
  const first = await mapLimit(candidates, 4, score);

  // /positions/ fails intermittently; give the misses a slower second pass.
  const misses = candidates.filter((_, i) => first[i].status === "rejected");
  const second = await mapLimit(misses, 2, async (c) => {
    await new Promise((r) => setTimeout(r, 500));
    return score(c);
  });

  const results = [...first, ...second];
  const rows = results
    .filter((r): r is PromiseFulfilledResult<LeaderRow> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((r) => r.stats.resolved >= MIN_RESOLVED);
  const delayed = second.filter((r) => r.status === "rejected").length;

  return {
    rows,
    scannedMarkets: traded.length,
    scannedWallets: candidates.length,
    delayed,
    computedAt: new Date().toISOString(),
  };
}

export const getLeaderboard = unstable_cache(compute, ["leaderboard-v4"], { revalidate: 600 });

export type SortKey = "edge" | "hit" | "roi" | "record";

export function sortRows(rows: LeaderRow[], key: SortKey): LeaderRow[] {
  const v = (r: LeaderRow): number => {
    switch (key) {
      case "hit":
        return r.stats.hitRate ?? -1;
      case "roi":
        return r.stats.roi ?? -Infinity;
      case "record":
        return r.stats.wins - r.stats.losses;
      default:
        return r.stats.edge ?? -Infinity;
    }
  };
  return [...rows].sort((a, b) => v(b) - v(a) || b.stats.resolved - a.stats.resolved);
}
