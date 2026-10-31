// Resumable public-site crawl. Writes raw snapshots plus a URL coverage ledger.
// Usage: npm run source:crawl [-- --resume] [-- --max=400]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { politeFetch, sha256, SOURCE_ORIGIN } from "./http.js";
import { classify, normalizeUrl, type PageType } from "./urls.js";
import { extractPage, type PageExtract } from "./extract.js";
import { DATA_DIR, writeJson, writeJsonl } from "./paths.js";

const args = new Set(process.argv.slice(2));
const RESUME = args.has("--resume");
const MAX = Number([...args].find((a) => a.startsWith("--max="))?.split("=")[1] ?? 400);

const RAW_DIR = join(DATA_DIR, "raw");
mkdirSync(join(RAW_DIR, "pages"), { recursive: true });
mkdirSync(join(RAW_DIR, "api"), { recursive: true });

interface LedgerRow {
  canonical_url: string;
  discovered_from: string | null;
  page_type: PageType;
  sitemap_kind: string | null;
  http_status: number | null;
  extraction_status: "parsed" | "fetched" | "excluded" | "failed" | "duplicate" | "unresolved";
  retry_count: number;
  fetched_at: string | null;
  content_hash: string | null;
  final_url: string | null;
  declared_canonical: string | null;
  exception_reason: string | null;
}

const ledger = new Map<string, LedgerRow>();
const queue: string[] = [];
const sitemapKind = new Map<string, string>();
const extracts: Record<string, PageExtract & { url: string; page_type: PageType; sitemap_kind: string | null }> = {};

function enqueue(raw: string, from: string | null) {
  const url = normalizeUrl(raw, from ?? SOURCE_ORIGIN);
  if (!url) return;
  if (ledger.has(url)) return;
  const c = classify(url);
  if (new URL(url).hostname !== "oryviacare.in") return; // off-domain links are not part of the ledger
  ledger.set(url, {
    canonical_url: url,
    discovered_from: from,
    page_type: c.type,
    sitemap_kind: sitemapKind.get(url) ?? null,
    http_status: null,
    extraction_status: c.type === "excluded" ? "excluded" : "unresolved",
    retry_count: 0,
    fetched_at: null,
    content_hash: null,
    final_url: null,
    declared_canonical: null,
    exception_reason: c.excludedReason ?? null,
  });
  if (c.type !== "excluded") queue.push(url);
}

async function fetchCached(url: string, dir: "pages" | "api", ext: string) {
  const file = join(RAW_DIR, dir, `${sha256(url).slice(0, 24)}.${ext}`);
  const meta = `${file}.meta.json`;
  if (RESUME && existsSync(file) && existsSync(meta)) {
    const m = JSON.parse(readFileSync(meta, "utf8"));
    return { ...m, body: readFileSync(file), cached: true, file };
  }
  const r = await politeFetch(url);
  writeFileSync(file, r.body);
  const { body, ...rest } = r;
  writeFileSync(meta, JSON.stringify(rest, null, 2));
  return { ...r, cached: false, file };
}

async function discoverSitemaps() {
  const robots = await fetchCached(`${SOURCE_ORIGIN}/robots.txt`, "pages", "txt");
  const sitemaps = robots.body
    .toString("utf8")
    .split("\n")
    .filter((l: string) => /^sitemap:/i.test(l))
    .map((l: string) => l.split(/:\s*/).slice(1).join(":").trim());
  ledger.set(`${SOURCE_ORIGIN}/robots.txt`, {
    canonical_url: `${SOURCE_ORIGIN}/robots.txt`, discovered_from: null, page_type: "robots", sitemap_kind: null,
    http_status: robots.status, extraction_status: "parsed", retry_count: robots.retries ?? 0, fetched_at: robots.fetchedAt,
    content_hash: sha256(robots.body), final_url: robots.finalUrl, declared_canonical: null, exception_reason: null,
  });
  const pending = [...sitemaps];
  while (pending.length) {
    const sm = pending.shift()!;
    const r = await fetchCached(sm, "pages", "xml");
    const $ = cheerio.load(r.body.toString("utf8"), { xml: true });
    const kind = sm.match(/wp-sitemap-(?:posts|taxonomies|users)-([a-z_]+)-\d+\.xml/)?.[1] ?? "index";
    ledger.set(sm, {
      canonical_url: sm, discovered_from: "robots.txt", page_type: "sitemap", sitemap_kind: kind, http_status: r.status,
      extraction_status: "parsed", retry_count: r.retries ?? 0, fetched_at: r.fetchedAt, content_hash: sha256(r.body),
      final_url: r.finalUrl, declared_canonical: null, exception_reason: null,
    });
    $("sitemap > loc").each((_, el) => { pending.push($(el).text().trim()); });
    $("url > loc").each((_, el) => {
      const u = normalizeUrl($(el).text().trim());
      if (!u) return;
      sitemapKind.set(u, kind);
      if (kind === "users") {
        ledger.set(u, {
          canonical_url: u, discovered_from: sm, page_type: "excluded", sitemap_kind: kind, http_status: null,
          extraction_status: "excluded", retry_count: 0, fetched_at: null, content_hash: null, final_url: null,
          declared_canonical: null, exception_reason: "author archive (personal data minimisation)",
        });
        return;
      }
      enqueue(u, sm);
    });
  }
}

