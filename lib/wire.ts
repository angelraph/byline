import "server-only";
import { unstable_cache } from "next/cache";
import { getMarketTrades, getPricedCatalog, isListable, isOpen, listAllMarkets } from "@/lib/panta/api";
import type { Market, Trade } from "@/lib/panta/schemas";
import { mapLimit } from "@/lib/leaderboard";
import { num } from "@/lib/format";

export type BlotterRow = Trade & { title: string; category: string };

/** A buy at or above this many shares is flagged as size on the blotter. */
export const BIG_TRADE_SHARES = 50;

async function loadBlotter(): Promise<{ rows: BlotterRow[]; scanned: number }> {
  const markets = await listAllMarkets();
  // Open markets plus the most traded ones cover where activity happens.
  const targets = [
    ...markets.filter(isOpen),
    ...markets
      .filter((m) => !isOpen(m))
      .sort((a, b) => (num(b.volumeUsdc) ?? 0) - (num(a.volumeUsdc) ?? 0))
      .slice(0, 20),
  ];
  const byId = new Map(markets.map((m) => [m.marketId, m]));
  const tapes = await mapLimit(targets, 8, (m) => getMarketTrades(m.marketId, 30));
  const rows: BlotterRow[] = [];
  for (const t of tapes) {
    if (t.status !== "fulfilled") continue;
    for (const tr of t.value.items) {
      const m = byId.get(tr.marketId);
      rows.push({ ...tr, title: m?.title ?? "", category: m?.category ?? "other" });
    }
  }
  rows.sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));
  return { rows: rows.slice(0, 60), scanned: targets.length };
}

export const getBlotter = unstable_cache(loadBlotter, ["wire-blotter-v1"], { revalidate: 30 });

export async function getTerminal(): Promise<Market[]> {
  return (await getPricedCatalog()).filter(isListable);
}
