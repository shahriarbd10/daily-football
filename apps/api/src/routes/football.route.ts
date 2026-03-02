import { Router } from "express";

import {
  getCompetitionCatalog,
  getDashboardPayload,
  getLiveMatches,
  getMatchDetails,
  getStandings
} from "../services/scores.service.js";

export const footballRouter = Router();

footballRouter.get("/dashboard", async (request, response, next) => {
  try {
    const payload = await getDashboardPayload(
      typeof request.query.date === "string" ? request.query.date : undefined,
      typeof request.query.competition === "string" ? request.query.competition : undefined
    );

    response.json(payload);
  } catch (error) {
    next(error);
  }
});

footballRouter.get("/competitions", async (_request, response, next) => {
  try {
    response.json(await getCompetitionCatalog());
  } catch (error) {
    next(error);
  }
});

footballRouter.get("/live", async (_request, response, next) => {
  try {
    const competitions = await getCompetitionCatalog();
    response.json(await getLiveMatches(competitions.map((competition) => competition.code)));
  } catch (error) {
    next(error);
  }
});

footballRouter.get("/standings/:code", async (request, response, next) => {
  try {
    response.json(await getStandings(request.params.code));
  } catch (error) {
    next(error);
  }
});

footballRouter.get("/matches/:id", async (request, response, next) => {
  try {
    const match = await getMatchDetails(request.params.id);

    if (!match) {
      response.status(404).json({ message: "Match not found" });
      return;
    }

    response.json(match);
  } catch (error) {
    next(error);
  }
});
