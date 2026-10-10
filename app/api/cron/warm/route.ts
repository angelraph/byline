import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/leaderboard";
import { getBlotter } from "@/lib/wire";
import { getSlate } from "@/lib/sports/espn";
import { listAllMarkets } from "@/lib/panta/api";
import { jsonError } from "@/lib/api/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Keeps the expensive caches (leaderboard scan, blotter, catalog, sports feed) warm so
 * visitors never pay for a cold recompute. Call every 5-10 minutes from a scheduler with
 * `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this header automatically).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return jsonError("NOT_CONFIGURED", "CRON_SECRET is not set", 503);
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return jsonError("UNAUTHORIZED", "Unauthorized", 401);

  const started = Date.now();
  const results = await Promise.allSettled([listAllMarkets(), getSlate(), getBlotter(), getLeaderboard()]);
  const names = ["catalog", "sports", "blotter", "leaderboard"];
  return NextResponse.json({
    ok: results.every((r) => r.status === "fulfilled"),
    tookMs: Date.now() - started,
    jobs: Object.fromEntries(results.map((r, i) => [names[i], r.status === "fulfilled" ? "ok" : String((r as PromiseRejectedResult).reason)])),
  });
}
