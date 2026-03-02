import type {
  CompetitionDefinition,
  FootballProvider,
  MatchDetailPayload,
  NormalizedMatch,
  StandingsPayload
} from "./types.js";

const competitions: CompetitionDefinition[] = [
  { code: "PL", name: "Premier League", country: "England", priority: 1 },
  { code: "PD", name: "La Liga", country: "Spain", priority: 2 },
  { code: "BL1", name: "Bundesliga", country: "Germany", priority: 3 },
  { code: "SA", name: "Serie A", country: "Italy", priority: 4 },
  { code: "FL1", name: "Ligue 1", country: "France", priority: 5 },
  { code: "CL", name: "UEFA Champions League", country: "Europe", priority: 6, isInternational: true }
];

const crestMap = {
  Arsenal: "https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg",
  Liverpool: "https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg",
  Barcelona: "https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg",
  "Atletico Madrid": "https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg",
  "Bayern Munich": "https://upload.wikimedia.org/wikipedia/commons/1/1f/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg",
  Inter: "https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg"
} as const;

const buildMatches = (date: string): NormalizedMatch[] => [
  {
    providerMatchId: `${date}-pl-1`,
    competitionCode: "PL",
    competitionName: "Premier League",
    areaName: "England",
    utcDate: `${date}T14:00:00.000Z`,
    status: "LIVE",
    minute: 68,
    stage: "REGULAR_SEASON",
    homeTeam: { name: "Arsenal", shortName: "ARS", crest: crestMap.Arsenal },
    awayTeam: { name: "Liverpool", shortName: "LIV", crest: crestMap.Liverpool },
    fullTime: { home: 2, away: 1 },
    halfTime: { home: 1, away: 1 },
    raw: {
      summary: "Arsenal are pressing the left side aggressively and Liverpool are trying to survive transitions."
    }
  },
  {
    providerMatchId: `${date}-pd-1`,
    competitionCode: "PD",
    competitionName: "La Liga",
    areaName: "Spain",
    utcDate: `${date}T17:30:00.000Z`,
    status: "SCHEDULED",
    stage: "REGULAR_SEASON",
    homeTeam: { name: "Barcelona", shortName: "BAR", crest: crestMap.Barcelona },
    awayTeam: { name: "Atletico Madrid", shortName: "ATM", crest: crestMap["Atletico Madrid"] },
    fullTime: { home: null, away: null },
    halfTime: { home: null, away: null },
    raw: {
      summary: "A high-control possession matchup is expected at Montjuic."
    }
  },
  {
    providerMatchId: `${date}-cl-1`,
    competitionCode: "CL",
    competitionName: "UEFA Champions League",
    areaName: "Europe",
    utcDate: `${date}T20:00:00.000Z`,
    status: "FINISHED",
    stage: "ROUND_OF_16",
    homeTeam: { name: "Bayern Munich", shortName: "BAY", crest: crestMap["Bayern Munich"] },
    awayTeam: { name: "Inter", shortName: "INT", crest: crestMap.Inter },
    fullTime: { home: 3, away: 2 },
    halfTime: { home: 1, away: 1 },
    winner: "HOME_TEAM",
    raw: {
      summary: "Bayern closed the tie strongly after a wide-open second half."
    }
  }
];

