import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/core/db.js";
import { CartService } from "../src/commerce/cart.js";
import { CheckoutService } from "../src/commerce/checkout.js";
import { buildQuote } from "../src/commerce/pricing.js";
import { transitionOrder } from "../src/commerce/orders.js";
import { cancelLines, cancelShipment, createShipment, dispatchShipment, lineProgress, markDelivered } from "../src/commerce/fulfilment.js";
import { decideReturn, inspectReturnLine, QUARANTINE_WAREHOUSE, receiveReturn, requestReturn } from "../src/commerce/returns.js";
import { decideRefund, refundSummary, requestRefund } from "../src/commerce/refunds.js";
import { availableByVariant } from "../src/commerce/stock.js";
import { checkoutInput, publishedProduct, resetDb, shippingRule, stockBatch, testUser } from "./fixtures.js";

const carts = new CartService(prisma);
const checkout = new CheckoutService(prisma);
const DAY = 86_400_000;

async function place(variantId: string, quantity: number, customerId: string | null = null) {
  const { view } = await carts.addItem({ userId: customerId, guestToken: null }, variantId, quantity);
  const items = [{ variantId, quantity }];
  const input = checkoutInput();
  const q = await buildQuote(prisma, items, input);
  const r = await checkout.placeOrder({ cartId: view.id!, cartItems: items, input: { quoteHash: q.hash, paymentMethod: "dev_manual", checkout: input }, customerId, requestId: null });
  return r.orderId;
}

const order = (id: string) => prisma.order.findUniqueOrThrow({ where: { id }, include: { lines: true } });

async function confirmed(variantId: string, quantity: number, customerId: string | null = null) {
  const id = await place(variantId, quantity, customerId);
  await transitionOrder(prisma, { orderId: id, to: "confirmed", reason: "test confirm", version: 1, actorId: null });
  return order(id);
}

/** Ship `quantity` of the order's first line through to delivered. */
async function shipAndDeliver(orderId: string, quantity: number, actorId: string) {
  const o = await order(orderId);
  const [f] = await createShipment(prisma, { orderId, version: o.version, lines: [{ orderLineId: o.lines[0].id, quantity }], actorId });
  await dispatchShipment(prisma, { fulfilmentId: f.id, carrier: "Test Courier", trackingRef: "TC123", actorId });
  await markDelivered(prisma, { fulfilmentId: f.id, reason: "Courier confirmed delivery", actorId });
  return f;
}

const sellableOnHand = async (variantId: string) =>
  (await prisma.stockBalance.findMany({ where: { variantId, warehouse: { kind: "sellable" } } })).reduce((n, b) => n + b.onHand, 0);

let staff: { id: string };
beforeEach(async () => {
  await resetDb(prisma);
  await shippingRule(prisma);
  staff = await testUser(prisma, "ops");
});
afterAll(async () => prisma.$disconnect());

