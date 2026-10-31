// Turns raw crawl evidence into normalized, provenance-carrying records.
// Nothing here is approved: every record starts as `observed` or `needs_review`.
// Usage: npm run normalize -w @oryvia/migration
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { DATA_DIR, writeCsv, writeJson, writeJsonl } from "./paths.js";
import type { PageExtract } from "./extract.js";

type ReviewState = "observed" | "needs_review" | "approved" | "published";

export interface Observation<T = unknown> {
  value: T;
  source_url: string;
  source_location: string;
  retrieved_at: string;
  method: "store_api" | "html_dom" | "json_ld" | "wp_rest" | "derived";
}

export interface Field<T = unknown> {
  value: T | null;
  review_state: ReviewState;
  observations: Observation<T>[];
  note?: string;
}

const api = JSON.parse(readFileSync(join(DATA_DIR, "raw/api-snapshot.json"), "utf8"));
const extracts: Record<string, PageExtract & { url: string; page_type: string }> = JSON.parse(
  readFileSync(join(DATA_DIR, "raw/page-extracts.json"), "utf8"),
);
const ledger = readFileSync(join(DATA_DIR, "url-ledger.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));
const fetchedAt = (url: string) => ledger.find((r) => r.canonical_url === url)?.fetched_at ?? "";

const exceptions: Array<[string, string, string, string, string, string]> = [];
const exception = (entity: string, field: string, issue: string, severity: "blocker" | "high" | "medium" | "low", evidence: string, url: string) =>
  exceptions.push([entity, field, issue, severity, evidence, url]);

const decode = (s: string) => cheerio.load(`<p>${s}</p>`)("p").text().replace(/\s+/g, " ").trim();
const rupeesToPaise = (s: string | null | undefined): number | null => {
  if (!s) return null;
  const m = s.replace(/[₹,\s]/g, "").match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
};

function field<T>(observations: Observation<T>[], opts: { note?: string; requireReview?: boolean } = {}): Field<T> {
  const distinct = new Set(observations.map((o) => JSON.stringify(o.value)));
  const agreed = distinct.size === 1;
  return {
    value: agreed ? observations[0].value : null,
    review_state: agreed && !opts.requireReview ? "observed" : "needs_review",
    observations,
    ...(opts.note ? { note: opts.note } : {}),
  };
}

/** Parse WooCommerce long-description HTML into heading-grouped sections. */
function descriptionSections(html: string) {
  const $ = cheerio.load(html);
  $("style,script").remove();
  const sections: Array<{ heading: string | null; paragraphs: string[]; items: string[] }> = [];
  let cur: (typeof sections)[number] = { heading: null, paragraphs: [], items: [] };
  sections.push(cur);
  $("h1,h2,h3,h4,h5,h6,p,li").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (!t) return;
    if (/^h\d$/.test(el.tagName)) {
      cur = { heading: t, paragraphs: [], items: [] };
      sections.push(cur);
    } else if (el.tagName === "li") cur.items.push(t);
    else cur.paragraphs.push(t);
  });
  return sections.filter((s) => s.heading || s.paragraphs.length || s.items.length);
}

/**
 * Store API category assignments, plus product-category links found in the page's JSON-LD BreadcrumbList.
 * The Store API omits categories for several products that the page itself files under "Skin Care".
 */
function categoriesFor(p: any, ex: PageExtract | undefined, url: string): string[] {
  const fromApi: string[] = p.categories.map((c: any) => c.slug);
  const fromBreadcrumb = (ex?.jsonLd ?? [])
    .flatMap((j: any) => j?.["@graph"] ?? [j])
    .filter((n: any) => n?.["@type"] === "BreadcrumbList")
    .flatMap((b: any) => b.itemListElement ?? [])
    .map((i: any) => String(i?.item?.["@id"] ?? "").match(/\/product-category\/([^/]+)\/?$/)?.[1])
    .filter(Boolean) as string[];
  const missing = fromBreadcrumb.filter((s) => !fromApi.includes(s));
  if (missing.length)
    exception(`product:${p.slug}`, "categories", "Category present in page breadcrumb (JSON-LD) but missing from Store API", "low", `breadcrumb: ${missing.join(", ")}`, url);
  return [...new Set([...fromApi, ...fromBreadcrumb])];
}

