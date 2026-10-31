// Integration tests run against the real PostgreSQL test database (TEST_DATABASE_URL), never the dev database.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const line of readFileSync(resolve(import.meta.dirname, "../../../.env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required for integration tests");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = "test";
process.env.ALLOW_DEV_MANUAL_PAYMENT = "true";
