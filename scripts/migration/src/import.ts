// Idempotent import of normalized source evidence into PostgreSQL.
// - Keys on stable source identity (woo:product:<id>, wp:post:<id>, ...). Re-running never duplicates.
// - Never overwrites a record a merchant has edited (merchantEditedAt set); logs an exception instead.
// - Everything lands as needs_review. Nothing is published by import.
// Usage: npm run import:dry-run   |   npm run import:apply
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPrisma, type Tx } from "@oryvia/db";
import { DATA_DIR } from "./paths.js";

const DRY_RUN = process.argv.includes("--dry-run");
const load = (f: string) => JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));

const products = load("products.normalized.json").products as any[];
const packages = load("packages.observations.json").packages as any[];
const categories = load("categories.json").categories as any[];
const content = load("content-pages.json");
const assets = load("assets.manifest.json").assets as any[];
const ledger = readFileSync(join(DATA_DIR, "url-ledger.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const exceptionsCsv = readFileSync(join(DATA_DIR, "migration-exceptions.csv"), "utf8").trim().split("\n").slice(1);

const CATEGORY_SLUG: Record<string, string> = { skincare: "skin-care", "hair-care": "hair-care" };
/** Key-order-independent JSON for comparing evidence (jsonb does not preserve key order). */
export const stableStringify = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(stableStringify).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(",")}}`
  : JSON.stringify(v ?? null);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.replace(/^'(?=[=+\-@])/, ""));
}

/** Ingredients named in featured callouts or in the product title. No descriptions are invented. */
function featuredIngredients(p: any): Array<{ name: string; note: string }> {
  const out = new Map<string, string>();
  for (const n of p.featured_ingredients ?? []) out.set(n, "Listed under 'Key Ingredients Highlighted' on product page");
  const title: string = p.name.value ?? p.name.observations[0].value;
  const m = title.match(/\bwith (.+)$/i);
  if (m && !/cleanser, scrub/i.test(m[1]))
    for (const n of m[1].split(/,| & | and /).map((s) => s.trim()).filter(Boolean)) if (!out.has(n)) out.set(n, "Named in product title");
  return [...out].map(([name, note]) => ({ name, note }));
}

const summary: Record<string, number> = {};
const bump = (k: string) => (summary[k] = (summary[k] ?? 0) + 1);

async function run(tx: Tx, runId: string) {
  // Source pages
  for (const r of ledger) {
    await tx.sourcePage.upsert({
      where: { url: r.canonical_url },
      create: { url: r.canonical_url, pageType: r.page_type, httpStatus: r.http_status, fetchedAt: r.fetched_at ? new Date(r.fetched_at) : null, contentHash: r.content_hash, status: r.extraction_status },
      update: { httpStatus: r.http_status, fetchedAt: r.fetched_at ? new Date(r.fetched_at) : null, contentHash: r.content_hash, status: r.extraction_status },
    });
    bump("source_pages");
  }

  // Media (only successfully downloaded originals)
  const assetIdByUrl = new Map<string, string>();
  for (const a of assets.filter((x) => x.download_state === "downloaded")) {
    const alt = a.alt_observed?.find((s: string) => s && !/^[\w-]+$/.test(s)) ?? null; // filename-like alts are not real alt text
    const row = await tx.mediaAsset.upsert({
      where: { sourceUrl: a.original_url },
      create: { storageKey: a.storage_key, visibility: "public", mime: a.mime, sizeBytes: a.size_bytes, width: a.width, height: a.height, checksum: a.checksum_sha256, alt, sourceUrl: a.original_url, classification: null, rightsNote: a.rights },
      update: { storageKey: a.storage_key, checksum: a.checksum_sha256, width: a.width, height: a.height },
    });
    assetIdByUrl.set(a.original_url, row.id);
    bump("media_assets");
  }

  // Categories
  const categoryId = new Map<string, string>();
  for (const c of categories) {
    if (c.slug === "packages") continue; // packages are their own domain, not a product category
    const slug = CATEGORY_SLUG[c.slug] ?? c.slug;
    const row = await tx.category.upsert({
      where: { sourceIdentity: c.source_identity },
      create: { sourceIdentity: c.source_identity, slug, name: c.name, description: c.description, imageAssetId: assetIdByUrl.get(c.image) ?? null, status: "needs_review" },
      update: { imageAssetId: assetIdByUrl.get(c.image) ?? undefined },
    });
    categoryId.set(c.slug, row.id);
    bump("categories");
  }

  const retail = await tx.priceList.upsert({ where: { key: "retail-inr" }, create: { key: "retail-inr", name: "Retail (INR)", audience: "retail" }, update: {} });

  // Products
  const variantByLegacyId = new Map<number, string>();
  for (const p of products) {
    const existing = await tx.product.findUnique({ where: { sourceIdentity: p.source_identity }, include: { variants: true } });
    const name = p.name.value ?? p.name.observations[0].value;
    if (existing?.merchantEditedAt) {
      bump("products_skipped_merchant_edited");
      await tx.migrationException.upsert({
        where: { entityKey_field_issue: { entityKey: `product:${p.slug}`, field: "*", issue: "Merchant-edited record; import did not overwrite" } },
        create: { entityKey: `product:${p.slug}`, field: "*", issue: "Merchant-edited record; import did not overwrite", severity: "low", migrationRunId: runId },
        update: { migrationRunId: runId },
      });
      if (existing.variants[0]) variantByLegacyId.set(p.legacy_id, existing.variants[0].id);
      continue;
    }
    const data = {
      slug: p.slug,
      name,
      shortDescription: p.short_description.value,
      descriptionSections: p.description_sections.observations[0].value,
      keyFeatures: p.key_features,
      directions: p.directions,
      precautions: p.precautions,
      details: p.product_details,
      packaging: p.packaging,
      fullIngredientList: null,
      seoTitle: p.seo.title,
      seoDescription: p.seo.meta_description,
    };
    const product = existing
      ? await tx.product.update({ where: { id: existing.id }, data })
      : await tx.product.create({ data: { ...data, sourceIdentity: p.source_identity, status: "needs_review" } });
    bump(existing ? "products_updated" : "products_created");

    const variant = await tx.variant.upsert({
      where: { internalCode: `ORY-${p.legacy_id}` },
      create: { productId: product.id, internalCode: `ORY-${p.legacy_id}`, sku: p.sku, quantityValue: p.net_quantity?.value ?? null, quantityUnit: p.net_quantity?.unit ?? null, title: p.net_quantity?.text ?? null },
      update: { quantityValue: p.net_quantity?.value ?? null, quantityUnit: p.net_quantity?.unit ?? null, title: p.net_quantity?.text ?? null },
    });
    variantByLegacyId.set(p.legacy_id, variant.id);

    for (const slug of p.categories) {
      const cid = categoryId.get(slug);
      if (cid) await tx.productCategory.upsert({ where: { productId_categoryId: { productId: product.id, categoryId: cid } }, create: { productId: product.id, categoryId: cid }, update: {} });
    }
    let order = 0;
    for (const img of p.images) {
      const assetId = assetIdByUrl.get(img.src);
      if (!assetId) continue;
      await tx.productMedia.upsert({
        where: { productId_assetId: { productId: product.id, assetId } },
        create: { productId: product.id, assetId, role: order === 0 ? "primary" : "gallery", sortOrder: order },
        update: { sortOrder: order },
      });
      order++;
    }

    const sell = p.selling_price_paise;
    if (sell.value != null) {
      const ref = p.reference_price_paise.observations[0]?.value ?? null;
      const effectiveFrom = new Date("2026-10-31T00:00:00Z");
      await tx.priceEntry.upsert({
        where: { variantId_priceListId_minQuantity_effectiveFrom: { variantId: variant.id, priceListId: retail.id, minQuantity: 1, effectiveFrom } },
        create: { variantId: variant.id, priceListId: retail.id, unitPaise: sell.value, referencePaise: ref, referenceLabel: "Observed 'original price' (not verified MRP)", effectiveFrom, reviewState: "needs_review" },
        update: { unitPaise: sell.value, referencePaise: ref },
      });
    }

    for (const ing of featuredIngredients(p)) {
      const ingredient = await tx.ingredient.upsert({
        where: { slug: slugify(ing.name) },
        create: { slug: slugify(ing.name), name: ing.name, editorialStatus: "needs_review" },
        update: {},
      });
      await tx.productIngredient.upsert({
        where: { productId_ingredientId_relationKind: { productId: product.id, ingredientId: ingredient.id, relationKind: "featured" } },
        create: { productId: product.id, ingredientId: ingredient.id, relationKind: "featured", sourceNote: ing.note },
        update: { sourceNote: ing.note },
      });
    }

    for (const [fieldPath, f] of Object.entries({ name: p.name, selling_price_paise: p.selling_price_paise, reference_price_paise: p.reference_price_paise, short_description: p.short_description }) as Array<[string, any]>) {
      for (const o of f.observations) {
        await tx.sourceObservation.upsert({
          where: { entityKey_fieldPath_sourceUrl_sourceLocation_method: { entityKey: p.source_identity, fieldPath, sourceUrl: o.source_url, sourceLocation: o.source_location, method: o.method } },
          create: { entityKey: p.source_identity, fieldPath, value: o.value ?? null, sourceUrl: o.source_url, sourceLocation: o.source_location, method: o.method, retrievedAt: new Date(o.retrieved_at), reviewState: f.review_state, migrationRunId: runId },
          update: { value: o.value ?? null, retrievedAt: new Date(o.retrieved_at), migrationRunId: runId },
        });
        bump("observations");
      }
    }
  }

  // Packages: one needs_review version per observed source state. Never purchasable from import.
  for (const pk of packages) {
    const pkg = await tx.package.upsert({
      where: { sourceIdentity: pk.source_identity },
      create: { sourceIdentity: pk.source_identity, slug: pk.slug, name: pk.name, status: "needs_review" },
      update: { name: pk.name },
    });
    const existing = await tx.packageVersion.findFirst({ where: { packageId: pkg.id }, orderBy: { version: "desc" } });
    const sameEvidence = existing && stableStringify(existing.observations) === stableStringify(pk.observations);
    if (sameEvidence) {
      bump("package_versions_unchanged");
      continue;
    }
    if (existing?.approvalState === "approved") {
      // New evidence never replaces an approved version; it is queued for review alongside.
      bump("package_versions_new_evidence_after_approval");
    }
    const version = await tx.packageVersion.create({
      data: {
        packageId: pkg.id,
        version: (existing?.version ?? 0) + 1,
        approvalState: "needs_review",
        observations: pk.observations,
        conflicts: pk.conflicts,
      },
    });
    for (const c of pk.components_observed) {
      const variantId = variantByLegacyId.get(c.legacy_product_id);
      if (!variantId) continue;
      await tx.packageComponent.create({ data: { packageVersionId: version.id, variantId, paidQty: 0, freeQty: 0, observedQty: c.qty } });
    }
    bump("package_versions_created");
  }

  // Content: posts → articles; policies → policy versions; other informative pages → content pages.
  const POLICY: Record<string, string> = { "privacy-policy": "privacy", refund_returns: "returns", "terms-and-conditions": "terms" };
  const PAGE: Record<string, string> = { "about-us": "about", "contact-us": "contact", home: "home" };
  for (const pg of content.pages as any[]) {
    if (pg.kind === "post") {
      await tx.article.upsert({
        where: { sourceIdentity: pg.source_identity },
        create: { sourceIdentity: pg.source_identity, slug: pg.slug, title: pg.title, excerpt: pg.excerpt, body: pg.sections, status: "needs_review", publishedAt: new Date(pg.published_at + "+05:30") },
        update: { title: pg.title, excerpt: pg.excerpt, body: pg.sections },
      });
      bump("articles");
    } else if (POLICY[pg.slug]) {
      const exists = await tx.policyVersion.findFirst({ where: { policyKey: POLICY[pg.slug], sourceUrl: pg.url } });
      if (!exists) {
        const last = await tx.policyVersion.findFirst({ where: { policyKey: POLICY[pg.slug] }, orderBy: { version: "desc" } });
        await tx.policyVersion.create({ data: { policyKey: POLICY[pg.slug], version: (last?.version ?? 0) + 1, title: pg.title, body: pg.sections, sourceUrl: pg.url, reviewState: "needs_review" } });
      }
      bump("policies");
    } else if (PAGE[pg.slug]) {
      const page = await tx.contentPage.upsert({
        where: { sourceIdentity: pg.source_identity },
        create: { sourceIdentity: pg.source_identity, slug: PAGE[pg.slug], kind: "brand", title: pg.title, status: "needs_review" },
        update: {},
      });
      const has = await tx.pageVersion.findFirst({ where: { pageId: page.id, note: `import ${pg.modified_at}` } });
      if (!has) {
        const last = await tx.pageVersion.findFirst({ where: { pageId: page.id }, orderBy: { version: "desc" } });
        await tx.pageVersion.create({ data: { pageId: page.id, version: (last?.version ?? 0) + 1, body: { sections: pg.sections, issues: pg.issues }, note: `import ${pg.modified_at}` } });
      }
      bump("content_pages");
    }
  }

  // Exceptions register
  for (const line of exceptionsCsv) {
    const [entityKey, field, issue, severity, evidence, sourceUrl] = parseCsvLine(line);
    await tx.migrationException.upsert({
      where: { entityKey_field_issue: { entityKey, field, issue } },
      create: { entityKey, field, issue, severity, evidence: evidence || null, sourceUrl: sourceUrl || null, migrationRunId: runId },
      update: { evidence: evidence || null, migrationRunId: runId },
    });
    bump("exceptions");
  }
}

class DryRunRollback extends Error {}

async function main() {
  const db = createPrisma();
  const runRow = DRY_RUN ? null : await db.migrationRun.create({ data: { kind: "public_source_import", dryRun: false, status: "running" } });
  try {
    await db.$transaction(
      async (tx) => {
        const runId = runRow?.id ?? (await tx.migrationRun.create({ data: { kind: "public_source_import", dryRun: true, status: "running" } })).id;
        await run(tx, runId);
        if (DRY_RUN) throw new DryRunRollback();
      },
      { timeout: 300_000, maxWait: 10_000 },
    );
    if (runRow) await db.migrationRun.update({ where: { id: runRow.id }, data: { status: "succeeded", summary, finishedAt: new Date() } });
    console.log("IMPORT APPLIED", summary);
  } catch (e) {
    if (e instanceof DryRunRollback) console.log("DRY RUN (rolled back, nothing written)", summary);
    else {
      if (runRow) await db.migrationRun.update({ where: { id: runRow.id }, data: { status: "failed", summary: { error: String(e) }, finishedAt: new Date() } });
      throw e;
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
