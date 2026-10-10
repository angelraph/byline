import { z } from "zod";
import { handle, addressSchema, signatureSchema } from "@/lib/api/route";
import { reportTrade } from "@/lib/panta/api";

const schema = z.object({ wallet: addressSchema, marketId: addressSchema, signature: signatureSchema });

/** Win claims are attributable on Panta (creator-fee claims are not, so they never come here). */
export const POST = handle(schema, (input) => reportTrade(input));
