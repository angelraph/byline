import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/leaderboard";
import { getBlotter } from "@/lib/wire";
import { getSlate } from "@/lib/sports/espn";
import { getPricedCatalog } from "@/lib/panta/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Keeps the shared caches (priced catalog, sports feed, blotter, leaderboard) warm so
 * visitors never wait on a cold recompute. Call it every 5-10 minutes from any scheduler.
 *
 * It needs no credentials: every job here reads through a time-boxed cache, so repeated
 * calls can trigger at most one upstream refresh per cache window, whoever calls it.
 */
export async function GET() {
  const started = Date.now();
  const results = await Promise.allSettled([getPricedCatalog(), getSlate(), getBlotter(), getLeaderboard()]);
  const names = ["catalog", "sports", "blotter", "leaderboard"];
  return NextResponse.json(
    {
      ok: results.every((r) => r.status === "fulfilled"),
      tookMs: Date.now() - started,
      jobs: Object.fromEntries(results.map((r, i) => [names[i], r.status === "fulfilled" ? "ok" : "delayed"])),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