const products: unknown[] = [];
const rawRows: unknown[] = [];
const packages: unknown[] = [];
const assets = new Map<string, { original_url: string; roles: unknown[]; alt_observed: Set<string>; width: number | null; height: number | null }>();
const addAsset = (src: string, role: unknown, alt: string | null, w?: number | null, h?: number | null) => {
  const a = assets.get(src) ?? { original_url: src, roles: [], alt_observed: new Set<string>(), width: null, height: null };
  a.roles.push(role);
  if (alt) a.alt_observed.add(alt);
  a.width ??= w ?? null;
  a.height ??= h ?? null;
  assets.set(src, a);
};

const idToSlug = new Map<number, string>(api.products.map((p: any) => [p.id, p.slug]));

for (const p of api.products as any[]) {
  const url: string = p.permalink;
  const ex = extracts[url];
  const apiAt = p._source.fetchedAt;
  const htmlAt = fetchedAt(url);
  const isBundle = p.type === "woosb";
  const jsonLdProduct = (ex?.jsonLd ?? [])
    .flatMap((j: any) => j?.["@graph"] ?? [j])
    .find((n: any) => n?.["@type"] === "Product") as any;

  rawRows.push({ source_identity: `woo:product:${p.id}`, url, store_api: p, html_extract: ex ?? null, json_ld_product: jsonLdProduct ?? null });

  const obs = <T,>(value: T, method: Observation["method"], loc: string): Observation<T> => ({
    value,
    source_url: method === "store_api" ? p._source.url : url,
    source_location: loc,
    retrieved_at: method === "store_api" ? apiAt : htmlAt,
    method,
  });

  const names: Observation<string>[] = [obs(decode(p.name), "store_api", `products[id=${p.id}].name`)];
  if (ex?.h1) names.push(obs(ex.h1, "html_dom", "h1"));
  const name = field(names);
  if (name.review_state === "needs_review") exception(`product:${p.slug}`, "name", "Name differs between Store API and page H1", "medium", names.map((n) => n.value).join(" | "), url);

  const sell: Observation<number | null>[] = [obs(Number(p.prices.price), "store_api", "prices.price (minor units)")];
  const ref: Observation<number | null>[] = [obs(Number(p.prices.regular_price), "store_api", "prices.regular_price (minor units)")];
  if (ex?.priceArea) {
    sell.push(obs(rupeesToPaise(ex.priceArea.current), "html_dom", "purchase area ins .amount"));
    ref.push(obs(rupeesToPaise(ex.priceArea.reference), "html_dom", "purchase area del .amount"));
  }
  const ldOffers = jsonLdProduct?.offers?.[0]?.priceSpecification as any[] | undefined;
  if (ldOffers?.length) {
    sell.push(obs(rupeesToPaise(ldOffers[0].price), "json_ld", "Product.offers[0].priceSpecification[0].price"));
  }

  const sections = descriptionSections(p.description ?? "");
  const section = (re: RegExp) => sections.find((s) => s.heading && re.test(s.heading));
  const details = section(/product details/i);
  const detailMap: Record<string, string> = {};
  for (const item of details?.items ?? []) {
    const m = item.match(/^([^:]{2,40}):\s*(.+)$/);
    if (m) detailMap[m[1].trim()] = m[2].trim();
  }
  const netQty = detailMap["Net Quantity"] ?? null;
  const qtyMatch = netQty?.match(/^([\d.]+)\s*(ml|g|gm|kg|l|pcs?|units?)\b/i);
  const keyIngredients = detailMap["Key Ingredients Highlighted"] ?? detailMap["Key Ingredients"] ?? null;
  const precautions = section(/precaution|caution|warning/i);
  if (!isBundle && !keyIngredients) exception(`product:${p.slug}`, "featured_ingredients", "No 'Key Ingredients' detail published", "low", "", url);
  if (!isBundle) exception(`product:${p.slug}`, "full_ingredient_list", "Full INCI list not published; page refers to packaging", "high", precautions?.paragraphs.join(" ").slice(0, 200) ?? "", url);
  if (!p.sku) exception(`product:${p.slug}`, "sku", "No SKU published; JSON-LD sku equals WordPress post ID and is not a SKU", "medium", `json_ld.sku=${jsonLdProduct?.sku ?? "null"}`, url);

  p.images.forEach((img: any, i: number) => addAsset(img.src, { page: url, role: i === 0 ? "primary" : "gallery", order: i, legacy_media_id: img.id }, img.alt || null));

  // Reviews visible in HTML but absent from the Store API reviews endpoint: provenance unverified.
  const reviewBlocks = (ex?.blocks ?? []).filter((b) => b.section && /review for/i.test(b.section) && b.tag === "p" && / – [A-Z][a-z]+ \d{1,2}, \d{4}$/.test(b.text));
  const reviews = reviewBlocks.map((b) => {
    const [author, date] = b.text.split(" – ");
    return {
      author_display: author.split(" ")[0], // minimise public author data
      date_text: date,
      source_url: url,
      source_location: b.location,
      provenance: "html_only_not_in_store_api",
      verified_purchase: null,
      review_state: "needs_review",
    };
  });
  if (reviews.length) exception(`product:${p.slug}`, "reviews", "Review visible in HTML but not returned by Store API reviews endpoint; provenance and purchase verification unknown", "medium", `${reviews.length} review(s)`, url);

  const record = {
    source_identity: `woo:product:${p.id}`,
    legacy_id: p.id,
    slug: p.slug,
    canonical_url: url,
    product_type: isBundle ? "bundle" : "simple",
    name,
    short_description: field([obs(decode(p.short_description ?? ""), "store_api", "short_description")]),
    description_sections: field([obs(sections, "store_api", "description (parsed headings)")], { requireReview: true }),
    key_features: section(/key features|benefits/i)?.items ?? [],
    directions: section(/how to use|directions|usage/i)?.items ?? [],
    precautions: precautions ? [...precautions.paragraphs, ...precautions.items] : [],
    product_details: detailMap,
    net_quantity: netQty
      ? { text: netQty, value: qtyMatch ? Number(qtyMatch[1]) : null, unit: qtyMatch ? qtyMatch[2].toLowerCase() : null }
      : null,
    featured_ingredients: keyIngredients
      ? keyIngredients.split(/,| and | & /).map((s) => s.trim()).filter(Boolean)
      : [],
    full_ingredient_list: null,
    full_ingredient_list_note: "Not published on source; product pages refer to packaging.",
    packaging: detailMap["Packaging"] ?? null,
    manufacturer: null,
    country_of_origin: null,
    sku: p.sku || null,
    categories: categoriesFor(p, ex, url),
    tags: p.tags.map((t: any) => t.slug),
    attributes: p.attributes,
    variations: p.variations,
    currency: p.prices.currency_code,
    selling_price_paise: field(sell),
    reference_price_paise: field(ref, {
      note: "Observed strike-through 'Original price'. Not verified as MRP; must be classified by merchant.",
      requireReview: true,
    }),
    tax_wording: null,
    availability_claim: { is_in_stock: p.is_in_stock, is_purchasable: p.is_purchasable, note: "Store availability flag; not a stocktake." },
    images: p.images.map((img: any, i: number) => ({ src: img.src, order: i, alt: img.alt || null, legacy_media_id: img.id })),
    reviews,
    seo: { title: ex?.title ?? null, meta_description: ex?.metaDescription ?? null, canonical: ex?.canonical ?? null, robots: ex?.robots ?? null },
    review_state: "needs_review" as ReviewState,
  };
  products.push(record);

  if (isBundle) {
    const block = (re: RegExp) => (ex?.blocks ?? []).find((b) => re.test(b.text));
    const nameBlock = block(/^Product Name:/);
    const pkgPriceBlock = block(/^Package Price:/);
    const origValueBlock = block(/^Original package value shown:/);
    const totalBlock = block(/^Total:\s*\d+ regular/);
    const freeBlock = block(/^Free products:/);
    const totalMatch = totalBlock?.text.match(/(\d+) regular pieces? \+ (\d+) free/);
    const comps = ex?.bundle?.components ?? [];
    const widgetUnits = comps.reduce((s, c) => s + c.qty, 0);
    const o = (value: unknown, loc: string, method: Observation["method"] = "html_dom") => obs(value, method, loc);

    const observations = {
      selling_price_paise: [
        o(Number(p.prices.price), "prices.price", "store_api"),
        o(rupeesToPaise(ex?.priceArea?.current), "purchase area ins .amount"),
        o(ex?.bundle?.widgetPrice ? Number(ex.bundle.widgetPrice) * 100 : null, ".woosb-products[data-price]"),
        o(rupeesToPaise(pkgPriceBlock?.text.split(":")[1]), `narrative ${pkgPriceBlock?.location ?? "missing"} 'Package Price'`),
        o(rupeesToPaise(nameBlock?.text.match(/₹[\d,]+/)?.[0]), `narrative ${nameBlock?.location ?? "missing"} 'Product Name' suffix`),
      ],
      reference_value_paise: [
        o(Number(p.prices.regular_price), "prices.regular_price", "store_api"),
        o(rupeesToPaise(ex?.priceArea?.reference), "purchase area del .amount"),
        o(rupeesToPaise(origValueBlock?.text.split(":")[1]), `narrative ${origValueBlock?.location ?? "missing"} 'Original package value shown'`),
      ],
      widget_discount_amount_rupees: ex?.bundle?.discountAmount ?? null,
      total_units: [
        o({ paid: null, free: null, total: widgetUnits }, ".woosb-product[data-qty] sum (no paid/free split)"),
        o(totalMatch ? { paid: Number(totalMatch[1]), free: Number(totalMatch[2]), total: Number(totalMatch[1]) + Number(totalMatch[2]) } : null, `narrative ${totalBlock?.location ?? "missing"} 'Total'`),
      ],
      free_products_text: freeBlock ? o(freeBlock.text, `narrative ${freeBlock.location}`) : null,
      narrative_name: nameBlock ? o(nameBlock.text, `narrative ${nameBlock.location}`) : null,
    };
    const priceValues = new Set(observations.selling_price_paise.map((x) => x.value).filter((v) => v !== null));
    const conflicts: string[] = [];
    if (priceValues.size > 1) conflicts.push(`selling price observations disagree: ${[...priceValues].map((v) => `₹${(v as number) / 100}`).join(" vs ")}`);
    const refValues = new Set(observations.reference_value_paise.map((x) => x.value).filter((v) => v !== null));
    if (refValues.size > 1) conflicts.push(`reference value observations disagree: ${[...refValues].map((v) => `₹${(v as number) / 100}`).join(" vs ")}`);
    if (totalMatch && Number(totalMatch[1]) + Number(totalMatch[2]) !== widgetUnits)
      conflicts.push(`unit count: widget lists ${widgetUnits} units; narrative states ${totalMatch[1]} paid + ${totalMatch[2]} free = ${Number(totalMatch[1]) + Number(totalMatch[2])}`);
    if (freeBlock && /Herbal Facial Kit/i.test(freeBlock.text))
      conflicts.push("narrative 'Herbal Facial Kit' does not identify Gold vs Haldi Chandan kit SKU");
    conflicts.push("widget does not classify components as paid or complimentary");

    packages.push({
      source_identity: `woo:product:${p.id}`,
      legacy_id: p.id,
      slug: p.slug,
      canonical_url: url,
      name: decode(p.name),
      components_observed: comps.map((c) => ({
        legacy_product_id: Number(c.legacyId),
        product_slug: idToSlug.get(Number(c.legacyId)) ?? null,
        name: c.name,
        qty: c.qty,
        paid_or_free: null,
        listed_unit_price_rupees: c.unitPrice,
        order: c.order,
        source_location: ".woosb-product[data-qty]",
      })),
      observations,
      conflicts,
      review_state: "needs_review",
      purchasable: false,
      purchase_blocked_reason: "Package requires an approved version before purchase (quote request available).",
    });
    for (const c of conflicts) exception(`package:${p.slug}`, "package_version", c, "blocker", "", url);
  }
}