describe("Fulfilment", () => {
  it("ships partially, assigns the earliest-expiring batch, and derives fulfilment state", async () => {
    const { variant } = await publishedProduct(prisma);
    const late = await stockBatch(prisma, variant.id, "LATE", 5, new Date(Date.now() + 400 * DAY));
    const early = await stockBatch(prisma, variant.id, "EARLY", 2, new Date(Date.now() + 100 * DAY));
    const o = await confirmed(variant.id, 3);

    const [f1] = await createShipment(prisma, { orderId: o.id, version: o.version, lines: [{ orderLineId: o.lines[0].id, quantity: 2 }], actorId: staff.id });
    expect(f1.lines.map((l) => [l.batchId, l.quantity])).toEqual([[early.id, 2]]);
    expect((await order(o.id)).fulfilmentState).toBe("packing");

    await dispatchShipment(prisma, { fulfilmentId: f1.id, carrier: "Test Courier", actorId: staff.id });
    expect((await order(o.id)).fulfilmentState).toBe("partially_shipped");

    // Only one unit is still open: asking for two is refused.
    const v = (await order(o.id)).version;
    await expect(createShipment(prisma, { orderId: o.id, version: v, lines: [{ orderLineId: o.lines[0].id, quantity: 2 }], actorId: staff.id })).rejects.toMatchObject({ code: "commercial_conflict" });
    const [f2] = await createShipment(prisma, { orderId: o.id, version: v, lines: [{ orderLineId: o.lines[0].id, quantity: 1 }], actorId: staff.id });
    expect(f2.lines.map((l) => l.batchId)).toEqual([late.id]);

    await dispatchShipment(prisma, { fulfilmentId: f2.id, carrier: "Test Courier", actorId: staff.id });
    expect((await order(o.id)).fulfilmentState).toBe("shipped");

    // Cannot close while anything is undelivered.
    await expect(transitionOrder(prisma, { orderId: o.id, to: "closed", reason: "done", version: (await order(o.id)).version, actorId: staff.id })).rejects.toMatchObject({ code: "commercial_conflict" });
    await markDelivered(prisma, { fulfilmentId: f1.id, reason: "delivered", actorId: staff.id });
    await markDelivered(prisma, { fulfilmentId: f2.id, reason: "delivered", actorId: staff.id });
    expect((await order(o.id)).fulfilmentState).toBe("delivered");
    await transitionOrder(prisma, { orderId: o.id, to: "closed", reason: "done", version: (await order(o.id)).version, actorId: staff.id });

    // Shipping does not touch stock again: it left sellable balances at confirmation.
    expect(await sellableOnHand(variant.id)).toBe(4);
  });

  it("refuses shipments for orders that are not confirmed, and stale versions", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 5 });
    const id = await place(variant.id, 1);
    const o = await order(id);
    await expect(createShipment(prisma, { orderId: id, version: o.version, lines: [{ orderLineId: o.lines[0].id, quantity: 1 }], actorId: staff.id })).rejects.toMatchObject({ code: "commercial_conflict" });
    const c = await confirmed(variant.id, 1);
    await expect(createShipment(prisma, { orderId: c.id, version: c.version - 1, lines: [{ orderLineId: c.lines[0].id, quantity: 1 }], actorId: staff.id })).rejects.toMatchObject({ code: "stale_version" });
  });

  it("two staff creating the same shipment at once produce one shipment", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 5 });
    const o = await confirmed(variant.id, 2);
    const run = () => createShipment(prisma, { orderId: o.id, version: o.version, lines: [{ orderLineId: o.lines[0].id, quantity: 2 }], actorId: staff.id });
    const results = await Promise.allSettled([run(), run(), run()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.fulfilment.count({ where: { orderId: o.id } })).toBe(1);
  });

  it("voiding a packing shipment reopens its units; dispatch after void is refused", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 5 });
    const o = await confirmed(variant.id, 2);
    const [f] = await createShipment(prisma, { orderId: o.id, version: o.version, lines: [{ orderLineId: o.lines[0].id, quantity: 2 }], actorId: staff.id });
    await cancelShipment(prisma, { fulfilmentId: f.id, reason: "packed wrong item", actorId: staff.id });
    expect((await lineProgress(prisma, o.id))[0].open).toBe(2);
    expect((await order(o.id)).fulfilmentState).toBe("unfulfilled");
    await expect(dispatchShipment(prisma, { fulfilmentId: f.id, carrier: "X Courier", actorId: staff.id })).rejects.toMatchObject({ code: "commercial_conflict" });
  });
});

