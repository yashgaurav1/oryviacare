// Durable job worker process. Run alongside the API: `npm run dev:worker`.
import { prisma } from "./core/db.js";
import { runJobsOnce } from "./jobs.js";

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 5000);
let stopping = false;
process.on("SIGINT", () => (stopping = true));
process.on("SIGTERM", () => (stopping = true));
console.log(`worker started (interval ${INTERVAL_MS}ms)`);
while (!stopping) {
  try {
    const r = await runJobsOnce(prisma);
    if (r.outbox.claimed || r.expiry.cancelled) console.log(new Date().toISOString(), JSON.stringify(r));
  } catch (e) {
    console.error("worker tick failed", e);
  }
  await new Promise((r) => setTimeout(r, INTERVAL_MS));
}
await prisma.$disconnect();
