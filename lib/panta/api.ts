import "server-only";
import { unstable_cache } from "next/cache";
import { PantaError, pantaRequest } from "./client";
import {
  accountSchema,
  categoriesSchema,
  claimBuildSchema,
  createBuildSchema,
  createQuoteSchema,
  creatorFeesBuildSchema,
  imageUploadSchema,
  marketListSchema,
  marketSchema,
  marketTradesSchema,
  orderBuildSchema,
  orderQuoteSchema,
  orderSubmitSchema,
  orderVerifySchema,
  positionsSchema,
  registerSchema,
  tradeReportSchema,
  tradeStatusSchema,
  walletTradesSchema,
  type Market,
  type Phase,
  type Side,
} from "./schemas";

/* ---------- Catalog (cached reads) ---------- */

export function getAccount() {
  return pantaRequest("/account/", accountSchema, { revalidate: 300 });
}

export function listMarkets(params: {
  category?: string;
  status?: Phase;
  cursor?: string;
  limit?: number;
  createdBy?: "me";
}) {
  return pantaRequest("/markets/", marketListSchema, {
    query: { ...params, limit: params.limit ?? 50 },
    revalidate: 30,
  });
}

/** Walk every page of the catalog. The live catalog is small (under ~1000 rows), capped for safety. */
export async function listAllMarkets(params: { category?: string; status?: Phase } = {}) {
  const all: Market[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const res = await listMarkets({ ...params, cursor, limit: 50 });
    all.push(...res.items);
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }
  return all;
}

/** True when the detail route answered without its RPC-backed fields (observed intermittently). */
function isStripped(m: Market): boolean {
  return m.title.trim() === "" && m.yesPrice === null && m.noPrice === null;
}

/** Last complete detail row per market, kept for the life of this server instance. */
const lastGood = new Map<string, { market: Market; at: number }>();
const LAST_GOOD_MAX = 2000;

function remember(m: Market) {
  if (lastGood.size >= LAST_GOOD_MAX) {
    const oldest = lastGood.keys().next().value;
    if (oldest !== undefined) lastGood.delete(oldest);
  }
  lastGood.set(m.marketId, { market: m, at: Date.now() });
}

/**
 * Market detail. A stripped answer is treated as transient: retry uncached with backoff.
 * If every attempt is stripped, fall back to the last complete row seen for this market,
 * with the fresh row's phase/resolution layered on top so state changes still show.
 */
export async function getMarket(marketId: string, opts: { retries?: number } = {}): Promise<Market> {
  const path = `/markets/${encodeURIComponent(marketId)}/`;
  let last = await pantaRequest(path, marketSchema, { revalidate: 10 });
  const retries = opts.retries ?? 4;
  for (let attempt = 0; attempt < retries && isStripped(last); attempt++) {
    await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    last = await pantaRequest(path, marketSchema);
  }
  if (!isStripped(last)) {
    remember(last);
    return last;
  }
  const good = lastGood.get(marketId);
  return good ? mergeMarket(good.market, last) : last;
}

export function isOpen(m: Market): boolean {
  return (m.phase === "primary" || m.phase === "secondary") && !m.resolved;
}

/** Primary-phase markets are the only ones the API can buy into. */
export function isBuyable(m: Market, nowSec: number = Date.now() / 1000): boolean {
  return m.phase === "primary" && !m.resolved && (m.endTime === null || m.endTime > nowSec);
}

/**
 * Some legacy catalog rows have no title, description, or image. They stay reachable by
 * direct link but are left out of discovery surfaces.
 */
export function isListable(m: Market): boolean {
  return m.title.trim().length > 0 || m.description.trim().length > 0;
}

/**
 * The detail route sometimes answers with a stripped row (empty title, null prices) when
 * Panta's RPC is degraded. Merge field by field so a flaky response never blanks out data
 * we already have from the catalog list.
 */
export function mergeMarket(base: Market, detail: Market): Market {
  const pick = <T,>(d: T, b: T): T => {
    if (d === null || d === undefined) return b;
    if (typeof d === "string" && d.trim() === "") return b;
    if (Array.isArray(d) && d.length === 0) return b;
    return d;
  };
  const merged = { ...base };
  (Object.keys(detail) as (keyof Market)[]).forEach((k) => {
    // Each key is copied from the same-typed object, so the assignment is type-safe.
    (merged as Record<keyof Market, unknown>)[k] = pick(detail[k], base[k]);
  });
  return merged;
}

/** Catalog row for one market, from the cached full catalog. */
export async function getCatalogRow(marketId: string): Promise<Market | null> {
  const all = await listAllMarkets();
  return all.find((m) => m.marketId === marketId) ?? null;
}

/** Detail merged over the catalog row. Either source may fail; at least one must succeed. */
export async function getMarketMerged(marketId: string): Promise<Market> {
  const [detail, row] = await Promise.allSettled([getMarket(marketId), getCatalogRow(marketId)]);
  const d = detail.status === "fulfilled" ? detail.value : null;
  const r = row.status === "fulfilled" ? row.value : null;
  if (d && r) return mergeMarket(r, d);
  if (d) return d;
  if (r) return r;
  throw detail.status === "rejected" ? detail.reason : new Error("Market unavailable");
}

/**
 * Catalog list rows omit spot prices. Fill them in for open markets from the detail route
 * (cached 10s). Markets whose detail fails keep their list row rather than disappearing.
 */
