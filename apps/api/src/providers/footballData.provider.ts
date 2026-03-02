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

const resolveTeamSide = (entry: any, match: any): "home" | "away" => {
  const teamId = entry?.team?.id ?? entry?.team?.teamId ?? entry?.team?.team?.id;

  if (teamId && teamId === match.homeTeam?.id) {
    return "home";
  }

  if (teamId && teamId === match.awayTeam?.id) {
    return "away";
  }

  const teamName = String(
    entry?.team?.name ??
      entry?.team?.shortName ??
      entry?.team?.tla ??
      entry?.team?.team?.name ??
      ""
  ).toLowerCase();

  if (teamName) {
    const homeNames = [match.homeTeam?.name, match.homeTeam?.shortName, match.homeTeam?.tla]
      .filter(Boolean)
      .map((value: string) => value.toLowerCase());
    const awayNames = [match.awayTeam?.name, match.awayTeam?.shortName, match.awayTeam?.tla]
      .filter(Boolean)
      .map((value: string) => value.toLowerCase());

    if (homeNames.includes(teamName)) {
      return "home";
    }

    if (awayNames.includes(teamName)) {
      return "away";
    }
  }

  return "home";
};

const buildIncidents = (match: any): MatchIncident[] => {
  const goals = (match.goals ?? []).map((goal: any) => ({
    minute: goal.minute ?? 0,
    type: "goal" as const,
    team: resolveTeamSide(goal, match),
    player: goal.scorer?.name ?? goal.person?.name ?? goal.player?.name ?? "Goal",
    detail: goal.assist?.name ? `Assist: ${goal.assist.name}` : goal.type ?? "Goal"
  }));

  const cards = (match.bookings ?? []).map((booking: any) => ({
    minute: booking.minute ?? 0,
    type: "card" as const,
    team: resolveTeamSide(booking, match),
    player: booking.player?.name ?? "Booking",
    detail: booking.card ?? booking.type ?? "Card"
  }));

  const substitutions = (match.substitutions ?? []).flatMap((change: any) => {
    const minute = change.minute ?? 0;
    const team = resolveTeamSide(change, match);
    const inPlayer = change.playerIn?.name ?? change.replacement?.name;
    const outPlayer = change.playerOut?.name ?? change.replaced?.name;
    const rows: MatchIncident[] = [];

    if (inPlayer) {
      rows.push({
        minute,
        type: "substitution",
        team,
        player: inPlayer,
        detail: outPlayer ? `Substitution in for ${outPlayer}` : "Substitution in"
      });
    }

    if (!inPlayer && outPlayer) {
      rows.push({
        minute,
        type: "substitution",
        team,
        player: outPlayer,
        detail: "Substitution out"
      });
    }

    return rows;
  });

  return [...goals, ...cards, ...substitutions].sort((left, right) => left.minute - right.minute);
};

const normalizeStatValue = (value: unknown): string | number => {
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "object" && "value" in (value as Record<string, unknown>)) {
    return normalizeStatValue((value as Record<string, unknown>).value);
  }

  return String(value);
};

const buildStats = (match: any): MatchStat[] => {
  const statistics = match.statistics;

  if (!statistics) {
    return [];
  }

  if (Array.isArray(statistics)) {
    if (statistics.length === 2 && Array.isArray(statistics[0]?.statistics) && Array.isArray(statistics[1]?.statistics)) {
      const homeStats = new Map(
        statistics[0].statistics.map((entry: any) => [entry.type ?? entry.name ?? entry.label, entry.value ?? "-"])
      );
      const awayStats = new Map(
        statistics[1].statistics.map((entry: any) => [entry.type ?? entry.name ?? entry.label, entry.value ?? "-"])
      );
      const labels = Array.from(new Set([...homeStats.keys(), ...awayStats.keys()]))
        .filter(Boolean)
        .map((label) => String(label));

      return labels.map((label) => ({
        label,
        home: normalizeStatValue(homeStats.get(label)),
        away: normalizeStatValue(awayStats.get(label))
      }));
    }

    return statistics
      .map((entry: any) => ({
        label: String(entry.type ?? entry.name ?? entry.label ?? ""),
        home: normalizeStatValue(entry.home ?? entry.homeTeam ?? entry.value?.home ?? "-"),
        away: normalizeStatValue(entry.away ?? entry.awayTeam ?? entry.value?.away ?? "-")
      }))
      .filter((entry: MatchStat) => Boolean(entry.label));
  }

  if (typeof statistics === "object") {
    return Object.entries(statistics).map(([label, value]) => ({
      label,
      home: normalizeStatValue((value as any)?.home ?? "-"),
      away: normalizeStatValue((value as any)?.away ?? "-")
    }));
  }

  return [];
};

const buildSummary = (match: any, incidents: MatchIncident[], stats: MatchStat[]) => {
  const goalCount = incidents.filter((incident) => incident.type === "goal").length;
  const cardCount = incidents.filter((incident) => incident.type === "card").length;
  const substitutionCount = incidents.filter((incident) => incident.type === "substitution").length;

  const parts = [
    goalCount > 0 ? `${goalCount} goal${goalCount === 1 ? "" : "s"}` : null,
    cardCount > 0 ? `${cardCount} card${cardCount === 1 ? "" : "s"}` : null,
    substitutionCount > 0 ? `${substitutionCount} substitution${substitutionCount === 1 ? "" : "s"}` : null,
    stats.length > 0 ? `${stats.length} tracked stat${stats.length === 1 ? "" : "s"}` : null
  ].filter(Boolean);

  if (parts.length > 0) {
    return `Match feed includes ${parts.join(", ")}.`;
  }

  return match.status === "SCHEDULED"
    ? "Match is scheduled. Detailed events will appear when the provider publishes them."
    : "Provider returned the match, but no detailed event feed is available for this fixture yet.";
};

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
    const match = payload.match ?? payload;

    if (!match) {
      return null;
    }

    const incidents = buildIncidents(match);
    const stats = buildStats(match);

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
      summary: buildSummary(match, incidents, stats),
      stats:
        stats.length > 0
          ? stats
          : [
              { label: "Status", home: match.status ?? "-", away: match.minute ?? "-" },
              { label: "Half-time", home: match.score?.halfTime?.home ?? "-", away: match.score?.halfTime?.away ?? "-" }
            ],
      incidents
    };
  }
}
