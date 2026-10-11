import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { getMarketTrades, getPositions, listAllMarkets } from "@/lib/panta/api";
import { PantaError } from "@/lib/panta/client";
import { db, isDbConfigured } from "@/lib/db";
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

/** Positions requests per scan: Panta allows 60/min per account, shared with live traffic. */
const REFRESH_PER_RUN = 15;

const nullableNum = z.number().nullable();
const statsSchema = z.object({
  resolved: z.number(),
  wins: z.number(),
  losses: z.number(),
  hitRate: nullableNum,
  expectedHitRate: nullableNum,
  edge: nullableNum,
  costResolved: z.number(),
  payoutResolved: z.number(),
  roi: nullableNum,
  streak: z.object({ kind: z.enum(["won", "lost"]), count: z.number() }).nullable(),
  open: z.number(),
  openCost: z.number(),
  openValue: z.number(),
  openValueComplete: z.boolean().default(true),
  hedgedMarkets: z.number(),
  totalCalls: z.number(),
});
const storedRowSchema = z.object({
  wallet: z.string(),
  stats: statsSchema,
  categories: z.array(z.string()),
  trades: z.number(),
  updated_at: z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString())),
});

type Stored = LeaderRow & { updatedAt: string };

async function readStored(): Promise<Map<string, Stored>> {
  if (!isDbConfigured()) return new Map();
  const rows = await db()`select wallet, stats, categories, trades, updated_at from wallet_stats`.catch(() => []);
  const out = new Map<string, Stored>();
  for (const r of rows) {
    const p = storedRowSchema.safeParse(r);
    if (p.success) out.set(p.data.wallet, { wallet: p.data.wallet, stats: p.data.stats, categories: p.data.categories, trades: p.data.trades, updatedAt: p.data.updated_at });
  }
  return out;
}

async function saveStored(row: LeaderRow): Promise<void> {
  if (!isDbConfigured()) return;
  await db()`
    insert into wallet_stats (wallet, stats, categories, trades, updated_at)
    values (${row.wallet}, ${JSON.stringify(row.stats)}::jsonb, ${row.categories}, ${row.trades}, now())
    on conflict (wallet) do update set stats = excluded.stats, categories = excluded.categories, trades = excluded.trades, updated_at = now()`;
}

/**
 * Leaderboard scan. Discovers active wallets from trade tapes, refreshes a few of the
 * stalest wallets' records from Panta each run (one attempt each, stopping on a rate
 * limit), and serves every record confirmed so far from the database, so the board grows
 * over time and survives Panta outages.
 */
async function compute(): Promise<{ rows: LeaderRow[]; scannedMarkets: number; scannedWallets: number; delayed: number; computedAt: string; lastConfirmed: string | null }> {
  const markets = await listAllMarkets();
  const traded = markets
    .filter((m) => (num(m.volumeUsdc) ?? 0) > 0 || m.resolved)
    .sort((a, b) => (num(b.volumeUsdc) ?? 0) - (num(a.volumeUsdc) ?? 0))
    .slice(0, 50);
  const categoryOf = new Map(markets.map((m) => [m.marketId, m.category]));

  const tapeDeadline = Date.now() + 12_000;
  const tapes = await mapLimit(traded, 6, (m) => {
    if (Date.now() > tapeDeadline) return Promise.reject(new Error("Tape budget exhausted"));
    return getMarketTrades(m.marketId, 200);
  });
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

  const stored = await readStored();
  // Refresh wallets we've never scored first, then the stalest records.
  const candidates = [...activity.entries()]
    .sort((a, b) => {
      const sa = stored.get(a[0])?.updatedAt ?? "";
      const sb = stored.get(b[0])?.updatedAt ?? "";
      return sa.localeCompare(sb) || b[1].trades - a[1].trades;
    })
    .slice(0, REFRESH_PER_RUN);

  const deadline = Date.now() + 22_000;
  let rateLimited = false;
  const refreshed = await mapLimit(candidates, 2, async ([wallet, a]) => {
    if (rateLimited || Date.now() > deadline) throw new Error("Skipped this run");
    try {
      const p = await getPositions(wallet, { fresh: true, noRetry: true });
      const row: LeaderRow = { wallet, stats: computeStats(buildCalls(p.positions, [])), trades: a.trades, categories: [...a.categories] };
      await saveStored(row).catch(() => undefined);
      stored.set(wallet, { ...row, updatedAt: new Date().toISOString() });
      return row;
    } catch (err) {
      if (err instanceof PantaError && (err.status === 429 || err.code === "RATE_LIMITED")) rateLimited = true;
      throw err;
    }
  });

  const all = [...stored.values()];
  const rows = all.filter((r) => r.stats.resolved >= MIN_RESOLVED).map(({ updatedAt: _u, ...r }) => {
    void _u;
    return r;
  });
  const lastConfirmed = all.reduce<string | null>((m, r) => (m === null || r.updatedAt > m ? r.updatedAt : m), null);

  return {
    rows,
    scannedMarkets: traded.length,
    scannedWallets: stored.size,
    delayed: refreshed.filter((r) => r.status === "rejected").length,
    computedAt: new Date().toISOString(),
    lastConfirmed,
  };
}

export const getLeaderboard = unstable_cache(compute, ["leaderboard-v5"], { revalidate: 300 });

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
