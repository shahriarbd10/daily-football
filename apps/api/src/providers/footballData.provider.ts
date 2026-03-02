import { env } from "../config/env.js";
import type {
  CompetitionDefinition,
  FootballProvider,
  MatchDetailPayload,
  NormalizedMatch,
  StandingsPayload
} from "./types.js";

const TOP_COMPETITIONS: CompetitionDefinition[] = [
  { code: "PL", name: "Premier League", country: "England", priority: 1 },
  { code: "PD", name: "La Liga", country: "Spain", priority: 2 },
  { code: "BL1", name: "Bundesliga", country: "Germany", priority: 3 },
  { code: "SA", name: "Serie A", country: "Italy", priority: 4 },
  { code: "FL1", name: "Ligue 1", country: "France", priority: 5 },
  { code: "CL", name: "UEFA Champions League", country: "Europe", priority: 6, isInternational: true },
  { code: "WC", name: "FIFA World Cup", country: "International", priority: 7, isInternational: true },
  { code: "EC", name: "UEFA European Championship", country: "Europe", priority: 8, isInternational: true }
];

const buildUrl = (path: string, params: Record<string, string | undefined>) => {
  const url = new URL(`${env.footballDataBaseUrl}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
};

const request = async <T>(path: string, params: Record<string, string | undefined> = {}): Promise<T> => {
  const response = await fetch(buildUrl(path, params), {
    headers: {
      "X-Auth-Token": env.footballDataApiKey ?? ""
    }
  });

  if (!response.ok) {
    throw new Error(`football-data request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
};

const normalizeMatch = (match: any): NormalizedMatch => ({
  providerMatchId: String(match.id),
  competitionCode: match.competition?.code ?? "UNK",
  competitionName: match.competition?.name ?? "Unknown Competition",
  areaName: match.area?.name ?? match.competition?.area?.name ?? "Unknown",
  utcDate: match.utcDate,
  status: match.status ?? "SCHEDULED",
  minute: match.minute ?? undefined,
  venue: match.venue ?? undefined,
  stage: match.stage ?? undefined,
  homeTeam: {
    id: match.homeTeam?.id,
    name: match.homeTeam?.name ?? "Home",
    shortName: match.homeTeam?.shortName,
    crest: match.homeTeam?.crest
  },
  awayTeam: {
    id: match.awayTeam?.id,
    name: match.awayTeam?.name ?? "Away",
    shortName: match.awayTeam?.shortName,
    crest: match.awayTeam?.crest
  },
  fullTime: {
    home: match.score?.fullTime?.home ?? null,
    away: match.score?.fullTime?.away ?? null
  },
  halfTime: {
    home: match.score?.halfTime?.home ?? null,
    away: match.score?.halfTime?.away ?? null
  },
  winner: match.score?.winner ?? undefined,
  sourceUpdatedAt: match.lastUpdated ?? undefined,
  raw: match
});

export class FootballDataProvider implements FootballProvider {
  async getCompetitions() {
    return TOP_COMPETITIONS;
  }

  async getMatchesByDate(dateFrom: string, dateTo: string, competitionCodes: string[]) {
    const payload = await request<{ matches: any[] }>("/matches", {
      dateFrom,
      dateTo,
      competitions: competitionCodes.join(",")
    });

    return payload.matches.map(normalizeMatch);
  }

  async getLiveMatches(competitionCodes: string[]) {
    const payload = await request<{ matches: any[] }>("/matches", {
      status: "LIVE",
      competitions: competitionCodes.join(",")
    });

    return payload.matches.map(normalizeMatch);
  }

  async getStandings(competitionCode: string): Promise<StandingsPayload> {
    const payload = await request<any>(`/competitions/${competitionCode}/standings`);
    const table = payload.standings?.find((item: any) => item.type === "TOTAL")?.table ?? [];

    return {
      competitionCode,
      competitionName: payload.competition?.name ?? competitionCode,
      season: payload.season?.startDate && payload.season?.endDate
        ? `${payload.season.startDate} to ${payload.season.endDate}`
        : "Current season",
      standings: table.map((row: any) => ({
        position: row.position,
        teamName: row.team?.shortName ?? row.team?.name ?? "Unknown",
        crest: row.team?.crest,
        playedGames: row.playedGames,
        goalDifference: row.goalDifference,
        points: row.points,
        won: row.won,
        draw: row.draw,
        lost: row.lost
      }))
    };
  }

  async getMatchDetails(matchId: string): Promise<MatchDetailPayload | null> {
    const payload = await request<any>(`/matches/${matchId}`);
    const match = payload.match;

    if (!match) {
      return null;
    }

    return {
      providerMatchId: String(match.id),
      competitionCode: match.competition?.code ?? "UNK",
      competitionName: match.competition?.name ?? "Unknown Competition",
      areaName: match.area?.name ?? match.competition?.area?.name ?? "Unknown",
      venue: match.venue ?? "Venue not listed",
      stage: match.stage ?? undefined,
      status: match.status ?? "SCHEDULED",
      minute: match.minute ?? undefined,
      utcDate: match.utcDate,
      homeTeam: {
        name: match.homeTeam?.name ?? "Home",
        shortName: match.homeTeam?.shortName,
        crest: match.homeTeam?.crest
      },
      awayTeam: {
        name: match.awayTeam?.name ?? "Away",
        shortName: match.awayTeam?.shortName,
        crest: match.awayTeam?.crest
      },
      score: {
        home: match.score?.fullTime?.home ?? null,
        away: match.score?.fullTime?.away ?? null,
        halfTimeHome: match.score?.halfTime?.home ?? null,
        halfTimeAway: match.score?.halfTime?.away ?? null
      },
      summary: "Detailed event and statistics coverage depends on the active provider plan.",
      stats: [
        { label: "Possession", home: "-", away: "-" },
        { label: "Shots on target", home: "-", away: "-" },
        { label: "Expected goals", home: "-", away: "-" }
      ],
      incidents: []
    };
  }
}
