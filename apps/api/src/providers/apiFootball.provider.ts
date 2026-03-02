import { env } from "../config/env.js";
import type {
  CompetitionDefinition,
  FootballProvider,
  MatchDetailPayload,
  MatchIncident,
  MatchStat,
  NormalizedMatch,
  StandingsPayload
} from "./types.js";

type CompetitionMapItem = CompetitionDefinition & {
  apiLeagueId: number;
  type: "league" | "cup";
  seasonMode: "europe" | "calendar";
};

const COMPETITIONS: CompetitionMapItem[] = [
  { code: "PL", name: "Premier League", country: "England", priority: 1, apiLeagueId: 39, type: "league", seasonMode: "europe" },
  { code: "PD", name: "La Liga", country: "Spain", priority: 2, apiLeagueId: 140, type: "league", seasonMode: "europe" },
  { code: "BL1", name: "Bundesliga", country: "Germany", priority: 3, apiLeagueId: 78, type: "league", seasonMode: "europe" },
  { code: "SA", name: "Serie A", country: "Italy", priority: 4, apiLeagueId: 135, type: "league", seasonMode: "europe" },
  { code: "FL1", name: "Ligue 1", country: "France", priority: 5, apiLeagueId: 61, type: "league", seasonMode: "europe" },
  { code: "CL", name: "UEFA Champions League", country: "Europe", priority: 6, isInternational: true, apiLeagueId: 2, type: "cup", seasonMode: "europe" },
  { code: "WC", name: "FIFA World Cup", country: "International", priority: 7, isInternational: true, apiLeagueId: 1, type: "cup", seasonMode: "calendar" },
  { code: "EC", name: "UEFA European Championship", country: "Europe", priority: 8, isInternational: true, apiLeagueId: 4, type: "cup", seasonMode: "calendar" }
];

const byCode = new Map(COMPETITIONS.map((competition) => [competition.code, competition]));

const normalizeStatus = (shortStatus?: string) => {
  switch (shortStatus) {
    case "1H":
    case "2H":
    case "ET":
    case "P":
      return "LIVE";
    case "HT":
    case "BT":
      return "PAUSED";
    case "NS":
    case "TBD":
      return "SCHEDULED";
    case "PST":
      return "POSTPONED";
    case "FT":
    case "AET":
    case "PEN":
      return "FINISHED";
    default:
      return shortStatus ?? "SCHEDULED";
  }
};

type ApiFootballEnvelope<T> = {
  errors?: Record<string, string> | [];
  response: T;
  results?: number;
};

const apiRequest = async <T>(path: string, params: Record<string, string | number | undefined>) => {
  const url = new URL(`${env.apiFootballBaseUrl}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": env.apiFootballApiKey ?? ""
    }
  });

  if (!response.ok) {
    throw new Error(`api-football request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as ApiFootballEnvelope<T>;

  if (payload.errors && Object.keys(payload.errors).length > 0) {
    throw new Error(`api-football payload error: ${JSON.stringify(payload.errors)}`);
  }

  return payload;
};

const getSeasonForDate = (date: string, mode: CompetitionMapItem["seasonMode"]) => {
  const [year, month] = date.split("-").map(Number);

  if (mode === "calendar") {
    return year;
  }

  return month >= 7 ? year : year - 1;
};

const normalizeFixture = (fixture: any, leagueOverride?: CompetitionMapItem): NormalizedMatch => {
  const league = leagueOverride ?? byCode.get(
    COMPETITIONS.find((item) => item.apiLeagueId === fixture.league?.id)?.code ?? "PL"
  );

  return {
    providerMatchId: String(fixture.fixture?.id),
    competitionCode: league?.code ?? "UNK",
    competitionName: fixture.league?.name ?? league?.name ?? "Unknown Competition",
    areaName: fixture.league?.country ?? league?.country ?? "Unknown",
    utcDate: fixture.fixture?.date,
    status: normalizeStatus(fixture.fixture?.status?.short),
    minute: fixture.fixture?.status?.elapsed ?? undefined,
    venue: fixture.fixture?.venue?.name ?? undefined,
    stage: fixture.league?.round ?? undefined,
    homeTeam: {
      id: fixture.teams?.home?.id,
      name: fixture.teams?.home?.name ?? "Home",
      shortName: fixture.teams?.home?.name,
      crest: fixture.teams?.home?.logo
    },
    awayTeam: {
      id: fixture.teams?.away?.id,
      name: fixture.teams?.away?.name ?? "Away",
      shortName: fixture.teams?.away?.name,
      crest: fixture.teams?.away?.logo
    },
    fullTime: {
      home: fixture.goals?.home ?? null,
      away: fixture.goals?.away ?? null
    },
    halfTime: {
      home: fixture.score?.halftime?.home ?? null,
      away: fixture.score?.halftime?.away ?? null
    },
    winner: fixture.teams?.home?.winner ? "HOME_TEAM" : fixture.teams?.away?.winner ? "AWAY_TEAM" : undefined,
    sourceUpdatedAt: fixture.fixture?.date ?? undefined,
    raw: fixture
  };
};

const normalizeStatValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return "-";
  }

  return typeof value === "string" || typeof value === "number" ? value : String(value);
};

const normalizeIncident = (event: any): MatchIncident => ({
  minute: event.time?.elapsed ?? 0,
  type: event.type === "Goal" ? "goal" : event.type === "subst" ? "substitution" : event.type === "Card" ? "card" : "info",
  team: event.team?.id === event.fixture?.teams?.home?.id ? "home" : "away",
  player: event.player?.name ?? event.assist?.name ?? "Unknown player",
  detail: event.detail ?? event.comments ?? event.type ?? "Event"
});

