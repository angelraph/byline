import "server-only";
import { z } from "zod";
import { LEAGUES, type LeagueKey } from "./leagues";

/**
 * ESPN serves the same public scoreboard from several hosts, and edge blocking differs per
 * host and network. Try them in order and use the first that answers.
 */
const ESPN_HOSTS = [
  "https://site.web.api.espn.com/apis/site/v2/sports",
  "https://site.api.espn.com/apis/site/v2/sports",
];

async function fetchScoreboard(path: string, dates?: string): Promise<unknown> {
  let lastStatus = 0;
  for (const host of ESPN_HOSTS) {
    const url = new URL(`${host}/${path}/scoreboard`);
    if (dates) url.searchParams.set("dates", dates);
    try {
      const res = await fetch(url, {
        next: { revalidate: 60 },
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; BylineBot/1.0)" },
      });
      if (res.ok) return await res.json();
      lastStatus = res.status;
    } catch {
      lastStatus = -1;
    }
  }
  throw new Error(`Sports feed unavailable (${lastStatus})`);
}

const scoreSchema = z
  .union([z.string(), z.number(), z.object({ displayValue: z.string().optional() }), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "object") return v.displayValue ?? null;
    return String(v);
  });

const competitorSchema = z.object({
  id: z.string(),
  homeAway: z.enum(["home", "away"]).optional(),
  winner: z.boolean().optional(),
  score: scoreSchema,
  team: z
    .object({
      displayName: z.string(),
      shortDisplayName: z.string().optional(),
      abbreviation: z.string().optional(),
      logo: z.string().optional(),
      color: z.string().optional(),
    })
    .optional(),
  athlete: z
    .object({
      displayName: z.string(),
      shortName: z.string().optional(),
      flag: z.object({ href: z.string().optional() }).optional(),
    })
    .optional(),
});

const statusSchema = z.object({
  type: z.object({
    state: z.enum(["pre", "in", "post"]),
    completed: z.boolean().optional(),
    description: z.string().optional(),
    shortDetail: z.string().optional(),
  }),
});

const competitionSchema = z.object({
  id: z.string(),
  date: z.string(),
  status: statusSchema,
  type: z.object({ abbreviation: z.string().optional(), text: z.string().optional() }).optional(),
  competitors: z.array(competitorSchema).optional().default([]),
  venue: z.object({ fullName: z.string().optional() }).optional(),
});

const eventSchema = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string(),
  shortName: z.string().optional(),
  competitions: z.array(competitionSchema),
  links: z.array(z.object({ href: z.string() })).optional().default([]),
});

const scoreboardSchema = z.object({ events: z.array(eventSchema).optional().default([]) });

export type Participant = {
  name: string;
  short: string;
  /** Alternate display name, e.g. "Spurs" style short names from the feed. */
  alt: string | null;
  logo: string | null;
  score: string | null;
  winner: boolean;
};

export type Fixture = {
  /** Stable id: league + ESPN competition id. */
  id: string;
  league: LeagueKey;
  leagueLabel: string;
  sport: string;
  name: string;
  startsAt: string;
  state: "pre" | "in" | "post";
  statusDetail: string;
  venue: string | null;
  /** Public ESPN page for the game: the resolution source for markets forged from it. */
  link: string | null;
  home: Participant | null;
  away: Participant | null;
};

/** ESPN logos are 500px PNGs; serve a small resized copy through ESPN's own image combiner. */
function smallLogo(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/^https:\/\/a\.espncdn\.com(\/i\/.+\.png)$/);
  return m ? `https://a.espncdn.com/combiner/i?img=${m[1]}&w=96&h=96` : url;
}