// Content pages and posts from WP REST, with styles removed and text structured.
function contentText(html: string) {
  const $ = cheerio.load(html);
  $("style,script,form,svg").remove();
  return descriptionSections($.html());
}
const placeholders: Array<[RegExp, string]> = [
  [/\[Write your[^\]]*\]|\[List only[^\]]*\]/i, "unresolved template placeholder copy"],
  [/\[(?:Rampur,UP|Your [^\]]+)\]/i, "bracketed placeholder text"],
  [/Your address/i, "address placeholder"],
  [/yourhandle|yourpage|yourchannel/i, "placeholder social link"],
  [/91X{6,}/i, "placeholder WhatsApp number"],
];
const contentPages: unknown[] = [];
for (const kind of ["pages", "posts"] as const) {
  for (const pg of api[kind] as any[]) {
    const raw = pg.content?.rendered ?? "";
    const sectionsC = contentText(raw);
    const flat = sectionsC.flatMap((s) => [s.heading ?? "", ...s.paragraphs, ...s.items]).join("\n");
    const issues = placeholders.filter(([re]) => re.test(raw)).map(([, why]) => why);
    for (const why of issues) exception(`content:${pg.slug}`, "body", why, "high", "", pg.link);
    const shortcodeOnly = /^\s*\[[a-z_]+[^\]]*\]\s*$/.test(decode(raw));
    contentPages.push({
      source_identity: `wp:${kind === "pages" ? "page" : "post"}:${pg.id}`,
      kind: kind === "pages" ? "page" : "post",
      slug: pg.slug,
      url: pg.link,
      title: decode(pg.title.rendered),
      published_at: pg.date,
      modified_at: pg.modified,
      excerpt: pg.excerpt ? decode(pg.excerpt.rendered) : null,
      sections: sectionsC,
      text_length: flat.length,
      shortcode_only: shortcodeOnly,
      issues,
      review_state: "needs_review",
    });
  }
}

