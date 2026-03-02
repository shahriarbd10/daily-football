export type Competition = {
  code: string;
  name: string;
  country: string;
  priority: number;
  isInternational?: boolean;
};

export type Match = {
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
    name: string;
    shortName?: string;
    crest?: string;
  };
  awayTeam: {
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
};

export type MatchDetail = {
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
  stats: Array<{
    label: string;
    home: string | number;
    away: string | number;
  }>;
  incidents: Array<{
    minute: number;
    type: "goal" | "card" | "substitution" | "info";
    team: "home" | "away";
    player: string;
    detail: string;
  }>;
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

export type DashboardPayload = {
  meta: {
    appName: string;
    timezone: string;
    date: string;
    lastUpdatedLabel: string;
  };
  competitions: Competition[];
  liveMatches: Match[];
  matches: Match[];
  standings: {
    competitionCode: string;
    competitionName: string;
    season: string;
    standings: StandingRow[];
  };
};
