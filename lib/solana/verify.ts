import "server-only";
import { z } from "zod";

const txSchema = z.object({
  result: z
    .object({
      meta: z.object({ err: z.unknown().nullable() }).nullable(),
      transaction: z.object({
        message: z.object({
          accountKeys: z.array(z.string()),
          header: z.object({ numRequiredSignatures: z.number() }),
        }),
      }),
    })
    .nullable(),
});

/**
 * True when `signature` is a successful transaction signed by `wallet` that touches
 * `marketId`. This is what makes a "verified" call: the receipt is checked on-chain.
 */
export async function verifyTradeOnChain(signature: string, wallet: string, marketId: string): Promise<boolean> {
  const url = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [signature, { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (res?.ok) {
      const parsed = txSchema.safeParse(await res.json().catch(() => null));
      const tx = parsed.success ? parsed.data.result : null;
      if (tx) {
        if (tx.meta?.err) return false;
        const { accountKeys, header } = tx.transaction.message;
        const signers = accountKeys.slice(0, header.numRequiredSignatures);
        return signers.includes(wallet) && accountKeys.includes(marketId);
      }
    }
    // Freshly confirmed transactions can take a moment to be queryable.
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}
