import { z } from "zod";
import { handle, addressSchema } from "@/lib/api/route";
import { getPositions, getWalletTrades } from "@/lib/panta/api";
import { buildCalls, computeStats } from "@/lib/stats";

const schema = z.object({ wallet: addressSchema });

export const GET = handle(schema, async ({ wallet }) => {
  const [positions, trades] = await Promise.all([
    getPositions(wallet, { fresh: true }),
    getWalletTrades(wallet, 200).catch(() => ({ items: [] })),
  ]);
  const calls = buildCalls(positions.positions, trades.items);
  return { calls, stats: computeStats(calls) };
});
