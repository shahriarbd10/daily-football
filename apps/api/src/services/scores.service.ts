import { isDatabaseReady } from "../config/db.js";
import { env } from "../config/env.js";
import { formatDhakaTime, getDhakaUtcRange, getProviderDateWindow, todayInDhaka } from "../lib/time.js";
import { CompetitionCacheModel } from "../models/competition-cache.model.js";
import { MatchCacheModel } from "../models/match-cache.model.js";
import { createProvider } from "../providers/index.js";
import type { CompetitionDefinition, MatchDetailPayload, NormalizedMatch } from "../providers/types.js";

const provider = createProvider();
const memoryCompetitionCache = new Map<string, CompetitionDefinition & { lastFetchedAt: Date }>();
const currentProvider = env.provider;
const standingsCache = new Map<string, { fetchedAt: Date; payload: any }>();
const standingsCacheTtlMs = Math.max(env.cacheTtlSeconds * 1000, 15 * 60 * 1000);
type CachedMemoryMatch = Omit<NormalizedMatch, "utcDate" | "sourceUpdatedAt"> & {
  utcDate: Date;
  sourceUpdatedAt?: Date;
  lastFetchedAt: Date;
  sourceProvider: string;
};
const memoryMatchCache = new Map<string, CachedMemoryMatch>();

const isFresh = (lastFetchedAt: Date) => Date.now() - lastFetchedAt.getTime() < env.cacheTtlSeconds * 1000;

const upsertCompetitions = async (competitions: CompetitionDefinition[]) => {
  if (!isDatabaseReady()) {
    competitions.forEach((competition) => {
      memoryCompetitionCache.set(competition.code, { ...competition, lastFetchedAt: new Date() });
    });
    return;
  }

  await Promise.all(
    competitions.map((competition) =>
      CompetitionCacheModel.findOneAndUpdate(
        { code: competition.code },
        { ...competition, lastFetchedAt: new Date() },
        { new: true, upsert: true }
      )
    )
  );
};

const upsertMatches = async (matches: NormalizedMatch[]) => {
  if (!isDatabaseReady()) {
    matches.forEach((match) => {
      memoryMatchCache.set(`${currentProvider}:${match.providerMatchId}`, {
        ...match,
        sourceProvider: currentProvider,
        utcDate: new Date(match.utcDate),
        sourceUpdatedAt: match.sourceUpdatedAt ? new Date(match.sourceUpdatedAt) : undefined,
        lastFetchedAt: new Date()
      });
    });
    return;
  }

  await Promise.all(
    matches.map((match) =>
      MatchCacheModel.findOneAndUpdate(
        { sourceProvider: currentProvider, providerMatchId: match.providerMatchId },
        {
          ...match,
          sourceProvider: currentProvider,
          utcDate: new Date(match.utcDate),
          sourceUpdatedAt: match.sourceUpdatedAt ? new Date(match.sourceUpdatedAt) : undefined,
          lastFetchedAt: new Date()
        },
        { new: true, upsert: true }
      )
    )
  );
};

export const getCompetitionCatalog = async () => {
  const competitions = await provider.getCompetitions();
  await upsertCompetitions(competitions);

  return competitions.sort((a, b) => a.priority - b.priority);
};

export const getMatchesForDate = async (date: string, competitionCodes: string[]) => {
  const { start, end } = getDhakaUtcRange(date);

  const cached = isDatabaseReady()
    ? await MatchCacheModel.find({
        sourceProvider: currentProvider,
        competitionCode: { $in: competitionCodes },
        utcDate: { $gte: start, $lte: end }
      })
        .sort({ utcDate: 1 })
        .lean()
    : Array.from(memoryMatchCache.values())
        .filter(
          (match) =>
            match.sourceProvider === currentProvider &&
            competitionCodes.includes(match.competitionCode) &&
            match.utcDate >= start &&
            match.utcDate <= end
        )
        .sort((left, right) => left.utcDate.getTime() - right.utcDate.getTime());

  if (cached.length > 0 && cached.every((match) => isFresh(match.lastFetchedAt))) {
    return cached;
  }

  const { dateFrom, dateTo } = getProviderDateWindow(date);
  const fresh = await provider.getMatchesByDate(dateFrom, dateTo, competitionCodes);
  await upsertMatches(fresh);

  const synced = isDatabaseReady()
    ? await MatchCacheModel.find({
        sourceProvider: currentProvider,
        competitionCode: { $in: competitionCodes },
        utcDate: { $gte: start, $lte: end }
      })
        .sort({ utcDate: 1 })
        .lean()
    : Array.from(memoryMatchCache.values())
        .filter(
          (match) =>
            match.sourceProvider === currentProvider &&
            competitionCodes.includes(match.competitionCode) &&
            match.utcDate >= start &&
            match.utcDate <= end
        )
        .sort((left, right) => left.utcDate.getTime() - right.utcDate.getTime());

  return synced;
};

