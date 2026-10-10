import { z } from "zod";
import { handle, addressSchema } from "@/lib/api/route";
import { buildWinClaim } from "@/lib/panta/api";

const schema = z.object({ wallet: addressSchema, marketId: addressSchema });

export const POST = handle(schema, (input) => buildWinClaim(input));