describe("Cancellation after confirmation", () => {
  it("cancelling a confirmed order restores committed stock to its batch", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 5 });
    const o = await confirmed(variant.id, 3);
    expect(await sellableOnHand(variant.id)).toBe(2);
    await createShipment(prisma, { orderId: o.id, version: o.version, lines: [{ orderLineId: o.lines[0].id, quantity: 1 }], actorId: staff.id });
    await transitionOrder(prisma, { orderId: o.id, to: "cancelled", reason: "customer cancelled", version: (await order(o.id)).version, actorId: staff.id });
    expect(await sellableOnHand(variant.id)).toBe(5);
    expect((await availableByVariant(prisma, [variant.id])).get(variant.id)).toBe(5);
    const after = await order(o.id);
    expect(after.fulfilmentState).toBe("cancelled");
    expect(await prisma.fulfilment.count({ where: { orderId: o.id, status: "packing" } })).toBe(0);
    const ledger = await prisma.stockMovement.aggregate({ where: { variantId: variant.id }, _sum: { delta: true } });
    expect(ledger._sum.delta).toBe(5); // ledger and balances agree
  });

  it("refuses to cancel a confirmed order once anything is dispatched", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 5 });
    const o = await confirmed(variant.id, 2);
    const [f] = await createShipment(prisma, { orderId: o.id, version: o.version, lines: [{ orderLineId: o.lines[0].id, quantity: 1 }], actorId: staff.id });
    await dispatchShipment(prisma, { fulfilmentId: f.id, carrier: "Test Courier", actorId: staff.id });
    await expect(transitionOrder(prisma, { orderId: o.id, to: "cancelled", reason: "x", version: (await order(o.id)).version, actorId: staff.id })).rejects.toMatchObject({ code: "commercial_conflict" });
  });

  it("cancels unshipped units line by line and never more than are open", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 5 });
    const o = await confirmed(variant.id, 3);
    await createShipment(prisma, { orderId: o.id, version: o.version, lines: [{ orderLineId: o.lines[0].id, quantity: 2 }], actorId: staff.id });
    const v = (await order(o.id)).version;
    await expect(cancelLines(prisma, { orderId: o.id, version: v, lines: [{ orderLineId: o.lines[0].id, quantity: 2 }], reason: "short", actorId: staff.id })).rejects.toMatchObject({ code: "commercial_conflict" });
    await cancelLines(prisma, { orderId: o.id, version: v, lines: [{ orderLineId: o.lines[0].id, quantity: 1 }], reason: "customer changed mind", actorId: staff.id });
    expect((await order(o.id)).lines[0].cancelledQty).toBe(1);
    expect(await sellableOnHand(variant.id)).toBe(3);
  });
});

