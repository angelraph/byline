export const LEAGUES = {
  epl: { label: "Premier League", short: "EPL", sport: "Soccer", path: "soccer/eng.1", perCompetition: false },
  ucl: { label: "Champions League", short: "UCL", sport: "Soccer", path: "soccer/uefa.champions", perCompetition: false },
  laliga: { label: "LaLiga", short: "LALIGA", sport: "Soccer", path: "soccer/esp.1", perCompetition: false },
  nfl: { label: "NFL", short: "NFL", sport: "Football", path: "football/nfl", perCompetition: false },
  nba: { label: "NBA", short: "NBA", sport: "Basketball", path: "basketball/nba", perCompetition: false },
  mlb: { label: "MLB", short: "MLB", sport: "Baseball", path: "baseball/mlb", perCompetition: false },
  nhl: { label: "NHL", short: "NHL", sport: "Hockey", path: "hockey/nhl", perCompetition: false },
  ufc: { label: "UFC", short: "UFC", sport: "MMA", path: "mma/ufc", perCompetition: true },
} as const;

export type LeagueKey = keyof typeof LEAGUES;

export function isLeagueKey(v: string): v is LeagueKey {
  return v in LEAGUES;
}
