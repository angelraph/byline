import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/leaderboard";
import { getBlotter } from "@/lib/wire";
import { getSlate } from "@/lib/sports/espn";
import { getPricedCatalog } from "@/lib/panta/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Answer well inside the platform's 60s limit; slower jobs finish on the next run. */
const BUDGET_MS = 45_000;

/**
 * Keeps the shared caches (priced catalog, sports feed, blotter, leaderboard) warm so
 * visitors never wait on a cold recompute. Call it every 5-10 minutes from any scheduler.
 *
 * It needs no credentials: every job here reads through a time-boxed cache, so repeated
 * calls can trigger at most one upstream refresh per cache window, whoever calls it.
 */
export async function GET() {
  const started = Date.now();
  const jobs: [string, () => Promise<unknown>][] = [
    ["catalog", getPricedCatalog],
    ["sports", getSlate],
    ["blotter", getBlotter],
    ["leaderboard", getLeaderboard],
  ];
  const timeout = new Promise<"warming">((resolve) => setTimeout(() => resolve("warming"), BUDGET_MS));
  const results = await Promise.all(
    jobs.map(([, run]) =>
      Promise.race([
        run().then(
          () => "ok" as const,
          () => "delayed" as const,
        ),
        timeout,
      ]),
    ),
  );
  return NextResponse.json(
    {
      ok: results.every((r) => r === "ok"),
      tookMs: Date.now() - started,
      jobs: Object.fromEntries(results.map((r, i) => [jobs[i][0], r])),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
