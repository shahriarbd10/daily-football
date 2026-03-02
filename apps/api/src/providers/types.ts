export type CompetitionDefinition = {
  code: string;
  name: string;
  country: string;
  priority: number;
  isInternational?: boolean;
  emblem?: string;
};

export type NormalizedMatch = {
  providerMatchId: string;
  competitionCode: string;
  competitionName: string;
  areaName: string;
  utcDate: string;
  status: string;
  minute?: number;
  venue?: string;
  stage?: string;
  homeTeam: {
    id?: number;
    name: string;
    shortName?: string;
    crest?: string;
  };
  awayTeam: {
    id?: number;
    name: string;
    shortName?: string;
    crest?: string;
  };
  fullTime: {
    home: number | null;
    away: number | null;
  };
  halfTime: {
    home: number | null;
    away: number | null;
  };
  winner?: string;
  sourceUpdatedAt?: string;
  raw: unknown;
};

export type StandingRow = {
  position: number;
  teamName: string;
  crest?: string;
  playedGames: number;
  goalDifference: number;
  points: number;
  won: number;
  draw: number;
  lost: number;
};

export type MatchIncident = {
  minute: number;
  type: "goal" | "card" | "substitution" | "info";
  team: "home" | "away";
  player: string;
  detail: string;
};

export type MatchStat = {
  label: string;
  home: number | string;
  away: number | string;
};

export type MatchDetailPayload = {
  providerMatchId: string;
  competitionCode: string;
  competitionName: string;
  areaName: string;
  venue?: string;
  stage?: string;
  status: string;
  minute?: number;
  utcDate: string;
  homeTeam: {
    name: string;
    shortName?: string;
    crest?: string;
  };
  awayTeam: {
    name: string;
    shortName?: string;
    crest?: string;
  };
  score: {
    home: number | null;
    away: number | null;
    halfTimeHome: number | null;
    halfTimeAway: number | null;
  };
  summary: string;
  stats: MatchStat[];
  incidents: MatchIncident[];
};

export type StandingsPayload = {
  competitionCode: string;
  competitionName: string;
  season: string;
  standings: StandingRow[];
};

export interface FootballProvider {
  getCompetitions(): Promise<CompetitionDefinition[]>;
  getMatchesByDate(dateFrom: string, dateTo: string, competitionCodes: string[]): Promise<NormalizedMatch[]>;
  getLiveMatches(competitionCodes: string[]): Promise<NormalizedMatch[]>;
  getStandings(competitionCode: string): Promise<StandingsPayload>;
  getMatchDetails(matchId: string): Promise<MatchDetailPayload | null>;
}
