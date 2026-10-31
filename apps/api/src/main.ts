// Entry point. Checks the environment before loading the server, so a misconfigured host prints a plain
// list of what is missing (names only, never values) instead of a bare "exit status 1".
console.log(`[startup] Node ${process.version}, NODE_ENV=${process.env.NODE_ENV ?? "(unset)"}`);

const REQUIRED = ["DATABASE_URL", "BETTER_AUTH_SECRET", "PUBLIC_ORIGIN"];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[startup] Missing required environment variables: ${missing.join(", ")}. Add them on the host and redeploy.`);
  process.exit(1);
}
if ((process.env.BETTER_AUTH_SECRET ?? "").length < 32) {
  console.error("[startup] BETTER_AUTH_SECRET must be at least 32 characters. Generate a new value on the host.");
  process.exit(1);
}
if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_MANUAL_PAYMENT === "true") {
  console.error("[startup] ALLOW_DEV_MANUAL_PAYMENT must be false in production.");
  process.exit(1);
}

try {
  await import("./server.js");
} catch (e) {
  console.error("[startup] API failed to start:", e instanceof Error ? (e.stack ?? e.message) : e);
  process.exit(1);
}
