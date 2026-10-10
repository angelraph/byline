import { z } from "zod";
import { handle, addressSchema } from "@/lib/api/route";
import { getMarket, listMarkets } from "@/lib/panta/api";
import type { Market } from "@/lib/panta/schemas";

const schema = z.object({ wallet: addressSchema });

/**
 * Markets created through Byline (this API account) whose on-chain creator is `wallet`.
 * Creator address only appears on market detail, so each candidate is looked up.
 */
export const GET = handle(schema, async ({ wallet }) => {
  const mine: Market[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const res = await listMarkets({ createdBy: "me", cursor, limit: 50 });
    mine.push(...res.items);
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }
  const details = await Promise.allSettled(mine.map((m) => getMarket(m.marketId)));
  const markets = details
    .filter((d): d is PromiseFulfilledResult<Market> => d.status === "fulfilled")
    .map((d) => d.value)
    .filter((m) => m.creatorAddress === wallet);
  return { markets };
});
