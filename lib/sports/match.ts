import type { Market } from "@/lib/panta/schemas";
import type { Fixture, Participant } from "./espn";

/** Common names fans (and market creators) use that the feed does not provide. */
const ALIASES: Record<string, string[]> = {
  "tottenham hotspur": ["spurs", "tottenham"],
  "manchester united": ["man united", "man utd", "manchester utd", "united"],
  "manchester city": ["man city", "city"],
  "wolverhampton wanderers": ["wolves"],
  "brighton & hove albion": ["brighton"],
  "west ham united": ["west ham"],
  "newcastle united": ["newcastle"],
  "nottingham forest": ["forest", "nottm forest"],
  "paris saint-germain": ["psg", "paris"],
  "inter milan": ["inter"],
  "bayern munich": ["bayern"],
  "real madrid": ["madrid"],
  "atletico madrid": ["atletico", "atleti"],
};

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesFor(p: Participant): string[] {
  const base = normalize(p.name);
  const names = new Set<string>([base]);
  if (p.alt) names.add(normalize(p.alt));
  for (const a of ALIASES[base] ?? []) names.add(a);
  // Drop trailing "fc"/"cf" so "Arsenal FC" still matches "Arsenal".
  names.add(base.replace(/\b(fc|cf|afc)\b/g, "").trim());
  return [...names].filter((n) => n.length >= 3);
}

/** One-word names that are shared by several clubs and can't identify a team on their own. */
const AMBIGUOUS = new Set(["united", "city", "madrid", "paris", "inter", "forest", "manchester"]);

function mentions(title: string, p: Participant | null): boolean {
  if (!p) return false;
  const t = ` ${normalize(title)} `;
  return namesFor(p).some((n) => t.includes(` ${n} `));
}

/** True when the title names this side with a name that identifies it unambiguously. */
function mentionsStrongly(title: string, p: Participant | null): boolean {
  if (!p) return false;
  const t = ` ${normalize(title)} `;
  return namesFor(p).some((n) => !AMBIGUOUS.has(n) && t.includes(` ${n} `));
}

/**
 * A market belongs to a fixture when its title names both sides, or names one side and its
 * trading window overlaps the fixture's day. Ambiguous one-word aliases ("united", "city")
 * only count alongside the other team, so they cannot cause false matches on their own.
 */
export function marketsForFixture(fixture: Fixture, markets: Market[]): Market[] {
  const kickoff = Date.parse(fixture.startsAt) / 1000;
  return markets.filter((m) => {
    const title = `${m.title} ${m.description}`;
    const home = mentions(title, fixture.home);
    const away = mentions(title, fixture.away);
    if (home && away) return true;
    if (!home && !away) return false;
    const side = home ? fixture.home : fixture.away;
    if (!side) return false;
    const strong = mentionsStrongly(title, side);
    const start = m.startTime ?? 0;
    const end = m.endTime ?? Number.MAX_SAFE_INTEGER;
    const overlaps = kickoff >= start - 86_400 && kickoff <= end + 86_400;
    return strong && overlaps;
  });
}
