import { app } from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { registerSyncJob } from "./jobs/sync.job.js";

const start = async () => {
  await connectDatabase();
  registerSyncJob();

  const server = app.listen(env.port, () => {
    console.log(`Football Freak API running on http://localhost:${env.port}`);
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${env.port} is already in use. Stop the old server process or change PORT in .env.`);
      process.exit(1);
    }

    throw error;
  });
};

start().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
