import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { structured } from "@/lib/ai";
import { getMarketMerged } from "@/lib/panta/api";
import { marketTitle } from "@/lib/format";

export const explainerSchema = z.object({
  plain: z.string(),
  yesWins: z.string(),
  noWins: z.string(),
  decidedBy: z.string(),
});
export type Explainer = z.infer<typeof explainerSchema>;

const explainerJson = {
  type: "object",
  additionalProperties: false,
  required: ["plain", "yesWins", "noWins", "decidedBy"],
  properties: {
    plain: {
      type: "string",
      description:
        "One or two short sentences explaining the question to someone who has never heard of it. Expand abbreviations and jargon (e.g. 'GW6' = Gameweek 6 of the Premier League season, 'FPL' = Fantasy Premier League). Don't explain how YES/NO markets work in general.",
    },
    yesWins: { type: "string", description: "Starts with 'YES wins if'. The exact condition, in plain words." },
    noWins: { type: "string", description: "Starts with 'NO wins if'. The opposite condition, in plain words." },
    decidedBy: { type: "string", description: "Under 25 words: name the source (no URLs, e.g. 'the official Fantasy Premier League site') and the resolution date. Say 'not stated' if unknown." },
  },
};

async function compute(marketId: string): Promise<Explainer> {
  const m = await getMarketMerged(marketId);
  const fmt = (t: number | null) => (t ? new Date(t * 1000).toUTCString().replace(" GMT", " UTC") : "unknown");
  const facts = [
    `Title: ${marketTitle(m)}`,
    m.description ? `Description: ${m.description}` : "Description: (none)",
    `Category: ${m.category}`,
    `Resolution source(s): ${m.oracle ?? "not stated"}`,
    `Trading closes: ${fmt(m.endTime)}. Resolves around: ${fmt(m.resolutionTime)}.`,
  ].join("\n");
  return structured({
    name: "market_explainer",
    system:
      "Explain a YES/NO prediction market in plain English for a newcomer. Only restate what the market says; never add facts, odds or opinions. If the title is ambiguous, explain the most literal reading and say what is unclear.",
    user: facts,
    jsonSchema: explainerJson,
    schema: explainerSchema,
  });
}

/** Plain-English explainer per market, cached for a day (market wording doesn't change). */
export function getExplainer(marketId: string) {
  return unstable_cache(() => compute(marketId), ["market-explainer-v2", marketId], { revalidate: 86_400 })();
}
