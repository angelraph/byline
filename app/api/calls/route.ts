import { NextResponse } from "next/server";
import { z } from "zod";
import { addressSchema, jsonError, signatureSchema } from "@/lib/api/route";
import { isDbConfigured } from "@/lib/db";
import { sessionWallet } from "@/lib/session";
import { cleanText, getCall, insertCall, listCalls, recentCallCount } from "@/lib/social";
import { verifyTradeOnChain } from "@/lib/solana/verify";
import { getMarketMerged, isBuyable, quoteOrder } from "@/lib/panta/api";
import { num } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const listSchema = z.object({
  market: addressSchema.optional(),
  wallet: addressSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ calls: [] });
  const parsed = listSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return jsonError("INVALID_INPUT", "Invalid query", 400);
  const calls = await listCalls({ marketId: parsed.data.market, wallet: parsed.data.wallet, limit: parsed.data.limit });
  return NextResponse.json({ calls });
}

const postSchema = z.object({
  marketId: addressSchema,
  side: z.enum(["yes", "no"]),
  thesis: z.string().max(1000).default(""),
  signature: signatureSchema.optional(),
  entryPrice: z.number().min(0).max(1).optional(),
  amountUsdc: z.number().min(0).max(1_000_000).optional(),
  shares: z.number().min(0).max(100_000_000).optional(),
  parentId: z.string().uuid().optional(),
});

/**
 * Post a call. With a transaction signature it's a verified call (checked on-chain);
 * without one it's a paper call at the market's live price. Requires a signed-in wallet.
 */
export async function POST(req: Request) {
  if (!isDbConfigured()) return jsonError("NOT_CONFIGURED", "Calls are unavailable right now.", 503);
  const wallet = await sessionWallet();
  if (!wallet) return jsonError("SIGN_IN_REQUIRED", "Sign in with your wallet to post a call.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("BAD_REQUEST", "Request body must be JSON", 400);
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return jsonError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input", 400);
  const input = parsed.data;

  if ((await recentCallCount(wallet, 60)) >= 20) {
    return jsonError("RATE_LIMITED", "You've posted a lot of calls in the last hour. Try again later.", 429);
  }

  let stance: "back" | "fade" | null = null;
  let parentId: string | null = null;
  if (input.parentId) {
    const parent = await getCall(input.parentId);
    if (!parent || parent.market_id !== input.marketId) return jsonError("INVALID_INPUT", "That call isn't on this market.", 400);
    if (parent.wallet === wallet) return jsonError("INVALID_INPUT", "You can't back or fade your own call.", 400);
    stance = parent.side === input.side ? "back" : "fade";
    parentId = parent.id;
  }

  const thesis = cleanText(input.thesis);

  if (input.signature) {
    const ok = await verifyTradeOnChain(input.signature, wallet, input.marketId);
    if (!ok) return jsonError("TX_UNVERIFIED", "That transaction couldn't be verified on-chain for this wallet and market yet. Try again in a moment.", 400);
    const call = await insertCall({
      wallet,
      marketId: input.marketId,
      side: input.side,
      thesis,
      kind: "verified",
      signature: input.signature,
      entryPrice: input.entryPrice ?? null,
      amountUsdc: input.amountUsdc ?? null,
      shares: input.shares ?? null,
      parentId,
      stance,
    });
    return NextResponse.json({ call });
  }

  // Paper call: priced by the server at the market's live line, never by the client.
  if (!thesis) return jsonError("INVALID_INPUT", "A paper call needs a thesis.", 400);
  const market = await getMarketMerged(input.marketId);
  if (!isBuyable(market)) return jsonError("MARKET_CLOSED", "This market isn't open, so it can't take new calls.", 400);
  let price = num(input.side === "yes" ? market.yesPrice : market.noPrice);
  if (price === null) {
    // Spot price missing (Panta's detail route is intermittent): stamp the call at the
    // executable price of a real $1 quote for this wallet instead.
    const quote = await quoteOrder({ wallet, marketId: input.marketId, side: input.side, amountUsdc: "1" }).catch(() => null);
    price = quote ? num(quote.avgPrice) : null;
  }
  if (price === null) return jsonError("NO_PRICE", "The live price is unavailable right now, so the paper call can't be stamped. Try again shortly.", 503);
  const call = await insertCall({
    wallet,
    marketId: input.marketId,
    side: input.side,
    thesis,
    kind: "paper",
    signature: null,
    entryPrice: price,
    amountUsdc: null,
    shares: null,
    parentId,
    stance,
  });
  return NextResponse.json({ call });
}
