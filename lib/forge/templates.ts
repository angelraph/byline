import type { Fixture } from "@/lib/sports/espn";

/** Typical wall-clock length of a game, used for the market's trading window. */
const DURATION_HOURS: Record<string, number> = {
  Soccer: 2.25,
  Football: 3.75,
  Basketball: 2.75,
  Baseball: 3.5,
  Hockey: 3,
  MMA: 1,
};

export type ForgeDraft = {
  question: string;
  title: string;
  description: string;
  resolutionRule: string;
  sourcesOfTruth: string[];
  category: string;
  imageUrl: string;
  startTime: number;
  endTime: number;
  resolutionTime: number;
  marketType: "standard" | "breaking";
  eventInProgress: boolean;
};

export type ForgeTemplate = { key: string; label: string; draft: ForgeDraft };

/** On-chain minimumStartDelay for standard markets (typically one hour). */
export const MIN_START_DELAY_SEC = 3600;

export function timesFor(fixture: Fixture, nowSec: number) {
  const kickoff = Math.floor(Date.parse(fixture.startsAt) / 1000);
  const hours = DURATION_HOURS[fixture.sport] ?? 3;
  const endTime = kickoff + Math.round(hours * 3600);
  // Resolution waits two hours after the scheduled end for the official result.
  const resolutionTime = endTime + 2 * 3600;
  const tooSoon = kickoff < nowSec + MIN_START_DELAY_SEC + 120;
  return {
    startTime: tooSoon ? nowSec : kickoff,
    endTime,
    resolutionTime,
    // Games starting within the hour (or already live) must be breaking markets.
    marketType: tooSoon ? ("breaking" as const) : ("standard" as const),
    eventInProgress: tooSoon,
    tradable: endTime > nowSec + 300,
  };
}

export function templatesFor(fixture: Fixture, nowSec: number): ForgeTemplate[] {
  const home = fixture.home?.name;
  const away = fixture.away?.name;
  if (!home || !away) return [];
  const t = timesFor(fixture, nowSec);
  const when = new Date(fixture.startsAt).toUTCString().replace(" GMT", " UTC");
  const source = fixture.link ?? "https://www.espn.com";
  // Panta recommends a 1024x1024 catalog image; ask ESPN's resizer for that size.
  const image = (fixture.home?.logo ?? fixture.away?.logo ?? "").replace("&w=96&h=96", "&w=1024&h=1024");
  const base = {
    sourcesOfTruth: [source],
    category: "sports",
    imageUrl: image,
    startTime: t.startTime,
    endTime: t.endTime,
    resolutionTime: t.resolutionTime,
    marketType: t.marketType,
    eventInProgress: t.eventInProgress,
  };
  const isSoccer = fixture.sport === "Soccer";
  const regulation = isSoccer ? " in regulation time (90 minutes plus stoppage time)" : ", including overtime if played";
  const voidRule = "If the game is postponed beyond 48 hours or cancelled, the market resolves NO.";

  const templates: ForgeTemplate[] = [
    {
      key: "home-win",
      label: `${home} win`,
      draft: {
        ...base,
        question: `Will ${home} beat ${away}?`,
        title: `${home} beat ${away}?`,
        description: `${fixture.leagueLabel} · ${away} at ${home} · ${when}`,
        resolutionRule: `Resolves YES if ${home} win the ${fixture.leagueLabel} game against ${away} scheduled for ${when}${regulation}, per the official final result on ESPN. Otherwise NO. ${voidRule}`,
      },
    },
    {
      key: "away-win",
      label: `${away} win`,
      draft: {
        ...base,
        question: `Will ${away} beat ${home}?`,
        title: `${away} beat ${home}?`,
        description: `${fixture.leagueLabel} · ${away} at ${home} · ${when}`,
        resolutionRule: `Resolves YES if ${away} win the ${fixture.leagueLabel} game at ${home} scheduled for ${when}${regulation}, per the official final result on ESPN. Otherwise NO. ${voidRule}`,
      },
    },
  ];

  if (isSoccer) {
    templates.push(
      {
        key: "draw",
        label: "Draw",
        draft: {
          ...base,
          question: `Will ${home} vs ${away} end in a draw?`,
          title: `${home} vs ${away}: draw?`,
          description: `${fixture.leagueLabel} · ${when}`,
          resolutionRule: `Resolves YES if the ${fixture.leagueLabel} match between ${home} and ${away} scheduled for ${when} is level after 90 minutes plus stoppage time, per ESPN's official result. Otherwise NO. ${voidRule}`,
        },
      },
      {
        key: "over-2-5",
        label: "Over 2.5 goals",
        draft: {
          ...base,
          question: `Will ${home} vs ${away} have 3 or more goals?`,
          title: `${home} vs ${away}: over 2.5 goals?`,
          description: `${fixture.leagueLabel} · ${when}`,
          resolutionRule: `Resolves YES if 3 or more total goals are scored in the ${fixture.leagueLabel} match between ${home} and ${away} scheduled for ${when}, in regulation time plus stoppage time, per ESPN's official result. Otherwise NO. ${voidRule}`,
        },
      },
    );
  }
  return templates;
}

export function blankDraft(nowSec: number): ForgeDraft {
  const start = nowSec + MIN_START_DELAY_SEC + 15 * 60;
  return {
    question: "",
    title: "",
    description: "",
    resolutionRule: "",
    sourcesOfTruth: [""],
    category: "sports",
    imageUrl: "",
    startTime: start,
    endTime: start + 24 * 3600,
    resolutionTime: start + 26 * 3600,
    marketType: "standard",
    eventInProgress: false,
  };
}
