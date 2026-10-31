import { randomUUID } from "node:crypto";
import type { Db } from "@oryvia/db";

/** Empties every application table in the TEST database. Refuses to touch any other database. */
export async function resetDb(db: Db) {
  const [{ current_database }] = await db.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
  if (!current_database.endsWith("_test")) throw new Error(`refusing to truncate non-test database ${current_database}`);
  const tables = await db.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  // Append-only triggers block DELETE, but TRUNCATE is allowed for test resets.
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

export async function publishedProduct(db: Db, opts: { unitPaise?: number; stock?: number; slug?: string } = {}) {
  const slug = opts.slug ?? `test-${randomUUID().slice(0, 8)}`;
  const list = await db.priceList.upsert({ where: { key: "retail-inr" }, create: { key: "retail-inr", name: "Retail", audience: "retail" }, update: {} });
  const wh = await db.warehouse.upsert({ where: { code: "T1" }, create: { code: "T1", name: "Test" }, update: {} });
  const product = await db.product.create({ data: { slug, name: `Test ${slug}`, status: "published", publishedAt: new Date() } });
  const variant = await db.variant.create({ data: { productId: product.id, internalCode: `T-${slug}` } });
  await db.priceEntry.create({ data: { variantId: variant.id, priceListId: list.id, unitPaise: opts.unitPaise ?? 39900, reviewState: "published", effectiveFrom: new Date(Date.now() - 60_000) } });
  if (opts.stock) {
    await db.stockBalance.create({ data: { variantId: variant.id, warehouseId: wh.id, onHand: opts.stock } });
    await db.stockMovement.create({ data: { variantId: variant.id, warehouseId: wh.id, delta: opts.stock, reason: "receipt" } });
  }
  return { product, variant, warehouse: wh };
}

export async function shippingRule(db: Db, flatPaise = 0) {
  await db.storeSetting.upsert({
    where: { key: "shipping.rule" },
    create: { key: "shipping.rule", value: { label: "Test rule", flatPaise, freeAboveSubtotalPaise: null, serviceablePinPrefixes: [], isDevelopment: true } },
    update: { value: { label: "Test rule", flatPaise, freeAboveSubtotalPaise: null, serviceablePinPrefixes: [], isDevelopment: true } },
  });
}

export const checkoutInput = (email = "buyer@oryvia.test") => ({
  email,
  shippingAddress: { name: "Test Buyer", phone: "9876543210", line1: "12 Test Street", city: "Rampur", state: "Uttar Pradesh", postalCode: "244901" },
  billingSameAsShipping: true,
});

/** A bare user row (no credentials) for actor/ownership references in tests. */
export async function testUser(db: Db, label: string) {
  return db.user.create({ data: { id: randomUUID(), name: label, email: `${label}-${randomUUID().slice(0, 6)}@oryvia.test`, emailVerified: true } });
}

/** Adds a lot with an expiry date and stock to an existing variant in warehouse T1. */
export async function stockBatch(db: Db, variantId: string, lot: string, quantity: number, expiresAt: Date | null) {
  const wh = await db.warehouse.upsert({ where: { code: "T1" }, create: { code: "T1", name: "Test" }, update: {} });
  const batch = await db.inventoryBatch.create({ data: { variantId, lot, expiresAt } });
  await db.stockBalance.create({ data: { variantId, warehouseId: wh.id, batchId: batch.id, onHand: quantity } });
  await db.stockMovement.create({ data: { variantId, warehouseId: wh.id, batchId: batch.id, delta: quantity, reason: "receipt", reference: `lot:${lot}` } });
  return batch;
}
