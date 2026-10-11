import "server-only";
import { getPricedCatalog } from "@/lib/panta/api";
import { marketTitle } from "@/lib/format";
import type { CallRecord } from "@/lib/stats";

/** Calls built from the trade tape carry no market title or image; fill them from the catalog. */
export async function withCallTitles(calls: CallRecord[]): Promise<CallRecord[]> {
  if (!calls.some((c) => !c.title || !c.image)) return calls;
  const catalog = await getPricedCatalog().catch(() => []);
  const byId = new Map(catalog.map((m) => [m.marketId, m]));
  return calls.map((c) => {
    const m = byId.get(c.marketId);
    if (!m) return c;
    return { ...c, title: c.title || marketTitle(m), image: c.image ?? m.images[0] ?? null, category: c.category ?? m.category };
  });
}
