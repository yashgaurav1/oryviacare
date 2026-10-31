import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const DATA_DIR = join(REPO_ROOT, "data", "source");

export function writeJson(rel: string, data: unknown) {
  const f = join(DATA_DIR, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(data, null, 2) + "\n");
}

export function writeJsonl(rel: string, rows: unknown[]) {
  const f = join(DATA_DIR, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Defend against CSV formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeCsv(rel: string, header: string[], rows: unknown[][]) {
  const f = join(DATA_DIR, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n");
}
