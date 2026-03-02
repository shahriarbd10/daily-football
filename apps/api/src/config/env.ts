import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });
dotenv.config();

const required = (value: string | undefined, key: string) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const env = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  mongoUri: required(process.env.MONGODB_URI, "MONGODB_URI"),
  mongoDbName: process.env.MONGODB_DB_NAME ?? "football_freak",
  provider: process.env.FOOTBALL_PROVIDER ?? (process.env.API_FOOTBALL_API_KEY ? "api-football" : "mock"),
  apiFootballApiKey: process.env.API_FOOTBALL_API_KEY,
  apiFootballBaseUrl: process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io",
  footballDataApiKey: process.env.FOOTBALL_DATA_API_KEY,
  footballDataBaseUrl: process.env.FOOTBALL_DATA_BASE_URL ?? "https://api.football-data.org/v4",
  cacheTtlSeconds: Number(process.env.MATCH_CACHE_TTL_SECONDS ?? 90),
  bdTimezone: process.env.BD_TIMEZONE ?? "Asia/Dhaka"
};

if (env.provider === "api-football" && !env.apiFootballApiKey) {
  throw new Error("Missing required environment variable: API_FOOTBALL_API_KEY");
}

if (env.provider === "football-data" && !env.footballDataApiKey) {
  throw new Error("Missing required environment variable: FOOTBALL_DATA_API_KEY");
}