// Contact targets across all pages, validated against each other.
const contacts = new Map<string, { kind: string; pages: Set<string> }>();
for (const ex of Object.values(extracts)) {
  for (const c of ex.contactTargets ?? []) {
    const key = c.href.replace(/\?.*$/, "");
    const e = contacts.get(key) ?? { kind: c.kind, pages: new Set<string>() };
    e.pages.add(ex.url);
    contacts.set(key, e);
  }
  for (const img of ex.images ?? []) addAsset(img.src, { page: ex.url, role: "page_image", location: img.location }, img.alt, img.width, img.height);
}
for (const [href, c] of contacts) {
  if (/X{4,}|'\s*\+|yourhandle|yourpage|yourchannel/i.test(href))
    exception("settings:contact", c.kind, "placeholder or template contact target published", "high", href, [...c.pages][0]);
}

for (const row of ledger.filter((r) => r.extraction_status === "failed"))
  exception("url", "http_status", "Internal link returns an error on the live site", "medium", `${row.http_status} linked from ${row.discovered_from}`, row.canonical_url);

for (const c of api.categories as any[]) if (c.image?.src) addAsset(c.image.src, { page: `category:${c.slug}`, role: "category_image" }, c.image.alt || null);

const categories = (api.categories as any[]).map((c) => ({
  source_identity: `woo:product_cat:${c.id}`,
  legacy_id: c.id,
  slug: c.slug,
  name: decode(c.name),
  parent_legacy_id: c.parent || null,
  description: c.description ? decode(c.description) : null,
  image: c.image?.src ?? null,
  product_count_observed: c.count,
  source_url: c.permalink,
}));

// Legacy URL → new route mapping. Unknown destinations become exceptions, never homepage redirects.
const redirectRules: Array<[RegExp, (m: RegExpMatchArray) => string | null]> = [
  [/^\/$/, () => "/"],
  [/^\/shop\/$/, () => "/shop"],
  [/^\/product\/([^/]+)\/$/, (m) => (packages.some((p: any) => p.slug === m[1]) ? `/packages/${m[1]}` : `/products/${m[1]}`)],
  [/^\/product-category\/packages\/$/, () => "/packages"],
  [/^\/product-category\/([^/]+)\/$/, (m) => `/category/${m[1]}`],
  [/^\/about-us\/$/, () => "/about"],
  [/^\/contact-us\/$/, () => "/contact"],
  [/^\/privacy-policy\/$/, () => "/policies/privacy"],
  [/^\/refund_returns\/$/, () => "/policies/returns"],
  [/^\/terms-and-conditions\/$/, () => "/policies/terms"],
  [/^\/news\/$/, () => "/journal"],
  [/^\/cart\/$/, () => "/cart"],
  [/^\/checkout\/$/, () => "/checkout"],
  [/^\/my-account(-2)?\/$/, () => "/account"],
  [/^\/login\/$/, () => "/login"],
  [/^\/registration\/$/, () => "/register"],
  [/^\/lost-password\/$/, () => "/forgot-password"],
  [/^\/category\/uncategorized\/$/, () => "/journal"],
];
const postSlugs = new Set((api.posts as any[]).map((p) => p.slug));
const redirects: string[][] = [];
for (const row of ledger) {
  if (!["home", "shop", "product", "product_category", "page", "post_category", "news_index"].includes(row.page_type) && row.exception_reason?.match(/route/) == null) continue;
  const path = new URL(row.canonical_url).pathname;
  let target: string | null = null;
  const slug = path.replace(/^\/|\/$/g, "");
  if (postSlugs.has(slug)) target = `/journal/${slug}`;
  else for (const [re, fn] of redirectRules) { const m = path.match(re); if (m) { target = fn(m); break; } }
  if (target) redirects.push([path, target, target === path ? "200 (same path)" : "308", row.page_type]);
  else if (row.http_status === 200 || row.exception_reason?.match(/route/)) {
    redirects.push([path, "", "unresolved", row.page_type]);
    exception("url", "redirect", "No defined destination for legacy URL; needs merchant decision", "medium", "", row.canonical_url);
  }
}

// Manual visual review of media (OCR candidates) feeds the same exception register.
try {
  const vr = JSON.parse(readFileSync(join(DATA_DIR, "visual-review.json"), "utf8"));
  for (const f of vr.findings) exception(f.entity, "visual_review", f.issue, f.severity, JSON.stringify(f.ocr_candidates ?? f.classification), f.asset);
} catch {
  /* no visual review yet */
}

writeJsonl("products.raw.jsonl", rawRows);
writeJson("products.normalized.json", { generated_at: new Date().toISOString(), products: products.filter((p: any) => p.product_type === "simple") });
writeJson("packages.observations.json", { generated_at: new Date().toISOString(), packages });
writeJson("categories.json", { generated_at: new Date().toISOString(), categories });
writeJson("content-pages.json", { generated_at: new Date().toISOString(), pages: contentPages, contacts: [...contacts].map(([href, c]) => ({ href, kind: c.kind, pages: [...c.pages] })) });
writeJson("assets.manifest.json", {
  generated_at: new Date().toISOString(),
  note: "Checksums/dimensions are filled by `npm run source:assets` after a permitted download. Rights: brand-owned source site; merchant confirmation required.",
  assets: [...assets.values()].map((a) => ({
    original_url: a.original_url,
    roles: a.roles,
    alt_observed: [...a.alt_observed],
    width: a.width,
    height: a.height,
    checksum_sha256: null,
    storage_key: null,
    classification: "unclassified (photograph | marketing composite | 3D) — requires visual review",
    rights: "source-site asset; merchant confirmation required",
  })),
});
writeCsv("redirects.csv", ["legacy_path", "target_path", "status", "page_type"], redirects);
writeCsv("migration-exceptions.csv", ["entity", "field", "issue", "severity", "evidence", "source_url"], exceptions);
console.log(`products=${products.length} packages=${packages.length} pages=${contentPages.length} assets=${assets.size} redirects=${redirects.length} exceptions=${exceptions.length}`);