export const getLiveMatches = async (competitionCodes: string[]) => {
  const live = await provider.getLiveMatches(competitionCodes);
  await upsertMatches(live);

  return isDatabaseReady()
    ? MatchCacheModel.find({
        sourceProvider: currentProvider,
        competitionCode: { $in: competitionCodes },
        status: { $in: ["LIVE", "IN_PLAY", "PAUSED"] }
      })
        .sort({ utcDate: 1 })
        .lean()
    : Array.from(memoryMatchCache.values())
        .filter(
          (match) =>
            match.sourceProvider === currentProvider &&
            competitionCodes.includes(match.competitionCode) &&
            ["LIVE", "IN_PLAY", "PAUSED"].includes(match.status)
        )
        .sort((left, right) => left.utcDate.getTime() - right.utcDate.getTime());
};

export const getStandings = async (competitionCode: string) => {
  const cached = standingsCache.get(`${currentProvider}:${competitionCode}`);

  if (cached && Date.now() - cached.fetchedAt.getTime() < standingsCacheTtlMs) {
    return cached.payload;
  }

  const payload = await provider.getStandings(competitionCode);
  standingsCache.set(`${currentProvider}:${competitionCode}`, { fetchedAt: new Date(), payload });
  return payload;
};

const buildDetailFromCachedMatch = (match: NormalizedMatch | CachedMemoryMatch): MatchDetailPayload => ({
  providerMatchId: match.providerMatchId,
  competitionCode: match.competitionCode,
  competitionName: match.competitionName,
  areaName: match.areaName,
  venue: match.venue,
  stage: match.stage,
  status: match.status,
  minute: match.minute,
  utcDate: match.utcDate instanceof Date ? match.utcDate.toISOString() : match.utcDate,
  homeTeam: match.homeTeam,
  awayTeam: match.awayTeam,
  score: {
    home: match.fullTime.home,
    away: match.fullTime.away,
    halfTimeHome: match.halfTime.home,
    halfTimeAway: match.halfTime.away
  },
  summary: "Detailed statistics are limited for this provider response.",
  stats: [
    { label: "Status", home: match.status, away: match.minute ?? "-" },
    { label: "Half-time", home: match.halfTime.home ?? "-", away: match.halfTime.away ?? "-" }
  ],
  incidents: []
});

export const getMatchDetails = async (matchId: string) => {
  const providerDetail = await provider.getMatchDetails(matchId);

  if (providerDetail) {
    return providerDetail;
  }

  if (isDatabaseReady()) {
    const match = await MatchCacheModel.findOne({ sourceProvider: currentProvider, providerMatchId: matchId }).lean();
    return match ? buildDetailFromCachedMatch(match as unknown as NormalizedMatch) : null;
  }

  const match = memoryMatchCache.get(`${currentProvider}:${matchId}`);
  return match ? buildDetailFromCachedMatch(match) : null;
};

export const getDashboardPayload = async (requestedDate?: string, selectedCompetition?: string) => {
  const competitions = await getCompetitionCatalog();
  const date = requestedDate ?? todayInDhaka();
  const competitionCodes = competitions.map((competition) => competition.code);
  const matches = await getMatchesForDate(date, competitionCodes);
  const liveMatches = matches.filter((match) => ["LIVE", "IN_PLAY", "PAUSED"].includes(match.status));
  const featuredCompetition = selectedCompetition ?? competitions[0]?.code ?? "PL";
  const standings = await getStandings(featuredCompetition);

  return {
    meta: {
      appName: "Football Freak",
      timezone: env.bdTimezone,
      date,
      lastUpdatedLabel: formatDhakaTime(new Date())
    },
    competitions,
    liveMatches,
    matches,
    standings
  };
};