export async function withLivePrices(markets: Market[], max = 40): Promise<Market[]> {
  const open = markets.filter(isOpen).slice(0, max);
  // One quick retry per market keeps the shared snapshot fast; gaps fall back to last-good rows.
  const details = await Promise.allSettled(open.map((m) => getMarket(m.marketId, { retries: 1 })));
  const byId = new Map<string, Market>();
  details.forEach((d) => {
    if (d.status === "fulfilled") byId.set(d.value.marketId, d.value);
  });
  return markets.map((m) => {
    const d = byId.get(m.marketId);
    return d ? mergeMarket(m, d) : m;
  });
}

/**
 * The whole catalog with live prices, computed once and shared by every page for 30s
 * (stale-while-revalidate), so navigating between pages never waits on per-market
 * detail calls. Kept warm by /api/cron/warm.
 */
export const getPricedCatalog = unstable_cache(async () => withLivePrices(await listAllMarkets()), ["priced-catalog-v1"], {
  revalidate: 30,
});

export function getMarketTrades(marketId: string, limit = 50) {
  return pantaRequest(`/markets/${encodeURIComponent(marketId)}/trades/`, marketTradesSchema, {
    query: { limit },
    revalidate: 5,
  });
}

export function getCategories() {
  return pantaRequest("/categories/", categoriesSchema, { revalidate: 3600 });
}

export function getWalletTrades(wallet: string, limit = 200) {
  return pantaRequest(`/wallets/${encodeURIComponent(wallet)}/trades/`, walletTradesSchema, {
    query: { limit },
    revalidate: 15,
  });
}

export function getPositions(wallet: string, opts: { fresh?: boolean } = {}) {
  return pantaRequest("/positions/", positionsSchema, {
    query: { wallet },
    revalidate: opts.fresh ? 0 : 15,
    retryTransient: true,
    timeoutMs: 8_000,
  });
}

/* ---------- Primary buy (never cached) ---------- */

/**
 * Primary quote. Panta intermittently answers INVALID_MARKET_PARAMS for valid requests
 * (the same request succeeds moments later), so retry that code a few times. Quotes only
 * open a short-lived session; retrying is safe.
 */
export async function quoteOrder(input: {
  wallet: string;
  marketId: string;
  side: Side;
  amountUsdc: string;
  userId?: string;
}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await pantaRequest("/primaryorderquote/", orderQuoteSchema, {
        method: "POST",
        body: input,
        userId: input.userId,
      });
    } catch (err) {
      const flaky = err instanceof PantaError && err.code === "INVALID_MARKET_PARAMS" && !err.field;
      if (!flaky || attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 300 + attempt * 250));
    }
  }
}

/** Build primary buy instructions, with the same retry on Panta's intermittent bare error. */
export async function buildOrder(input: {
  quoteId: string;
  wallet: string;
  maxSlippageBps: number;
  userId?: string;
}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await pantaRequest("/primaryorderbuild/", orderBuildSchema, {
        method: "POST",
        body: input,
        userId: input.userId,
      });
    } catch (err) {
      const flaky = err instanceof PantaError && err.code === "INVALID_MARKET_PARAMS" && !err.field;
      if (!flaky || attempt >= 3) throw err;
      await new Promise((r) => setTimeout(r, 300 + attempt * 250));
    }
  }
}

export function submitOrder(input: { orderId: string; signature: string; wallet: string }) {
  return pantaRequest("/primaryordersubmit/", orderSubmitSchema, { method: "POST", body: input });
}

export function verifyOrder(input: { orderId: string; signature?: string; wallet?: string }) {
  return pantaRequest("/primaryorderverify/", orderVerifySchema, { method: "POST", body: input });
}

/* ---------- Market creation ---------- */

export type CreateMarketInput = {
  wallet: string;
  question: string;
  resolutionRule: string;
  sourcesOfTruth: string[];
  category: string;
  startTime: number;
  endTime: number;
  resolutionTime: number;
  imageUrl: string;
  marketType: "standard" | "breaking";
  eventInProgress?: boolean;
  title?: string;
  description?: string;
  region?: string;
};

export function requestImageUpload() {
  return pantaRequest("/markets/create/image-upload/", imageUploadSchema, {
    method: "POST",
    body: {},
  });
}

export function quoteCreate(input: CreateMarketInput) {
  return pantaRequest("/markets/create/quote/", createQuoteSchema, { method: "POST", body: input });
}

export function buildCreate(input: { createId: string; wallet: string }) {
  return pantaRequest("/markets/create/build/", createBuildSchema, { method: "POST", body: input });
}

export function registerCreate(input: { createId: string; signature: string }) {
  return pantaRequest("/markets/register/", registerSchema, { method: "POST", body: input });
}

/* ---------- Claims ---------- */

export function buildWinClaim(input: { wallet: string; marketId: string }) {
  return pantaRequest("/claim/build/", claimBuildSchema, { method: "POST", body: input });
}

export function buildCreatorFeesClaim(input: { wallet: string; marketId: string }) {
  return pantaRequest("/claim/creator-fees/build/", creatorFeesBuildSchema, {
    method: "POST",
    body: input,
  });
}

/* ---------- Attribution ---------- */

export function reportTrade(input: {
  signature: string;
  wallet: string;
  marketId: string;
  quoteId?: string;
  clientOrderId?: string;
  userId?: string;
}) {
  return pantaRequest("/trades/", tradeReportSchema, {
    method: "POST",
    body: input,
    userId: input.userId,
  });
}

export function getTradeStatus(signature: string) {
  return pantaRequest(`/trades/${encodeURIComponent(signature)}/`, tradeStatusSchema);
}
