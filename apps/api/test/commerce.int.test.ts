import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/core/db.js";
import { AppError } from "../src/core/errors.js";
import { withIdempotency } from "../src/core/idempotency.js";
import { CartService } from "../src/commerce/cart.js";
import { CheckoutService } from "../src/commerce/checkout.js";
import { buildQuote } from "../src/commerce/pricing.js";
import { expireUnpaidReservations, transitionOrder } from "../src/commerce/orders.js";
import { availableByVariant } from "../src/commerce/stock.js";
import { checkoutInput, publishedProduct, resetDb, shippingRule } from "./fixtures.js";

const carts = new CartService(prisma);
const checkout = new CheckoutService(prisma);

async function cartWith(variantId: string, quantity: number) {
  const { view, newGuestToken } = await carts.addItem({ userId: null, guestToken: null }, variantId, quantity);
  return { cartId: view.id!, token: newGuestToken!, items: [{ variantId, quantity }] };
}

async function place(variantId: string, quantity: number, email?: string) {
  const c = await cartWith(variantId, quantity);
  const input = checkoutInput(email);
  const q = await buildQuote(prisma, c.items, input);
  return checkout.placeOrder({ cartId: c.cartId, cartItems: c.items, input: { quoteHash: q.hash, paymentMethod: "dev_manual", checkout: input }, customerId: null, requestId: null });
}

beforeEach(async () => {
  await resetDb(prisma);
  await shippingRule(prisma);
});
afterAll(async () => prisma.$disconnect());

describe("C05 — two customers attempt the final unit", () => {
  it("confirms exactly one order and rejects the other with stock_unavailable", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 1 });
    const results = await Promise.allSettled([place(variant.id, 1, "a@oryvia.test"), place(variant.id, 1, "b@oryvia.test")]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0].reason as AppError).code).toBe("stock_unavailable");
    expect(await prisma.order.count()).toBe(1);
    const bal = await prisma.stockBalance.findFirstOrThrow({ where: { variantId: variant.id } });
    expect(bal).toMatchObject({ onHand: 1, reserved: 1 });
    expect((await availableByVariant(prisma, [variant.id])).get(variant.id)).toBe(0);
  });

  it("holds under 10 concurrent buyers for 3 units", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 3 });
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => place(variant.id, 1, `c${i}@oryvia.test`)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const bal = await prisma.stockBalance.findFirstOrThrow({ where: { variantId: variant.id } });
    expect(bal.reserved).toBe(3);
  });
});

describe("C04 — double submit / retry of checkout", () => {
  it("creates one order and one reservation for concurrent requests with the same idempotency key", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 5 });
    const c = await cartWith(variant.id, 2);
    const input = checkoutInput();
    const q = await buildQuote(prisma, c.items, input);
    const body = { quoteHash: q.hash, paymentMethod: "dev_manual" as const, checkout: input };
    const run = () =>
      withIdempotency("retry-key-0123456789abcdef", "guest:test", "checkout.place_order", body, async () => ({
        status: 201,
        body: await checkout.placeOrder({ cartId: c.cartId, cartItems: c.items, input: body, customerId: null, requestId: null }),
      }));
    const results = await Promise.allSettled([run(), run(), run()]);
    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof run>>>[];
    // In-flight duplicates are told to wait (409 idempotency_conflict); none creates a second order.
    for (const r of results.filter((r) => r.status === "rejected") as PromiseRejectedResult[]) expect((r.reason as AppError).code).toBe("idempotency_conflict");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    const replay = await run();
    expect(replay.replayed).toBe(true);
    expect(replay.body.orderId).toBe(fulfilled[0].value.body.orderId);
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.paymentAttempt.count()).toBe(1);
    expect((await prisma.stockBalance.findFirstOrThrow({ where: { variantId: variant.id } })).reserved).toBe(2);
  });

  it("rejects reuse of an idempotency key with a different body", async () => {
    await withIdempotency("key-aaaaaaaaaaaaaaaa", "p", "op", { a: 1 }, async () => ({ status: 200, body: { ok: true } }));
    await expect(withIdempotency("key-aaaaaaaaaaaaaaaa", "p", "op", { a: 2 }, async () => ({ status: 200, body: { ok: true } }))).rejects.toMatchObject({ code: "idempotency_conflict" });
  });
});

describe("C07 — price tampering", () => {
  it("rejects an order whose quote hash does not match the server quote", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 5, unitPaise: 49900 });
    const c = await cartWith(variant.id, 1);
    await expect(
      checkout.placeOrder({ cartId: c.cartId, cartItems: c.items, input: { quoteHash: "f".repeat(40), paymentMethod: "dev_manual", checkout: checkoutInput() }, customerId: null, requestId: null }),
    ).rejects.toMatchObject({ code: "commercial_conflict" });
    expect(await prisma.order.count()).toBe(0);
  });

  it("prices come only from approved price entries; unapproved prices are not purchasable", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 5 });
    await prisma.priceEntry.updateMany({ where: { variantId: variant.id }, data: { reviewState: "needs_review" } });
    const q = await buildQuote(prisma, [{ variantId: variant.id, quantity: 1 }]);
    expect(q.lines).toHaveLength(0);
    expect(q.problems[0].code).toBe("not_purchasable");
  });

  it("refuses checkout when no shipping rule is configured", async () => {
    await prisma.storeSetting.delete({ where: { key: "shipping.rule" } });
    const { variant } = await publishedProduct(prisma, { stock: 5 });
    await expect(buildQuote(prisma, [{ variantId: variant.id, quantity: 1 }], checkoutInput())).rejects.toMatchObject({ code: "commercial_conflict" });
  });
});