async function crawlPages() {
  let fetched = 0;
  while (queue.length && fetched < MAX) {
    const url = queue.shift()!;
    const row = ledger.get(url)!;
    row.sitemap_kind = sitemapKind.get(url) ?? row.sitemap_kind;
    try {
      const r = await fetchCached(url, "pages", "html");
      fetched++;
      row.http_status = r.status;
      row.retry_count = r.retries ?? 0;
      row.fetched_at = r.fetchedAt;
      row.final_url = r.finalUrl;
      const html = r.body.toString("utf8");
      row.content_hash = sha256(r.body);
      if (r.status !== 200 || !/html/.test(r.contentType)) {
        row.extraction_status = r.status === 200 ? "fetched" : "failed";
        row.exception_reason = `status ${r.status} ${r.contentType}`;
        continue;
      }
      const ex = extractPage(html, url);
      row.declared_canonical = ex.canonical;
      const declared = ex.canonical ? normalizeUrl(ex.canonical) : null;
      if (declared && declared !== url && ledger.get(declared)?.content_hash === row.content_hash) {
        row.extraction_status = "duplicate";
        row.exception_reason = `duplicate of ${declared}`;
        continue;
      }
      row.extraction_status = "parsed";
      extracts[url] = { ...ex, url, page_type: row.page_type, sitemap_kind: row.sitemap_kind };
      for (const l of ex.links) enqueue(l, url);
      process.stdout.write(`${r.cached ? "·" : "↓"} ${row.page_type.padEnd(16)} ${url}\n`);
    } catch (err) {
      row.extraction_status = "failed";
      row.exception_reason = String((err as Error).message ?? err);
      process.stdout.write(`✗ ${url} ${row.exception_reason}\n`);
    }
  }
  for (const u of queue) {
    const row = ledger.get(u)!;
    row.exception_reason = `not fetched: page budget ${MAX} reached`;
  }
}

/** WooCommerce Store API and WP REST are legitimately public on this site; captured as separate evidence. */
async function crawlApis() {
  const out: Record<string, unknown> = {};
  const get = async (path: string) => {
    const url = `${SOURCE_ORIGIN}${path}`;
    const r = await fetchCached(url, "api", "json");
    ledger.set(url, {
      canonical_url: url, discovered_from: "public REST API", page_type: "api", sitemap_kind: null, http_status: r.status,
      extraction_status: r.status === 200 ? "parsed" : "failed", retry_count: r.retries ?? 0, fetched_at: r.fetchedAt,
      content_hash: sha256(r.body), final_url: r.finalUrl, declared_canonical: null,
      exception_reason: r.status === 200 ? null : `status ${r.status}`,
    });
    if (r.status !== 200) return null;
    return { data: JSON.parse(r.body.toString("utf8")), fetchedAt: r.fetchedAt as string, url };
  };
  const products: unknown[] = [];
  for (let page = 1; page < 20; page++) {
    const r = await get(`/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
    if (!r || !Array.isArray(r.data) || r.data.length === 0) break;
    products.push(...r.data.map((p: object) => ({ ...p, _source: { url: r.url, fetchedAt: r.fetchedAt } })));
    if (r.data.length < 100) break;
  }
  out.products = products;
  out.categories = (await get(`/wp-json/wc/store/v1/products/categories?per_page=100`))?.data ?? [];
  out.reviews = (await get(`/wp-json/wc/store/v1/products/reviews?per_page=100`))?.data ?? [];
  out.pages = (await get(`/wp-json/wp/v2/pages?per_page=100&_fields=id,slug,link,title,content,excerpt,modified,date,status`))?.data ?? [];
  out.posts = (await get(`/wp-json/wp/v2/posts?per_page=100&_fields=id,slug,link,title,content,excerpt,modified,date,status,categories`))?.data ?? [];
  return out;
}

async function main() {
  const started = new Date().toISOString();
  await discoverSitemaps();
  enqueue(`${SOURCE_ORIGIN}/`, null);
  await crawlPages();
  const api = await crawlApis();

  const rows = [...ledger.values()];
  writeJsonl("url-ledger.jsonl", rows);
  writeJson("raw/page-extracts.json", extracts);
  writeJson("raw/api-snapshot.json", api);
  const count = (s: string) => rows.filter((r) => r.extraction_status === s).length;
  const summary = {
    scope: "Public, unauthenticated pages of https://oryviacare.in reachable from robots.txt sitemaps and internal links, plus public WooCommerce Store API and WP REST endpoints. Excludes account/cart/checkout/auth routes, mutation URLs, faceted duplicates and author archives.",
    started_at: started,
    finished_at: new Date().toISOString(),
    page_budget: MAX,
    discovered: rows.length,
    fetched: rows.filter((r) => r.http_status !== null).length,
    parsed: count("parsed"),
    excluded: count("excluded"),
    failed: count("failed"),
    duplicate: count("duplicate"),
    unresolved: count("unresolved"),
    by_type: rows.reduce<Record<string, number>>((a, r) => ((a[r.page_type] = (a[r.page_type] ?? 0) + 1), a), {}),
    api_products: (api.products as unknown[]).length,
  };
  writeJson("crawl-summary.json", summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
