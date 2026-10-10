import { z } from "zod";
import { handle, addressSchema, signatureSchema } from "@/lib/api/route";
import { reportTrade, submitOrder, verifyOrder } from "@/lib/panta/api";
import { PantaError } from "@/lib/panta/client";

const schema = z.object({
  orderId: z.string().min(1),
  quoteId: z.string().min(1),
  signature: signatureSchema,
  wallet: addressSchema,
  marketId: addressSchema,
});

/**
 * After the client has broadcast and confirmed the buy: register the signature with Panta,
 * report it for attribution, and return the order status. Submit and report are idempotent
 * per signature, so the client can safely retry this call.
 */
export const POST = handle(schema, async (input) => {
  await submitOrder({ orderId: input.orderId, signature: input.signature, wallet: input.wallet });

  let attribution: "processed" | "pending" = "pending";
  try {
    const r = await reportTrade({
      signature: input.signature,
      wallet: input.wallet,
      marketId: input.marketId,
      quoteId: input.quoteId,
      clientOrderId: input.orderId,
    });
    if (r.status === "processed") attribution = "processed";
  } catch (err) {
    // TX_NOT_FOUND right after confirmation means Panta's RPC hasn't seen it yet; the
    // client polls /api/orders/verify and the memo-based ingest also attributes it.
    if (!(err instanceof PantaError) || err.code !== "TX_NOT_FOUND") throw err;
  }

  const status = await verifyOrder({ orderId: input.orderId, signature: input.signature, wallet: input.wallet });
  return { ...status, attribution };
});
