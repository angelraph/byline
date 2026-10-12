import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { structured } from "@/lib/ai";
import { getMarketMerged, getMarketTrades, getPricedCatalog, isBuyable } from "@/lib/panta/api";
import { marketTitle, num } from "@/lib/format";
import { getSlate, type Fixture } from "@/lib/sports/espn";
import { fixturesInText, marketsForFixture } from "@/lib/sports/match";
import { templatesFor } from "@/lib/forge/templates";

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
    summary: { type: "string", description: "2 plain sentences: what the text is about, using the real fixture details when given (teams, competition, date, status)." },
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

export type MatchedFixture = {
  id: string;
  league: string;
  name: string;
  startsAt: string;
  state: "pre" | "in" | "post";
  statusDetail: string;
  venue: string | null;
  score: string | null;
};

function describeFixture(f: Fixture): string {
  const when = new Date(f.startsAt).toUTCString().replace(" GMT", " UTC");
  const score =
    f.state !== "pre" && f.home?.score != null && f.away?.score != null ? ` Score: ${f.home.name} ${f.home.score}, ${f.away.name} ${f.away.score}.` : "";
  const status = f.state === "pre" ? "not started" : f.state === "in" ? `live (${f.statusDetail})` : `finished (${f.statusDetail || "final"})`;
  return `${f.home?.name ?? "?"} vs ${f.away?.name ?? "?"} (${f.home?.name ?? "?"} at home), ${f.leagueLabel}, kickoff ${when}${f.venue ? `, ${f.venue}` : ""}. Status: ${status}.${score}`;
}

export async function briefHeadline(text: string) {
  const nowSec = Math.floor(Date.now() / 1000);
  const [markets, slate] = await Promise.all([
    getPricedCatalog().then((ms) => ms.filter((m) => isBuyable(m))),
    getSlate({ daysBack: 3, daysAhead: 21 }).catch(() => ({ fixtures: [] as Fixture[], failed: [] })),
  ]);

  // Ground the brief in real fixtures the text is about.
  const matched = fixturesInText(text, slate.fixtures).slice(0, 3);
  const primary = matched[0] ?? null;

  const list = markets.slice(0, 60).map((m) => `${m.marketId} | ${marketTitle(m)} | YES ${m.yesPrice ?? "?"}`).join("\n");
  const today = new Date().toISOString().slice(0, 10);
  const fixtureFacts = matched.length > 0 ? matched.map((f) => `- ${describeFixture(f)}`).join("\n") : "(no matching fixture in the live schedule)";

  const result = await structured({
    name: "headline_brief",
    system: `Today is ${today}. Turn a headline or news text into a short, plain-English market brief. REAL FIXTURES below come from the official live schedule and are authoritative: use their exact teams, competition, date and status, and never invent or guess dates. Only pick related markets from the list provided.`,
    user: `TEXT:\n${text}\n\nREAL FIXTURES:\n${fixtureFacts}\n\nOPEN PANTA MARKETS (id | title | yes price):\n${list || "(none)"}`,
    jsonSchema: headlineBriefJson,
    schema: headlineBriefSchema,
  });

  const valid = new Set(markets.map((m) => m.marketId));
  const fromFixture = primary ? marketsForFixture(primary, markets).map((m) => m.marketId) : [];
  const related = [...new Set([...fromFixture, ...result.relatedMarketIds.filter((id) => valid.has(id))])].slice(0, 6);

  // For a real game that hasn't finished, the draft comes from the fixture itself: exact
  // kickoff, a precise rule and the official match page, not an AI guess.
  const templates = primary && primary.state !== "post" ? templatesFor(primary, nowSec) : [];
  const template = templates[0] ?? null;
  // A game that has already finished gets no draft: its result is known.
  const finished = primary?.state === "post";
  const draft = finished
    ? null
    : template
    ? {
        question: template.draft.question,
        resolutionRule: template.draft.resolutionRule,
        category: "sports",
        resolvesInDays: Math.max(1, Math.ceil((template.draft.resolutionTime - nowSec) / 86_400)),
      }
    : { ...result.draft, resolvesInDays: Math.min(365, Math.max(1, Math.round(result.draft.resolvesInDays))) };

  const fixture: MatchedFixture | null = primary
    ? {
        id: primary.id,
        league: primary.leagueLabel,
        name: `${primary.home?.name ?? "?"} vs ${primary.away?.name ?? "?"}`,
        startsAt: primary.startsAt,
        state: primary.state,
        statusDetail: primary.statusDetail,
        venue: primary.venue,
        score:
          primary.state !== "pre" && primary.home?.score != null && primary.away?.score != null
            ? `${primary.home.short} ${primary.home.score} – ${primary.away.score} ${primary.away.short}`
            : null,
      }
    : null;

  return {
    summary: result.summary,
    angles: result.angles,
    relatedMarketIds: related,
    related: markets.filter((m) => related.includes(m.marketId)),
    draft,
    fixture,
    forgeHref: template && primary ? `/forge?fixture=${encodeURIComponent(primary.id)}&d=${primary.startsAt.slice(0, 10).replace(/-/g, "")}` : null,
  };
}
