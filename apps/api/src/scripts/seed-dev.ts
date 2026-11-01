// DEVELOPMENT-ONLY setup so the purchase path can be exercised locally. Refuses to run in production.
// Everything it writes is labelled as development data:
//  - DEV-MAIN warehouse and stock receipts with lot "DEV-…" (not a stocktake)
//  - a development shipping rule (isDevelopment: true; shown as such at checkout)
//  - product publication recorded as a DEVELOPMENT review decision (not merchant approval)
//  - a development return policy (isDevelopment: true) so the customer return flow can be exercised
//  - three development accounts (owner, finance operator for refund maker-checker, customer) whose passwords are generated randomly and written to .data/dev-accounts.json
// Usage: npm run seed:dev -w @oryvia/api
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auth } from "../core/auth.js";
import { prisma } from "../core/db.js";
import { env } from "../core/env.js";

if (env.NODE_ENV === "production") {
  console.error("seed-dev refuses to run with NODE_ENV=production");
  process.exit(1);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const REASON = "DEVELOPMENT ONLY: published for local testing; not a merchant approval";

const wh = await prisma.warehouse.upsert({ where: { code: "DEV-MAIN" }, create: { code: "DEV-MAIN", name: "Development warehouse (not real stock)" }, update: {} });

const products = await prisma.product.findMany({ where: { sourceIdentity: { not: null } }, include: { variants: true, categories: true } });
for (const p of products) {
  if (p.status !== "published") {
    await prisma.product.update({ where: { id: p.id }, data: { status: "published", publishedAt: new Date(), version: { increment: 1 } } });
    await prisma.reviewDecision.create({ data: { entityKey: p.sourceIdentity!, decision: "published_dev", reason: REASON, actorId: "seed-dev" } });
  }
  await prisma.priceEntry.updateMany({ where: { variantId: { in: p.variants.map((v) => v.id) }, reviewState: "needs_review" }, data: { reviewState: "approved" } });
  await prisma.category.updateMany({ where: { id: { in: p.categories.map((c) => c.categoryId) } }, data: { status: "published" } });
  for (const v of p.variants) {
    const lot = "DEV-LOT-1";
    const batch = await prisma.inventoryBatch.upsert({ where: { variantId_lot: { variantId: v.id, lot } }, create: { variantId: v.id, lot }, update: {} });
    const bal = await prisma.stockBalance.findUnique({ where: { variantId_warehouseId_batchId: { variantId: v.id, warehouseId: wh.id, batchId: batch.id } } });
    if (!bal) {
      await prisma.$transaction([
        prisma.stockBalance.create({ data: { variantId: v.id, warehouseId: wh.id, batchId: batch.id, onHand: 25 } }),
        prisma.stockMovement.create({ data: { variantId: v.id, warehouseId: wh.id, batchId: batch.id, delta: 25, reason: "receipt", reference: "lot:DEV-LOT-1", note: "DEVELOPMENT stock receipt: not a stocktake" } }),
      ]);
    }
  }
}

await prisma.storeSetting.upsert({
  where: { key: "shipping.rule" },
  create: { key: "shipping.rule", value: { label: "Development delivery rule (not merchant-approved)", flatPaise: 0, freeAboveSubtotalPaise: null, serviceablePinPrefixes: [], isDevelopment: true }, verified: false, updatedBy: "seed-dev" },
  update: {},
});

await prisma.storeSetting.upsert({
  where: { key: "returns.policy" },
  create: { key: "returns.policy", value: { label: "Development return window (not merchant-approved)", windowDays: 7, isDevelopment: true }, verified: false, updatedBy: "seed-dev" },
  update: {},
});

// Development accounts via Better Auth's own sign-up (proper hashing). Random passwords, stored locally only.
const accountsFile = join(root, ".data", "dev-accounts.json");
const accounts: Record<string, { email: string; password: string; role: string }> = existsSync(accountsFile) ? JSON.parse(readFileSync(accountsFile, "utf8")).accounts : {};
let created = 0;
const names = { admin: "Dev Admin", finance: "Dev Finance", customer: "Dev Customer" };
for (const [key, role] of [["admin", "owner"], ["finance", "finance_operator"], ["customer", null]] as const) {
  const email = `dev-${key}@oryvia.test`;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) continue;
  const password = randomBytes(12).toString("base64url");
  await auth.api.signUpEmail({ body: { email, password, name: names[key] } });
  const user = await prisma.user.update({ where: { email }, data: { emailVerified: true } });
  if (role) {
    const r = await prisma.role.findUniqueOrThrow({ where: { key: role } });
    await prisma.staffRoleAssignment.create({ data: { userId: user.id, roleId: r.id, grantedBy: "seed-dev" } });
  }
  accounts[key] = { email, password, role: role ?? "customer" };
  created++;
}
if (created) {
  mkdirSync(join(root, ".data"), { recursive: true });
  writeFileSync(accountsFile, JSON.stringify({ note: "DEVELOPMENT ONLY. Never use in production.", accounts }, null, 2));
  console.log("development accounts written to .data/dev-accounts.json");
}
console.log(`dev seed complete: ${products.length} products dev-published, DEV-MAIN stock 25/variant, development shipping rule`);
await prisma.$disconnect();
