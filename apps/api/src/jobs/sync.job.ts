import cron from "node-cron";

import { getCompetitionCatalog, getLiveMatches } from "../services/scores.service.js";

export const registerSyncJob = () => {
  cron.schedule("*/2 * * * *", async () => {
    try {
      const competitions = await getCompetitionCatalog();
      await getLiveMatches(competitions.map((competition) => competition.code));
    } catch (error) {
      console.error("sync job failed", error);
    }
  });
};
