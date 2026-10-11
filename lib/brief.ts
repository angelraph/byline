import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { structured } from "@/lib/ai";
import { getMarketMerged, getMarketTrades, getPricedCatalog, isBuyable } from "@/lib/panta/api";
import { marketTitle, num } from "@/lib/format";

/* ---------- Per-market brief ---------- */

export const marketBriefSchema = z.object({
  headline: z.string(),
  marketView: z.string(),
  moneyFlow: z.string(),
  decider: z.string(),
});
export type MarketBrief = z.infer<typeof marketBriefSchema>;

const marketBriefJson = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "marketView", "moneyFlow", "decider"],
  properties: {
    headline: { type: "string", description: "One short line a casual fan understands, under 70 characters." },
    marketView: {
      type: "string",
      description: "One sentence: what the market thinks, as a rounded chance in plain words (e.g. 'about a coin flip', 'roughly 3 in 4').",
    },
    moneyFlow: {
      type: "string",
      description: "One or two sentences: which side recent bettors are backing, in plain words (count people, not shares). Say plainly if there is little activity.",
    },
    decider: { type: "string", description: "One sentence: exactly what settles the bet and roughly when, in everyday words." },
  },
};

function humanDuration(seconds: number): string {
  const days = Math.round(seconds / 86_400);
  if (seconds < 3600) return "less than an hour";
  if (seconds < 86_400) return `about ${Math.round(seconds / 3600)} hours`;
  if (days < 14) return `about ${days} days`;
  if (days < 60) return `about ${Math.round(days / 7)} weeks`;
  return `about ${Math.round(days / 30)} months`;
}

async function computeMarketBrief(marketId: string): Promise<MarketBrief & { generatedAt: string }> {
  const [market, tape] = await Promise.all([getMarketMerged(marketId), getMarketTrades(marketId, 100).catch(() => ({ items: [] }))]);
  const buys = tape.items.filter((t) => t.kind === "buy");
  const yesBuyers = new Set(buys.filter((t) => t.side === "yes").map((t) => t.wallet)).size;
  const noBuyers = new Set(buys.filter((t) => t.side === "no").map((t) => t.wallet)).size;
  const last10 = buys.slice(0, 10);
  const recentYes = last10.filter((t) => t.side === "yes").length;
  const now = Date.now() / 1000;
  const yes = num(market.yesPrice);

  const facts = [
    `Question: ${marketTitle(market)}`,
    market.description ? `Description: ${market.description}` : null,
    yes !== null ? `Market chance of YES: about ${Math.round(yes * 100)}%.` : "Market chance: unknown right now.",
    market.endTime ? `Betting closes in ${humanDuration(market.endTime - now)}.` : null,
    market.oracle ? `Settled by: ${market.oracle}.` : null,
    buys.length > 0
      ? `Recent betting: ${yesBuyers} different people bought YES and ${noBuyers} bought NO. Of the last ${last10.length} bets, ${recentYes} were YES.`
      : "No bets yet.",
  ]
    .filter(Boolean)
    .join("\n");

  const brief = await structured({
    name: "market_brief",
    system:
      "Write a short, friendly market brief for casual sports and news fans. Plain everyday English, short sentences, no jargon. Round numbers; never use decimals or hours counts; never say 'shares', 'tape', 'wallets' or 'liquidity'.",
    user: facts,
    jsonSchema: marketBriefJson,
    schema: marketBriefSchema,
  });
  return { ...brief, generatedAt: new Date().toISOString() };
}

/** Cached per market for 15 minutes to keep AI cost bounded under traffic. */
export function getMarketBrief(marketId: string) {
  return unstable_cache(() => computeMarketBrief(marketId), ["market-brief-v2", marketId], { revalidate: 900 })();
}

/* ---------- Headline brief ---------- */

export const headlineBriefSchema = z.object({
  summary: z.string(),
  angles: z.array(z.string()),
  relatedMarketIds: z.array(z.string()),
  draft: z.object({
    question: z.string(),
    resolutionRule: z.string(),
    category: z.string(),
    resolvesInDays: z.number(),
  }),
});
export type HeadlineBrief = z.infer<typeof headlineBriefSchema>;

const headlineBriefJson = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "angles", "relatedMarketIds", "draft"],
  properties: {
    summary: { type: "string", description: "2 sentences restating what the text claims, without adding facts." },
    angles: { type: "array", items: { type: "string" }, description: "2-4 short, checkable YES/NO questions this raises." },
    relatedMarketIds: {
      type: "array",
      items: { type: "string" },
      description: "IDs from the provided open-markets list that are genuinely about the same subject. Empty if none.",
    },
    draft: {
      type: "object",
      additionalProperties: false,
      required: ["question", "resolutionRule", "category", "resolvesInDays"],
      properties: {
        question: { type: "string", description: "One clear YES/NO question with a date." },
        resolutionRule: { type: "string", description: "Exact YES condition, data source, and what happens if it can't be determined (resolves NO)." },
        category: { type: "string", enum: ["sports", "crypto", "politics", "entertainment", "finance", "science", "world", "other"] },
        resolvesInDays: { type: "number", description: "Days from today until the outcome is known (1-365)." },
      },
    },
  },
};

export async function briefHeadline(text: string) {
  const markets = (await getPricedCatalog()).filter((m) => isBuyable(m));
  const list = markets.slice(0, 60).map((m) => `${m.marketId} | ${marketTitle(m)} | YES ${m.yesPrice ?? "?"}`).join("\n");
  const today = new Date().toISOString().slice(0, 10);
  const result = await structured({
    name: "headline_brief",
    system: `Today is ${today}. Turn a headline or news text into a market brief. Only pick related markets from the list provided.`,
    user: `TEXT:\n${text}\n\nOPEN PANTA MARKETS (id | title | yes price):\n${list || "(none)"}`,
    jsonSchema: headlineBriefJson,
    schema: headlineBriefSchema,
  });
  const valid = new Set(markets.map((m) => m.marketId));
  const related = result.relatedMarketIds.filter((id) => valid.has(id)).slice(0, 6);
  return {
    ...result,
    relatedMarketIds: related,
    related: markets.filter((m) => related.includes(m.marketId)),
    draft: { ...result.draft, resolvesInDays: Math.min(365, Math.max(1, Math.round(result.draft.resolvesInDays))) },
  };
}
