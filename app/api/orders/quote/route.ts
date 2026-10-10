import { z } from "zod";
import { handle, addressSchema } from "@/lib/api/route";
import { quoteOrder } from "@/lib/panta/api";

const schema = z.object({
  wallet: addressSchema,
  marketId: addressSchema,
  side: z.enum(["yes", "no"]),
  amountUsdc: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "Enter an amount like 5 or 12.50")
    .refine((v) => Number(v) > 0 && Number(v) <= 100_000, "Amount must be between 0 and 100,000 USDC"),
});

export const POST = handle(schema, (input) => quoteOrder(input));
