import type { BylineStats } from "@/lib/stats";

export type Division = {
  key: "diamond" | "gold" | "silver" | "bronze" | "rookie";
  label: string;
  /** Tailwind classes for the badge. */
  className: string;
  rule: string;
};

const DIVISIONS: Record<Division["key"], Division> = {
  diamond: { key: "diamond", label: "Diamond", className: "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30", rule: "10+ resolved calls and +15 pts edge" },
  gold: { key: "gold", label: "Gold", className: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30", rule: "5+ resolved calls and +5 pts edge" },
  silver: { key: "silver", label: "Silver", className: "bg-slate-300/15 text-slate-200 ring-1 ring-slate-300/30", rule: "3+ resolved calls and non-negative edge" },
  bronze: { key: "bronze", label: "Bronze", className: "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30", rule: "3+ resolved calls" },
  rookie: { key: "rookie", label: "Rookie", className: "bg-ink-3 text-paper-dim ring-1 ring-line", rule: "Fewer than 3 resolved calls" },
};

/**
 * Division from verified stats. Edge carries the weight so winning favourites can't buy a
 * high division; sample size gates each tier so one lucky call doesn't either.
 */
export function divisionFor(stats: BylineStats): Division {
  const edge = stats.edge ?? -1;
  if (stats.resolved >= 10 && edge >= 0.15) return DIVISIONS.diamond;
  if (stats.resolved >= 5 && edge >= 0.05) return DIVISIONS.gold;
  if (stats.resolved >= 3 && edge >= 0) return DIVISIONS.silver;
  if (stats.resolved >= 3) return DIVISIONS.bronze;
  return DIVISIONS.rookie;
}

export const ALL_DIVISIONS: Division[] = [DIVISIONS.diamond, DIVISIONS.gold, DIVISIONS.silver, DIVISIONS.bronze, DIVISIONS.rookie];