describe("Returns and quarantine", () => {
  async function deliveredOrder(customerId: string, qty = 2) {
    const { variant } = await publishedProduct(prisma, { stock: 10 });
    const o = await confirmed(variant.id, qty, customerId);
    await shipAndDeliver(o.id, qty, staff.id);
    return { o, variant };
  }

  it("customer self-service returns stay closed until a return policy exists", async () => {
    const customer = await testUser(prisma, "cust");
    const { o } = await deliveredOrder(customer.id);
    await expect(requestReturn(prisma, { orderId: o.id, lines: [{ orderLineId: o.lines[0].id, quantity: 1 }], reason: "damaged", requester: { kind: "customer", userId: customer.id } })).rejects.toMatchObject({
      code: "commercial_conflict",
    });
  });

  it("only the owner can request, only delivered units, and never twice for the same unit", async () => {
    await prisma.storeSetting.create({ data: { key: "returns.policy", value: { windowDays: 7, label: "test" } } });
    const customer = await testUser(prisma, "cust");
    const stranger = await testUser(prisma, "other");
    const { o } = await deliveredOrder(customer.id);
    const line = o.lines[0].id;
    await expect(requestReturn(prisma, { orderId: o.id, lines: [{ orderLineId: line, quantity: 1 }], reason: "damaged", requester: { kind: "customer", userId: stranger.id } })).rejects.toMatchObject({ code: "not_found" });
    await expect(requestReturn(prisma, { orderId: o.id, lines: [{ orderLineId: line, quantity: 3 }], reason: "damaged", requester: { kind: "customer", userId: customer.id } })).rejects.toMatchObject({ code: "commercial_conflict" });
    const results = await Promise.allSettled([1, 2].map(() => requestReturn(prisma, { orderId: o.id, lines: [{ orderLineId: line, quantity: 2 }], reason: "damaged", requester: { kind: "customer", userId: customer.id } })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("closes the window after the configured days", async () => {
    await prisma.storeSetting.create({ data: { key: "returns.policy", value: { windowDays: 7, label: "test" } } });
    const customer = await testUser(prisma, "cust");
    const { o } = await deliveredOrder(customer.id);
    await prisma.fulfilment.updateMany({ where: { orderId: o.id }, data: { deliveredAt: new Date(Date.now() - 8 * DAY) } });
    await expect(requestReturn(prisma, { orderId: o.id, lines: [{ orderLineId: o.lines[0].id, quantity: 1 }], reason: "late", requester: { kind: "customer", userId: customer.id } })).rejects.toMatchObject({
      code: "commercial_conflict",
    });
  });

  it("received units sit in quarantine (not sellable) until inspection restocks or disposes them", async () => {
    const customer = await testUser(prisma, "cust");
    const { o, variant } = await deliveredOrder(customer.id);
    const sellableBefore = await sellableOnHand(variant.id);
    let ret = await requestReturn(prisma, { orderId: o.id, lines: [{ orderLineId: o.lines[0].id, quantity: 2 }], reason: "wrong shade", requester: { kind: "staff", userId: staff.id } });
    await expect(receiveReturn(prisma, { returnId: ret.id, version: ret.version, actorId: staff.id })).rejects.toMatchObject({ code: "commercial_conflict" }); // not approved yet
    ret = await decideReturn(prisma, { returnId: ret.id, version: ret.version, decision: "approved", note: "within policy", actorId: staff.id });
    ret = await receiveReturn(prisma, { returnId: ret.id, version: ret.version, actorId: staff.id });
    expect(ret.status).toBe("received");

    const q = await prisma.warehouse.findUniqueOrThrow({ where: { code: QUARANTINE_WAREHOUSE } });
    expect(q.kind).toBe("quarantine");
    const qBal = await prisma.stockBalance.findMany({ where: { variantId: variant.id, warehouseId: q.id } });
    expect(qBal.reduce((n, b) => n + b.onHand, 0)).toBe(2);
    expect(await sellableOnHand(variant.id)).toBe(sellableBefore);
    expect((await availableByVariant(prisma, [variant.id])).get(variant.id)).toBe(sellableBefore);

    // Split the single line into restock 1 / dispose 1 by returning in two lines is not possible; inspect one line.
    const [line] = ret.lines;
    await inspectReturnLine(prisma, { returnLineId: line.id, disposition: "restocked", note: "sealed, undamaged", actorId: staff.id });
    expect(await sellableOnHand(variant.id)).toBe(sellableBefore + 2);
    await expect(inspectReturnLine(prisma, { returnLineId: line.id, disposition: "disposed", note: "again", actorId: staff.id })).rejects.toMatchObject({ code: "commercial_conflict" });
    expect((await prisma.returnRequest.findUniqueOrThrow({ where: { id: ret.id } })).status).toBe("inspected");
  });

  it("refuses to restock units from a recalled batch; disposal writes them off", async () => {
    const customer = await testUser(prisma, "cust");
    const { variant } = await publishedProduct(prisma);
    const batch = await stockBatch(prisma, variant.id, "R1", 5, new Date(Date.now() + 200 * DAY));
    const o = await confirmed(variant.id, 1, customer.id);
    await shipAndDeliver(o.id, 1, staff.id);
    let ret = await requestReturn(prisma, { orderId: o.id, lines: [{ orderLineId: o.lines[0].id, quantity: 1 }], reason: "recall", requester: { kind: "staff", userId: staff.id } });
    ret = await decideReturn(prisma, { returnId: ret.id, version: ret.version, decision: "approved", note: "recall", actorId: staff.id });
    ret = await receiveReturn(prisma, { returnId: ret.id, version: ret.version, actorId: staff.id });
    expect(ret.lines[0].batchId).toBe(batch.id);
    await prisma.inventoryBatch.update({ where: { id: batch.id }, data: { status: "recalled" } });
    await expect(inspectReturnLine(prisma, { returnLineId: ret.lines[0].id, disposition: "restocked", note: "x", actorId: staff.id })).rejects.toMatchObject({ code: "commercial_conflict" });
    await inspectReturnLine(prisma, { returnLineId: ret.lines[0].id, disposition: "disposed", note: "recalled batch destroyed", actorId: staff.id });
    const all = await prisma.stockBalance.findMany({ where: { variantId: variant.id } });
    expect(all.reduce((n, b) => n + b.onHand, 0)).toBe(4);
    const ledger = await prisma.stockMovement.aggregate({ where: { variantId: variant.id }, _sum: { delta: true } });
    expect(ledger._sum.delta).toBe(4);
  });
});

describe("Refunds", () => {
  it("needs a second person to approve and never exceeds the payment", async () => {
    const maker = staff;
    const checker = await testUser(prisma, "checker");
    const { variant } = await publishedProduct(prisma, { stock: 5, unitPaise: 50000 });
    const o = await confirmed(variant.id, 1);
    const total = o.totalPaise;

    const r1 = await requestRefund(prisma, { orderId: o.id, amountPaise: total - 100, reason: "goodwill", actorId: maker.id });
    await expect(requestRefund(prisma, { orderId: o.id, amountPaise: 101, reason: "too much", actorId: maker.id })).rejects.toMatchObject({ code: "commercial_conflict" });
    await expect(decideRefund(prisma, { refundId: r1.id, decision: "approved", note: "ok", actorId: maker.id, actorTwoFactor: false })).rejects.toMatchObject({ code: "forbidden" });
    const done = await decideRefund(prisma, { refundId: r1.id, decision: "approved", note: "checked", actorId: checker.id, actorTwoFactor: false });
    expect(done.state).toBe("recorded_development");
    await expect(decideRefund(prisma, { refundId: r1.id, decision: "approved", note: "again", actorId: checker.id, actorTwoFactor: false })).rejects.toMatchObject({ code: "commercial_conflict" });

    const r2 = await requestRefund(prisma, { orderId: o.id, amountPaise: 100, reason: "rest", actorId: maker.id });
    await decideRefund(prisma, { refundId: r2.id, decision: "rejected", note: "not owed", actorId: checker.id, actorTwoFactor: false });
    expect((await refundSummary(prisma, o.id)).refundablePaise).toBe(100); // rejected refunds free the balance
  });

  it("concurrent refund requests cannot together exceed the payment", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 5, unitPaise: 50000 });
    const o = await confirmed(variant.id, 1);
    const half = Math.floor(o.totalPaise / 2) + 1;
    const results = await Promise.allSettled([1, 2, 3].map(() => requestRefund(prisma, { orderId: o.id, amountPaise: half, reason: "race", actorId: staff.id })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("refuses refunds when no payment was captured, and approval of real-money refunds without 2FA", async () => {
    const { variant } = await publishedProduct(prisma, { stock: 5 });
    const o = await confirmed(variant.id, 1);
    // Simulate a provider order that was never captured.
    await prisma.order.update({ where: { id: o.id }, data: { isDevelopmentOrder: false } });
    await prisma.paymentAttempt.updateMany({ where: { orderId: o.id }, data: { provider: "razorpay", state: "failed" } });
    await expect(requestRefund(prisma, { orderId: o.id, amountPaise: 100, reason: "x", actorId: staff.id })).rejects.toMatchObject({ code: "commercial_conflict" });

    await prisma.paymentAttempt.updateMany({ where: { orderId: o.id }, data: { state: "captured", externalId: "pay_test_1" } });
    const r = await requestRefund(prisma, { orderId: o.id, amountPaise: 100, reason: "x", actorId: staff.id });
    const checker = await testUser(prisma, "checker");
    await expect(decideRefund(prisma, { refundId: r.id, decision: "approved", note: "x", actorId: checker.id, actorTwoFactor: false })).rejects.toMatchObject({ code: "forbidden" });
    // With 2FA the provider is still not configured: refused honestly, refund stays requested.
    await expect(decideRefund(prisma, { refundId: r.id, decision: "approved", note: "x", actorId: checker.id, actorTwoFactor: true })).rejects.toMatchObject({ code: "integration_unavailable" });
    expect((await prisma.refund.findUniqueOrThrow({ where: { id: r.id } })).state).toBe("requested");
  });
});