function toParticipant(c: z.infer<typeof competitorSchema>): Participant | null {
  if (c.team) {
    return {
      name: c.team.displayName,
      short: c.team.abbreviation ?? c.team.shortDisplayName ?? c.team.displayName,
      alt: c.team.shortDisplayName ?? null,
      logo: smallLogo(c.team.logo),
      score: c.score,
      winner: c.winner ?? false,
    };
  }
  if (c.athlete) {
    return {
      name: c.athlete.displayName,
      short: c.athlete.shortName ?? c.athlete.displayName,
      alt: c.athlete.shortName ?? null,
      logo: c.athlete.flag?.href ?? null,
      score: c.score,
      winner: c.winner ?? false,
    };
  }
  return null;
}

/**
 * Real fixtures for one league. Without `dates` the feed returns its current window
 * (this week / matchday), which is the only form every league answers reliably.
 * `dates` (YYYYMMDD) is used to look up a single fixture for Forge.
 * Cached for 120s in the Next.js data cache so traffic to the feed stays low.
 */
export async function getFixtures(league: LeagueKey, dates?: string): Promise<Fixture[]> {
  const meta = LEAGUES[league];
  const parsed = scoreboardSchema.safeParse(await fetchScoreboard(meta.path, dates));
  if (!parsed.success) throw new Error(`Sports feed format changed for ${meta.label}`);

  const fixtures: Fixture[] = [];
  for (const event of parsed.data.events) {
    // Fight cards list each bout as a competition; team sports have exactly one.
    const comps = meta.perCompetition ? event.competitions : event.competitions.slice(0, 1);
    for (const comp of comps) {
      const home = comp.competitors.find((c) => c.homeAway === "home") ?? comp.competitors[0];
      const away = comp.competitors.find((c) => c.homeAway === "away") ?? comp.competitors[1];
      const homeP = home ? toParticipant(home) : null;
      const awayP = away ? toParticipant(away) : null;
      const name =
        meta.perCompetition && homeP && awayP
          ? `${awayP.name} vs ${homeP.name}`
          : event.name;
      fixtures.push({
        id: `${league}-${comp.id}`,
        league,
        leagueLabel: meta.label,
        sport: meta.sport,
        name,
        startsAt: comp.date,
        state: comp.status.type.state,
        statusDetail: comp.status.type.shortDetail ?? comp.status.type.description ?? "",
        venue: comp.venue?.fullName ?? null,
        link:
          event.links.find((l) => /gameId|\/game\/|\/match\/|\/fight/.test(l.href))?.href ??
          event.links[0]?.href ??
          null,
        home: homeP,
        away: awayP,
      });
    }
  }
  return fixtures;
}

/** Fixtures for every tracked league in a window around now. Leagues that fail are reported, not hidden. */
export async function getSlate(opts: { daysBack?: number; daysAhead?: number } = {}) {
  const now = Date.now();
  const from = now - (opts.daysBack ?? 1) * 86_400_000;
  const to = now + (opts.daysAhead ?? 7) * 86_400_000;

  const keys = Object.keys(LEAGUES) as LeagueKey[];
  const results = await Promise.allSettled(keys.map((k) => getFixtures(k)));
  const fixtures: Fixture[] = [];
  const failed: LeagueKey[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      for (const f of r.value) {
        const t = Date.parse(f.startsAt);
        // Live games always show; others must fall inside the window.
        if (f.state === "in" || (t >= from && t <= to)) fixtures.push(f);
      }
    } else failed.push(keys[i]);
  });
  fixtures.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { fixtures, failed };
}

/** Look up one fixture by id. `date` (YYYYMMDD) narrows the feed to that day. */
export async function getFixture(id: string, date?: string): Promise<Fixture | null> {
  const league = id.split("-")[0];
  if (!(league in LEAGUES)) return null;
  const key = league as LeagueKey;
  const lists = await Promise.allSettled([date ? getFixtures(key, date) : Promise.resolve([]), getFixtures(key)]);
  for (const l of lists) {
    if (l.status !== "fulfilled") continue;
    const hit = l.value.find((f) => f.id === id);
    if (hit) return hit;
  }
  return null;
}
