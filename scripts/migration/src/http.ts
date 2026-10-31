// Bounded, rate-limited fetcher for the public source site.
// Only approved hosts; rejects private/link-local targets and unsafe redirects (SSRF guard).
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const SOURCE_ORIGIN = "https://oryviacare.in";
export const APPROVED_HOSTS = new Set(["oryviacare.in", "www.oryviacare.in"]);
export const USER_AGENT = "OryviaProMigration/0.1 (+site-owner migration; contact via merchant)";

const MIN_INTERVAL_MS = 900;
let lastRequestAt = 0;

export function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const l = ip.toLowerCase();
    return l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l === "::" || l.startsWith("::ffff:127.") || l.startsWith("::ffff:10.") || l.startsWith("::ffff:192.168.");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export async function assertSafeUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`blocked protocol ${url.protocol}`);
  if (!APPROVED_HOSTS.has(url.hostname)) throw new Error(`host not approved: ${url.hostname}`);
  const addrs = await lookup(url.hostname, { all: true });
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new Error(`host resolves to private address: ${url.hostname}`);
  return url;
}

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: Buffer;
  retries: number;
  fetchedAt: string;
}

export async function politeFetch(raw: string, opts: { maxBytes?: number; accept?: string; maxRetries?: number } = {}): Promise<FetchResult> {
  const maxBytes = opts.maxBytes ?? 8 * 1024 * 1024;
  const maxRetries = opts.maxRetries ?? 3;
  let current = (await assertSafeUrl(raw)).toString();
  let retries = 0;
  for (let redirects = 0; ; ) {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        headers: { "user-agent": USER_AGENT, accept: opts.accept ?? "text/html,application/json;q=0.9,*/*;q=0.5" },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      if (retries++ < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** retries));
        continue;
      }
      throw err;
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (++redirects > 5) throw new Error("too many redirects");
      current = (await assertSafeUrl(new URL(res.headers.get("location")!, current).toString())).toString();
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && retries < maxRetries) {
      retries++;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** retries));
      continue;
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) throw new Error(`response too large: ${declared}`);
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > maxBytes) throw new Error(`response too large: ${body.length}`);
    return {
      url: raw,
      finalUrl: current,
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      body,
      retries,
      fetchedAt: new Date().toISOString(),
    };
  }
}
