// The API server itself. Started through main.ts, which checks the environment first.
import { createApp } from "./app.js";
import { prisma } from "./core/db.js";
import { env } from "./core/env.js";
import { runJobsOnce } from "./jobs.js";

const app = await createApp();
app.enableShutdownHooks();
// Hosts (Render, Fly, Railway) inject PORT and need every interface; locally we stay on loopback.
const port = Number(process.env.PORT ?? env.API_PORT);
const host = process.env.PORT ? "0.0.0.0" : "127.0.0.1";
await app.listen(port, host);
console.log(`Oryvia API listening on http://${host}:${port}/api (docs: /api/docs)`);

// Hosting plans without background workers can run the job loop inside the API process.
// The separate `npm run worker` process remains the default everywhere else; never run both.
if (process.env.RUN_WORKER_IN_PROCESS === "true") {
  const interval = Number(process.env.WORKER_INTERVAL_MS ?? 5000);
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const r = await runJobsOnce(prisma);
      if (r.outbox.claimed || r.expiry.cancelled) console.log(new Date().toISOString(), "jobs", JSON.stringify(r));
    } catch (e) {
      console.error("in-process worker tick failed", e);
    } finally {
      running = false;
    }
  }, interval);
  process.on("SIGTERM", () => clearInterval(timer));
  console.log(`in-process worker started (interval ${interval}ms)`);
}
