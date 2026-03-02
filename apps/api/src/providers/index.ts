import { ApiFootballProvider } from "./apiFootball.provider.js";
import { env } from "../config/env.js";
import { FootballDataProvider } from "./footballData.provider.js";
import { MockProvider } from "./mock.provider.js";
import type { FootballProvider } from "./types.js";

export const createProvider = (): FootballProvider => {
  if (env.provider === "api-football") {
    return new ApiFootballProvider();
  }

  if (env.provider === "mock") {
    return new MockProvider();
  }

  if (env.provider === "football-data") {
    return new FootballDataProvider();
  }

  throw new Error(`Unsupported provider: ${env.provider}`);
};