describe("Order lifecycle and stock ledger", () => {
  it("cancel releases the reservation; confirm commits stock with a ledger entry", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 4 });
    const a = await place(variant.id, 1);
    const b = await place(variant.id, 2);
    await transitionOrder(prisma, { orderId: a.orderId, to: "cancelled", reason: "customer asked", version: 1, actorId: null });
    await transitionOrder(prisma, { orderId: b.orderId, to: "confirmed", reason: "dev confirm", version: 1, actorId: null });
    const bal = await prisma.stockBalance.findFirstOrThrow({ where: { variantId: variant.id } });
    expect(bal).toMatchObject({ onHand: 2, reserved: 0 });
    const moves = await prisma.stockMovement.findMany({ where: { variantId: variant.id }, orderBy: { createdAt: "asc" } });
    expect(moves.map((m) => m.delta)).toEqual([4, -2]);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: b.orderId } })).paymentState).toBe("unpaid_development");
    await expect(transitionOrder(prisma, { orderId: a.orderId, to: "confirmed", reason: "x", version: 2, actorId: null })).rejects.toMatchObject({ code: "commercial_conflict" });
  });

  it("expires unpaid reservations and cancels the order", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 2 });
    const o = await place(variant.id, 2);
    await prisma.stockReservation.updateMany({ where: { orderId: o.orderId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await expireUnpaidReservations(prisma)).toEqual({ cancelled: 1 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.orderId } })).state).toBe("cancelled");
    expect((await availableByVariant(prisma, [variant.id])).get(variant.id)).toBe(2);
    expect(await expireUnpaidReservations(prisma)).toEqual({ cancelled: 0 });
  });

  it("stock ledger is append-only and balances cannot go negative", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 1 });
    const m = await prisma.stockMovement.findFirstOrThrow({ where: { variantId: variant.id } });
    await expect(prisma.stockMovement.update({ where: { id: m.id }, data: { delta: 100 } })).rejects.toThrow(/append-only/);
    await expect(prisma.stockMovement.delete({ where: { id: m.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.stockBalance.updateMany({ where: { variantId: variant.id }, data: { reserved: 2 } })).rejects.toThrow(/stock_balances_nonnegative/);
  });

  it("excludes quarantined and expired batches from available stock", async () => {
    const { variant, warehouse } = await publishedProduct(prisma);
    const good = await prisma.inventoryBatch.create({ data: { variantId: variant.id, lot: "OK", expiresAt: new Date(Date.now() + 86400_000 * 300) } });
    const quarantined = await prisma.inventoryBatch.create({ data: { variantId: variant.id, lot: "Q", status: "quarantined" } });
    const expired = await prisma.inventoryBatch.create({ data: { variantId: variant.id, lot: "EXP", expiresAt: new Date(Date.now() - 86400_000) } });
    for (const [batch, qty] of [[good, 3], [quarantined, 5], [expired, 7]] as const)
      await prisma.stockBalance.create({ data: { variantId: variant.id, warehouseId: warehouse.id, batchId: batch.id, onHand: qty } });
    expect((await availableByVariant(prisma, [variant.id])).get(variant.id)).toBe(3);
  });
});

describe("C10 — conflicting packages", () => {
  it("database refuses an approved package version without a price and approver", async () => {
    const pkg = await prisma.package.create({ data: { slug: "starter", name: "Starter" } });
    await expect(prisma.packageVersion.create({ data: { packageId: pkg.id, version: 1, approvalState: "approved" } })).rejects.toThrow(/package_versions_approved_has_price/);
  });
});

describe("C09 — importing the same source twice", () => {
  it("does not duplicate products, packages, media or observations", () => {
    const run = () =>
      execFileSync(process.execPath, ["--env-file-if-exists=../../.env", "--import", "tsx", "src/import.ts"], {
        cwd: resolve(import.meta.dirname, "../../../scripts/migration"),
        env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
        encoding: "utf8",
      });
    run();
    return (async () => {
      const counts = async () => ({
        products: await prisma.product.count(),
        variants: await prisma.variant.count(),
        packageVersions: await prisma.packageVersion.count(),
        components: await prisma.packageComponent.count(),
        media: await prisma.mediaAsset.count(),
        observations: await prisma.sourceObservation.count(),
        exceptions: await prisma.migrationException.count(),
      });
      const first = await counts();
      expect(first.products).toBe(7);
      expect(first.packageVersions).toBe(4);
      run();
      expect(await counts()).toEqual(first);
      expect(await prisma.package.count({ where: { status: "published" } })).toBe(0);
      expect(await prisma.product.count({ where: { status: "published" } })).toBe(0);
    })();
  }, 180_000);
});