export class ApiFootballProvider implements FootballProvider {
  async getCompetitions() {
    return COMPETITIONS.map(({ apiLeagueId: _apiLeagueId, type: _type, seasonMode: _seasonMode, ...competition }) => competition);
  }

  async getMatchesByDate(dateFrom: string, dateTo: string, competitionCodes: string[]) {
    const allowedIds = new Set(
      competitionCodes
        .map((code) => byCode.get(code))
        .filter((competition): competition is CompetitionMapItem => Boolean(competition))
        .map((competition) => competition.apiLeagueId)
    );
    const dates = Array.from(new Set([dateFrom, dateTo]));
    const responses = await Promise.all(
      dates.map(async (date) => {
        const payload = await apiRequest<any[]>("/fixtures", {
          date,
          timezone: "Asia/Dhaka"
        });

        return payload.response
          .filter((fixture) => allowedIds.has(fixture.league?.id))
          .map((fixture) => normalizeFixture(fixture));
      })
    );

    const uniqueMatches = new Map<string, NormalizedMatch>();
    for (const match of responses.flat()) {
      uniqueMatches.set(match.providerMatchId, match);
    }

    return Array.from(uniqueMatches.values()).sort((left, right) => new Date(left.utcDate).getTime() - new Date(right.utcDate).getTime());
  }

  async getLiveMatches(competitionCodes: string[]) {
    const payload = await apiRequest<any[]>("/fixtures", {
      live: "all",
      timezone: "Asia/Dhaka"
    });

    const allowedIds = new Set(
      competitionCodes
        .map((code) => byCode.get(code))
        .filter((competition): competition is CompetitionMapItem => Boolean(competition))
        .map((competition) => competition.apiLeagueId)
    );

    return payload.response
      .filter((fixture) => allowedIds.has(fixture.league?.id))
      .map((fixture) => normalizeFixture(fixture))
      .sort((left, right) => new Date(left.utcDate).getTime() - new Date(right.utcDate).getTime());
  }

  async getStandings(competitionCode: string): Promise<StandingsPayload> {
    const competition = byCode.get(competitionCode);

    if (!competition) {
      throw new Error(`Unsupported competition code for standings: ${competitionCode}`);
    }

    const payload = await apiRequest<any[]>("/standings", {
      league: competition.apiLeagueId,
      season: new Date().getUTCMonth() >= 6 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1
    });

    const table = payload.response?.[0]?.league?.standings?.[0] ?? [];

    return {
      competitionCode,
      competitionName: competition.name,
      season: String(payload.response?.[0]?.league?.season ?? "Current season"),
      standings: table.map((row: any) => ({
        position: row.rank,
        teamName: row.team?.name ?? "Unknown",
        crest: row.team?.logo,
        playedGames: row.all?.played ?? 0,
        goalDifference: row.goalsDiff ?? 0,
        points: row.points ?? 0,
        won: row.all?.win ?? 0,
        draw: row.all?.draw ?? 0,
        lost: row.all?.lose ?? 0
      }))
    };
  }

  async getMatchDetails(matchId: string): Promise<MatchDetailPayload | null> {
    const [fixturePayload, statsPayload, eventsPayload] = await Promise.all([
      apiRequest<any[]>("/fixtures", { id: matchId, timezone: "Asia/Dhaka" }),
      apiRequest<any[]>("/fixtures/statistics", { fixture: matchId }),
      apiRequest<any[]>("/fixtures/events", { fixture: matchId })
    ]);

    const fixture = fixturePayload.response?.[0];

    if (!fixture) {
      return null;
    }

    const normalized = normalizeFixture(fixture);
    const homeStats = statsPayload.response?.find((item) => item.team?.id === fixture.teams?.home?.id);
    const awayStats = statsPayload.response?.find((item) => item.team?.id === fixture.teams?.away?.id);
    const statsMap = new Map<string, MatchStat>();

    for (const stat of homeStats?.statistics ?? []) {
      statsMap.set(stat.type, {
        label: stat.type,
        home: normalizeStatValue(stat.value),
        away: "-"
      });
    }

    for (const stat of awayStats?.statistics ?? []) {
      const existing = statsMap.get(stat.type);
      statsMap.set(stat.type, {
        label: stat.type,
        home: existing?.home ?? "-",
        away: normalizeStatValue(stat.value)
      });
    }

    const incidents = (eventsPayload.response ?? []).map((event) => ({
      minute: event.time?.elapsed ?? 0,
      type: event.type === "Goal" ? "goal" : event.type === "subst" ? "substitution" : event.type === "Card" ? "card" : "info",
      team: event.team?.id === fixture.teams?.home?.id ? "home" : "away",
      player: event.player?.name ?? "Unknown player",
      detail: event.detail ?? event.comments ?? event.type ?? "Event"
    })) as MatchIncident[];

    return {
      providerMatchId: normalized.providerMatchId,
      competitionCode: normalized.competitionCode,
      competitionName: normalized.competitionName,
      areaName: normalized.areaName,
      venue: normalized.venue,
      stage: normalized.stage,
      status: normalized.status,
      minute: normalized.minute,
      utcDate: normalized.utcDate,
      homeTeam: normalized.homeTeam,
      awayTeam: normalized.awayTeam,
      score: {
        home: normalized.fullTime.home,
        away: normalized.fullTime.away,
        halfTimeHome: normalized.halfTime.home,
        halfTimeAway: normalized.halfTime.away
      },
      summary: `${normalized.homeTeam.name} vs ${normalized.awayTeam.name} in ${normalized.competitionName}.`,
      stats: Array.from(statsMap.values()),
      incidents
    };
  }
}
