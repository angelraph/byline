import type { Position, Trade } from "@/lib/panta/schemas";
import { num } from "@/lib/format";

export type CallRecord = {
  marketId: string;
  title: string | null;
  image: string | null;
  category: string | null;
  side: "yes" | "no";
  shares: number;
  cost: number | null;
  /** Average entry price = cost / shares, i.e. the probability the caller paid for. */
  entryPrice: number | null;
  status: "open" | "won" | "lost" | "cancelled";
  payout: number | null;
  /** True when a win hasn't been claimed yet, so payout is Panta's current valuation. */
  payoutEstimated: boolean;
  currentValue: number | null;
  claimable: boolean;
  claimed: boolean;
  /** First time this wallet bought into this market (unix seconds), from the trade tape. */
  calledAt: number | null;
  hedged: boolean;
};

export type BylineStats = {
  resolved: number;
  wins: number;
  losses: number;
  hitRate: number | null;
  /** Mean entry price over resolved calls: the hit rate the market expected. */
  expectedHitRate: number | null;
  /** hitRate - expectedHitRate. Positive means the caller beat the market's odds. */
  edge: number | null;
  costResolved: number;
  payoutResolved: number;
  roi: number | null;
  streak: { kind: "won" | "lost"; count: number } | null;
  open: number;
  openCost: number;
  openValue: number;
  hedgedMarkets: number;
  totalCalls: number;
};

/** Merge positions (truth for outcome and cost) with trades (truth for timing) into call records. */
export function buildCalls(positions: Position[], trades: Trade[]): CallRecord[] {
  const firstBuy = new Map<string, number>();
  for (const t of trades) {
    if (t.kind !== "buy" || t.blockTime === null) continue;
    const prev = firstBuy.get(t.marketId);
    if (prev === undefined || t.blockTime < prev) firstBuy.set(t.marketId, t.blockTime);
  }

  const sidesByMarket = new Map<string, Set<string>>();
  for (const p of positions) {
    if ((num(p.shares) ?? 0) <= 0 && (num(p.marketPrimaryContributedUsdc) ?? 0) <= 0) continue;
    const set = sidesByMarket.get(p.marketId) ?? new Set<string>();
    set.add(p.side);
    sidesByMarket.set(p.marketId, set);
  }

  return positions
    .filter((p) => (num(p.shares) ?? 0) > 0 || (num(p.marketPrimaryContributedUsdc) ?? 0) > 0)
    .map((p) => {
      const shares = num(p.shares) ?? 0;
      const cost = num(p.marketPrimaryContributedUsdc);
      const resolvedOutcome = p.outcome;
      let status: CallRecord["status"] = "open";
      if (p.phase === "cancelled") status = "cancelled";
      else if (resolvedOutcome) status = resolvedOutcome === p.side ? "won" : "lost";

      // Panta reports cost and payout per market (repeated on both side rows), and a winning
      // share does not pay a flat $1, so the claimed payout is the only exact figure.
      const claimedPayout = num(p.claimedPayoutUsdc);
      const valuation = num(p.currentValueUsdc);
      const payout =
        status === "won" ? (claimedPayout ?? valuation) : status === "lost" ? 0 : null;

      return {
        marketId: p.marketId,
        title: p.title,
        image: p.images[0] ?? null,
        category: p.category,
        side: p.side,
        shares,
        cost,
        // Shares received at no cost carry no price signal.
        entryPrice: cost !== null && cost > 0 && shares > 0 ? Math.min(1, cost / shares) : null,
        status,
        payout,
        payoutEstimated: status === "won" && claimedPayout === null,
        currentValue: num(p.currentValueUsdc),
        claimable: p.claimable,
        claimed: p.claimed,
        calledAt: firstBuy.get(p.marketId) ?? p.claimedAt ?? null,
        hedged: (sidesByMarket.get(p.marketId)?.size ?? 0) > 1,
      };
    })
    .sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0));
}

export function computeStats(calls: CallRecord[]): BylineStats {
  // Hedged markets (both sides held) can't count as a call either way.
  const scored = calls.filter((c) => !c.hedged);
  const resolved = scored.filter((c) => c.status === "won" || c.status === "lost");
  const wins = resolved.filter((c) => c.status === "won").length;
  const losses = resolved.length - wins;

  const priced = resolved.filter((c) => c.entryPrice !== null);
  const expectedHitRate =
    priced.length > 0 ? priced.reduce((s, c) => s + (c.entryPrice ?? 0), 0) / priced.length : null;
  const hitRate = resolved.length > 0 ? wins / resolved.length : null;

  const withCost = resolved.filter((c) => c.cost !== null && c.cost > 0);
  const costResolved = withCost.reduce((s, c) => s + (c.cost ?? 0), 0);
  const payoutResolved = withCost.reduce((s, c) => s + (c.payout ?? 0), 0);

  // Streak runs from the most recent resolved call backwards.
  const byTime = [...resolved].sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0));
  let streak: BylineStats["streak"] = null;
  if (byTime.length > 0) {
    const kind = byTime[0].status === "won" ? "won" : "lost";
    let count = 0;
    for (const c of byTime) {
      if (c.status === kind) count++;
      else break;
    }
    streak = { kind, count };
  }

  const open = scored.filter((c) => c.status === "open");
  return {
    resolved: resolved.length,
    wins,
    losses,
    hitRate,
    expectedHitRate,
    edge: hitRate !== null && expectedHitRate !== null ? hitRate - expectedHitRate : null,
    costResolved,
    payoutResolved,
    roi: costResolved > 0 ? (payoutResolved - costResolved) / costResolved : null,
    streak,
    open: open.length,
    openCost: open.reduce((s, c) => s + (c.cost ?? 0), 0),
    openValue: open.reduce((s, c) => s + (c.currentValue ?? 0), 0),
    hedgedMarkets: new Set(calls.filter((c) => c.hedged).map((c) => c.marketId)).size,
    totalCalls: calls.length,
  };
}
