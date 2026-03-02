import type { DashboardPayload, MatchDetail } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api/v1";

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? fallback;
  } catch {
    return fallback;
  }
};

export const getDashboard = async (date: string, competition?: string) => {
  const url = new URL(`${API_BASE_URL}/dashboard`);
  url.searchParams.set("date", date);

  if (competition) {
    url.searchParams.set("competition", competition);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to load dashboard data"));
  }

  return response.json() as Promise<DashboardPayload>;
};

export const getMatchDetails = async (matchId: string) => {
  const response = await fetch(`${API_BASE_URL}/matches/${matchId}`);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to load match details"));
  }

  return response.json() as Promise<MatchDetail>;
};

export const getStandings = async (competitionCode: string) => {
  const response = await fetch(`${API_BASE_URL}/standings/${competitionCode}`);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to load standings"));
  }

  return response.json() as Promise<DashboardPayload["standings"]>;
};
