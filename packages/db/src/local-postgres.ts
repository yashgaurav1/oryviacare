// Local development PostgreSQL without Docker: runs real PostgreSQL binaries from the
// `embedded-postgres` package. Data persists in .data/postgres. Not for production.
// Usage: npm run db:start   (keeps running; Ctrl+C stops the cluster cleanly)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = join(root, ".data", "postgres");
const port = Number(process.env.LOCAL_PG_PORT ?? 54329);
const password = process.env.LOCAL_PG_PASSWORD;
if (!password) {
  console.error("Set LOCAL_PG_PASSWORD in .env (see .env.example) before starting the local database.");
  process.exit(1);
}

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password,
  port,
  persistent: true,
  autoRehydrateSymlinks: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

const fresh = !existsSync(join(dataDir, "PG_VERSION"));
if (fresh) await pg.initialise();
await pg.start();
// Databases are always UTF-8 (₹ and Devanagari), independent of the Windows locale the cluster was made with.
const client = pg.getPgClient();
await client.connect();
for (const db of ["oryvia_app", "oryvia_app_test"]) {
  const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [db]);
  if (!rowCount) {
    await client.query(`CREATE DATABASE ${db} ENCODING UTF8 TEMPLATE template0 LC_COLLATE C LC_CTYPE C`);
    console.log(`created database ${db}`);
  }
}
await client.end();
console.log(`PostgreSQL ready on 127.0.0.1:${port} (data: ${dataDir})`);
console.log(`DATABASE_URL=postgresql://postgres:<LOCAL_PG_PASSWORD>@127.0.0.1:${port}/oryvia_app`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
