import { NextResponse } from "next/server";

/**
 * Same-origin Solana JSON-RPC relay. The browser never sees the upstream RPC URL (which
 * carries the provider API key), and only the methods Byline needs are forwarded, so the
 * key can't be used for anything else through this endpoint.
 */
const ALLOWED = new Set([
  "getLatestBlockhash",
  "getBlockHeight",
  "getSlot",
  "getBalance",
  "getAccountInfo",
  "getMultipleAccounts",
  "getParsedTokenAccountsByOwner",
  "getTokenAccountsByOwner",
  "getTokenAccountBalance",
  "getSignatureStatuses",
  "getFeeForMessage",
  "getMinimumBalanceForRentExemption",
  "getRecentPrioritizationFees",
  "getVersion",
  "getGenesisHash",
  "getEpochInfo",
  "isBlockhashValid",
  "simulateTransaction",
  "sendTransaction",
]);

const MAX_BODY_BYTES = 64 * 1024;

type RpcCall = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };

function rpcError(id: unknown, code: number, message: string, status = 400) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });
}

function upstream(): string {
  return process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
}

export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return rpcError(null, -32600, "Request too large", 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const calls: RpcCall[] = Array.isArray(body) ? (body as RpcCall[]) : [body as RpcCall];
  if (calls.length === 0 || calls.length > 20) return rpcError(null, -32600, "Invalid batch size");
  for (const c of calls) {
    if (typeof c !== "object" || c === null || typeof c.method !== "string") return rpcError(null, -32600, "Invalid request");
    if (!ALLOWED.has(c.method)) return rpcError(c.id, -32601, `Method ${c.method} is not available`, 403);
  }

  try {
    const res = await fetch(upstream(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: text,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const out = await res.text();
    return new NextResponse(out, { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return rpcError(null, -32603, "Solana RPC unavailable", 502);
  }
}
