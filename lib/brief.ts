import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { structured } from "@/lib/ai";
import { getMarketMerged, getMarketTrades, isBuyable, listAllMarkets, withLivePrices } from "@/lib/panta/api";
import { marketTitle, num } from "@/lib/format";

/* ---------- Per-market brief ---------- */

export const marketBriefSchema = z.object({
  headline: z.string(),
  read: z.string(),
  yesCase: z.string(),
  noCase: z.string(),
  watch: z.string(),
});
export type MarketBrief = z.infer<typeof marketBriefSchema>;

const marketBriefJson = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "read", "yesCase", "noCase", "watch"],
  properties: {
    headline: { type: "string", description: "One line, under 90 characters, newsroom style." },
    read: { type: "string", description: "2-3 sentences: what the price implies and what the tape shows." },
    yesCase: { type: "string", description: "1-2 sentences: the strongest argument for YES using only given facts." },
    noCase: { type: "string", description: "1-2 sentences: the strongest argument for NO using only given facts." },
    watch: { type: "string", description: "One sentence: the concrete thing that will decide it." },
  },
};

async function computeMarketBrief(marketId: string): Promise<MarketBrief & { generatedAt: string }> {
  const [market, tape] = await Promise.all([getMarketMerged(marketId), getMarketTrades(marketId, 100).catch(() => ({ items: [] }))]);
  const buys = tape.items.filter((t) => t.kind === "buy");
  const yesShares = buys.filter((t) => t.side === "yes").reduce((s, t) => s + (num(t.shares) ?? 0), 0);
  const noShares = buys.filter((t) => t.side === "no").reduce((s, t) => s + (num(t.shares) ?? 0), 0);
  const wallets = new Set(buys.map((t) => t.wallet)).size;
  const largest = buys.reduce((m, t) => Math.max(m, num(t.shares) ?? 0), 0);
  const recent = buys.slice(0, 10).map((t) => `${t.side ?? "?"} ${Number(t.shares ?? 0).toFixed(1)}`).join(", ");
  const now = Date.now() / 1000;

  const facts = [
    `Market: ${marketTitle(market)}`,
    market.description ? `Description: ${market.description}` : null,
    `Category: ${market.category}. Phase: ${market.phase}${market.resolved ? " (resolved)" : ""}.`,
    `YES price: ${market.yesPrice ?? "unknown"}. NO price: ${market.noPrice ?? "unknown"}.`,
    market.endTime ? `Trading closes in ${Math.round((market.endTime - now) / 3600)} hours.` : null,
    market.oracle ? `Resolution source: ${market.oracle}.` : null,
    `Trade tape (last ${buys.length} buys): ${yesShares.toFixed(1)} YES shares vs ${noShares.toFixed(1)} NO shares from ${wallets} distinct wallets. Largest single buy: ${largest.toFixed(1)} shares.`,
    recent ? `Most recent buys, newest first: ${recent}.` : "No buys yet.",
  ]
    .filter(Boolean)
    .join("\n");

  const brief = await structured({
    name: "market_brief",
    system: "Write a scouting report for one market.",
    user: facts,
    jsonSchema: marketBriefJson,
    schema: marketBriefSchema,
  });
  return { ...brief, generatedAt: new Date().toISOString() };
}

/** Cached per market for 15 minutes to keep AI cost bounded under traffic. */
export function getMarketBrief(marketId: string) {
  return unstable_cache(() => computeMarketBrief(marketId), ["market-brief-v1", marketId], { revalidate: 900 })();
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
  const markets = (await withLivePrices(await listAllMarkets())).filter((m) => isBuyable(m));
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
