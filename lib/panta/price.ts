import "server-only";
import { unstable_cache } from "next/cache";
import { quoteOrder } from "./api";
import type { Market } from "./schemas";

/**
 * Neutral wallet used only to ask Panta for a price. A quote needs a wallet address but
 * moves no funds and signs nothing; this key has no owner-side use in Byline.
 */
const PRICE_PROBE_WALLET = "8xFANjEvuA1oe6GUT4n7ar7e38fQCpb969fNN2pfaGCA";

async function probe(marketId: string): Promise<{ yes: string | null; no: string | null }> {
  const [yes, no] = await Promise.allSettled([
    quoteOrder({ wallet: PRICE_PROBE_WALLET, marketId, side: "yes", amountUsdc: "1" }),
    quoteOrder({ wallet: PRICE_PROBE_WALLET, marketId, side: "no", amountUsdc: "1" }),
  ]);
  const result = {
    yes: yes.status === "fulfilled" ? yes.value.avgPrice : null,
    no: no.status === "fulfilled" ? no.value.avgPrice : null,
  };
  // Throwing keeps a failed probe out of the cache, so the next request tries again.
  if (result.yes === null && result.no === null) throw new Error("Price probe failed");
  return result;
}

const cachedProbe = (marketId: string) =>
  unstable_cache(() => probe(marketId), ["price-probe-v2", marketId], { revalidate: 20 })();

/**
 * Spot prices when Panta's detail route provides them; otherwise the executable price of a
 * $1 quote on each side (cached 20s). Only used for single-market views to respect quote limits.
 */
export async function withLinePrices(m: Market, buyable: boolean): Promise<Market> {
  if (!buyable || (m.yesPrice !== null && m.noPrice !== null)) return m;
  const p = await cachedProbe(m.marketId).catch(() => ({ yes: null, no: null }));
  return { ...m, yesPrice: m.yesPrice ?? p.yes, noPrice: m.noPrice ?? p.no };
}
