import { z } from "zod";
import { handle, addressSchema } from "@/lib/api/route";
import { buildOrder } from "@/lib/panta/api";

const schema = z.object({
  quoteId: z.string().min(1),
  wallet: addressSchema,
  maxSlippageBps: z.number().int().min(10).max(5000).default(100),
});

export const POST = handle(schema, (input) => buildOrder(input));