const detailMap = (date: string): Record<string, MatchDetailPayload> => ({
  [`${date}-pl-1`]: {
    providerMatchId: `${date}-pl-1`,
    competitionCode: "PL",
    competitionName: "Premier League",
    areaName: "England",
    venue: "Emirates Stadium",
    stage: "Regular Season",
    status: "LIVE",
    minute: 68,
    utcDate: `${date}T14:00:00.000Z`,
    homeTeam: { name: "Arsenal", shortName: "ARS", crest: crestMap.Arsenal },
    awayTeam: { name: "Liverpool", shortName: "LIV", crest: crestMap.Liverpool },
    score: { home: 2, away: 1, halfTimeHome: 1, halfTimeAway: 1 },
    summary: "Arsenal lead through better central progression, while Liverpool remain dangerous on direct counters.",
    stats: [
      { label: "Possession", home: 57, away: 43 },
      { label: "Shots", home: 14, away: 9 },
      { label: "Shots on target", home: 6, away: 4 },
      { label: "Expected goals", home: "1.86", away: "1.14" },
      { label: "Big chances", home: 3, away: 2 },
      { label: "Corners", home: 7, away: 3 }
    ],
    incidents: [
      { minute: 12, type: "goal", team: "home", player: "Bukayo Saka", detail: "Left-foot finish from inside the box" },
      { minute: 29, type: "goal", team: "away", player: "Luis Diaz", detail: "Counterattack goal after a through ball" },
      { minute: 54, type: "goal", team: "home", player: "Martin Odegaard", detail: "Placed finish after cutback" },
      { minute: 62, type: "card", team: "away", player: "Alexis Mac Allister", detail: "Yellow card for stopping transition" }
    ]
  },
  [`${date}-pd-1`]: {
    providerMatchId: `${date}-pd-1`,
    competitionCode: "PD",
    competitionName: "La Liga",
    areaName: "Spain",
    venue: "Olympic Stadium",
    stage: "Regular Season",
    status: "SCHEDULED",
    utcDate: `${date}T17:30:00.000Z`,
    homeTeam: { name: "Barcelona", shortName: "BAR", crest: crestMap.Barcelona },
    awayTeam: { name: "Atletico Madrid", shortName: "ATM", crest: crestMap["Atletico Madrid"] },
    score: { home: null, away: null, halfTimeHome: null, halfTimeAway: null },
    summary: "Barcelona host Atletico in a possession-versus-structure matchup with major title implications.",
    stats: [
      { label: "Home form", home: "W-W-D-W-W", away: "L-W-W-D-W" },
      { label: "Table position", home: 1, away: 4 },
      { label: "Goals per game", home: "2.1", away: "1.7" }
    ],
    incidents: [
      { minute: 0, type: "info", team: "home", player: "Kickoff", detail: "Lineups expected one hour before kickoff" }
    ]
  },
  [`${date}-cl-1`]: {
    providerMatchId: `${date}-cl-1`,
    competitionCode: "CL",
    competitionName: "UEFA Champions League",
    areaName: "Europe",
    venue: "Allianz Arena",
    stage: "Round of 16",
    status: "FINISHED",
    utcDate: `${date}T20:00:00.000Z`,
    homeTeam: { name: "Bayern Munich", shortName: "BAY", crest: crestMap["Bayern Munich"] },
    awayTeam: { name: "Inter", shortName: "INT", crest: crestMap.Inter },
    score: { home: 3, away: 2, halfTimeHome: 1, halfTimeAway: 1 },
    summary: "The game opened up after halftime and Bayern won the final exchanges in transition.",
    stats: [
      { label: "Possession", home: 52, away: 48 },
      { label: "Shots", home: 17, away: 13 },
      { label: "Shots on target", home: 8, away: 5 },
      { label: "Expected goals", home: "2.42", away: "1.67" }
    ],
    incidents: [
      { minute: 18, type: "goal", team: "home", player: "Harry Kane", detail: "Header from close range" },
      { minute: 33, type: "goal", team: "away", player: "Lautaro Martinez", detail: "Low finish across the keeper" },
      { minute: 71, type: "goal", team: "home", player: "Jamal Musiala", detail: "Strike from the edge of the area" },
      { minute: 87, type: "goal", team: "away", player: "Marcus Thuram", detail: "Close-range finish" },
      { minute: 90, type: "goal", team: "home", player: "Leroy Sane", detail: "Winner after fast break" }
    ]
  }
});

const standingsMap: Record<string, StandingsPayload> = {
  PL: {
    competitionCode: "PL",
    competitionName: "Premier League",
    season: "2025-08-01 to 2026-05-31",
    standings: [
      { position: 1, teamName: "Arsenal", playedGames: 27, goalDifference: 34, points: 63, won: 19, draw: 6, lost: 2 },
      { position: 2, teamName: "Liverpool", playedGames: 27, goalDifference: 31, points: 61, won: 18, draw: 7, lost: 2 },
      { position: 3, teamName: "Manchester City", playedGames: 27, goalDifference: 26, points: 55, won: 16, draw: 7, lost: 4 },
      { position: 4, teamName: "Tottenham", playedGames: 27, goalDifference: 18, points: 50, won: 15, draw: 5, lost: 7 }
    ]
  },
  PD: {
    competitionCode: "PD",
    competitionName: "La Liga",
    season: "2025-08-01 to 2026-05-31",
    standings: [
      { position: 1, teamName: "Barcelona", playedGames: 26, goalDifference: 29, points: 60, won: 18, draw: 6, lost: 2 },
      { position: 2, teamName: "Real Madrid", playedGames: 26, goalDifference: 25, points: 58, won: 18, draw: 4, lost: 4 }
    ]
  },
  CL: {
    competitionCode: "CL",
    competitionName: "UEFA Champions League",
    season: "2025-09-01 to 2026-06-01",
    standings: [
      { position: 1, teamName: "Bayern Munich", playedGames: 8, goalDifference: 11, points: 18, won: 6, draw: 0, lost: 2 },
      { position: 2, teamName: "Inter", playedGames: 8, goalDifference: 8, points: 16, won: 5, draw: 1, lost: 2 }
    ]
  }
};

export class MockProvider implements FootballProvider {
  async getCompetitions() {
    return competitions;
  }

  async getMatchesByDate(dateFrom: string) {
    return buildMatches(dateFrom);
  }

  async getLiveMatches() {
    return buildMatches(new Date().toISOString().slice(0, 10)).filter((match) => match.status === "LIVE");
  }

  async getStandings(competitionCode: string) {
    return standingsMap[competitionCode] ?? standingsMap.PL;
  }

  async getMatchDetails(matchId: string) {
    const date = matchId.slice(0, 10);
    const details = detailMap(date);
    return details[matchId] ?? null;
  }
}
