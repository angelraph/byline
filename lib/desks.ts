import { LEAGUES, type LeagueKey } from "@/lib/sports/leagues";

export type Desk =
  | { kind: "league"; slug: string; name: string; league: LeagueKey; blurb: string }
  | { kind: "category"; slug: string; name: string; category: string; blurb: string };

const LEAGUE_BLURBS: Record<LeagueKey, string> = {
  epl: "Every Premier League fixture, the markets on it, and who keeps calling it right.",
  ucl: "European nights. Group stage to final.",
  laliga: "Spain's top flight, game by game.",
  nfl: "Sundays, Mondays, Thursdays. Spreads become yes/no calls.",
  nba: "Tip-off to final buzzer.",
  mlb: "Pitch by pitch, series by series.",
  nhl: "Puck drop and the race for the Cup.",
  ufc: "Every bout on the card, fighter vs fighter.",
};

const CATEGORY_DESKS: { category: string; name: string; blurb: string }[] = [
  { category: "crypto", name: "Crypto", blurb: "Price levels, launches and on-chain events." },
  { category: "pop-culture", name: "Pop Culture", blurb: "Reality TV, awards and celebrity outcomes." },
  { category: "politics", name: "Politics", blurb: "Elections, votes and policy calls." },
  { category: "stocks", name: "Stocks", blurb: "Closes, earnings and index levels." },
  { category: "commodities", name: "Commodities", blurb: "Gold, oil and the real economy." },
  { category: "macroeconomics", name: "Macro", blurb: "Rates, inflation and data prints." },
  { category: "gaming", name: "Gaming", blurb: "Release dates, esports and the industry." },
];

export const DESKS: Desk[] = [
  ...(Object.keys(LEAGUES) as LeagueKey[]).map((k) => ({
    kind: "league" as const,
    slug: k,
    name: LEAGUES[k].label,
    league: k,
    blurb: LEAGUE_BLURBS[k],
  })),
  ...CATEGORY_DESKS.map((c) => ({ kind: "category" as const, slug: c.category, ...c })),
];

export function getDesk(slug: string): Desk | null {
  return DESKS.find((d) => d.slug === slug) ?? null;
}
