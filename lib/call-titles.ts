import "server-only";
import { getPricedCatalog, isBuyable } from "@/lib/panta/api";
import { withLinePrices } from "@/lib/panta/price";
import { marketTitle, num } from "@/lib/format";
import type { CallRecord } from "@/lib/stats";

/**
 * Calls built from the trade tape carry no market title, image or valuation. Fill them from
 * the catalog, and value open shares at the live side price when Panta hasn't valued them.
 */
export async function withCallTitles(calls: CallRecord[]): Promise<CallRecord[]> {
  const needs = calls.some((c) => !c.title || !c.image || (c.status === "open" && c.currentValue === null));
  if (!needs) return calls;
  const catalog = await getPricedCatalog().catch(() => []);
  const byId = new Map(catalog.map((m) => [m.marketId, m]));
  // Open markets the catalog couldn't price get the live $1-quote price (cached per market).
  const unpriced = [...new Set(calls.filter((c) => c.status === "open" && c.currentValue === null).map((c) => c.marketId))];
  await Promise.all(
    unpriced.map(async (id) => {
      const m = byId.get(id);
      if (m && (m.yesPrice === null || m.noPrice === null)) byId.set(id, await withLinePrices(m, isBuyable(m)));
    }),
  );
  return calls.map((c) => {
    const m = byId.get(c.marketId);
    if (!m) return c;
    const sidePrice = num(c.side === "yes" ? m.yesPrice : m.noPrice);
    const currentValue = c.status === "open" && c.currentValue === null && sidePrice !== null ? c.shares * sidePrice : c.currentValue;
    return {
      ...c,
      title: c.title || marketTitle(m),
      image: c.image ?? m.images[0] ?? null,
      category: c.category ?? m.category,
      currentValue,
    };
  });
}
