import { z } from "zod";
import { handle, signatureSchema } from "@/lib/api/route";
import { verifyOrder } from "@/lib/panta/api";

const schema = z.object({
  orderId: z.string().min(1),
  signature: signatureSchema.optional(),
});

export const POST = handle(schema, (input) => verifyOrder(input));
