import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { footballRouter } from "./routes/football.route.js";
import { healthRouter } from "./routes/health.route.js";

export const app = express();

app.use(
  cors({
    origin: env.clientOrigin
  })
);
app.use(express.json());

app.get("/", (_request, response) => {
  response.json({
    name: "Football Freak API",
    status: "ready"
  });
});

app.use("/api/v1/health", healthRouter);
app.use("/api/v1", footballRouter);

app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({
    message: error.message || "Internal server error"
  });
});
