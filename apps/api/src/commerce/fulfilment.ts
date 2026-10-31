// Fulfilment: shipments against confirmed orders, line-level cancellation, and the derived order fulfilment state.
// Stock leaves sellable balances when an order is confirmed (commitReservations). The ledger rows tagged
// `order:<id>` therefore say exactly which batches this order holds; a shipment draws its batch lines from
// that pool (already FEFO from reservation time), and cancellations put unshipped units back into the same batch.
import type { Db, Tx } from "@oryvia/db";
import { AppError, conflict, notFound, stale } from "../core/errors.js";
import { audit, enqueueOutbox } from "../core/outbox.js";

/** Ledger reasons that move units between sellable stock and an order's committed pool. */
const ORDER_POOL_REASONS = ["sale_committed", "order_line_cancelled", "order_cancelled_restock"];
const ACTIVE = ["packing", "shipped", "delivered"];

type PoolEntry = { variantId: string; warehouseId: string; batchId: string | null; qty: number; expiresAt: Date | null };

/** Lock the order row so every fulfilment/return/refund change on one order is serialized. */
export async function lockOrder(tx: Tx, orderId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
  if (!rows.length) throw notFound("Order");
  return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } });
}

/** Units committed to the order and not yet placed on a shipment, per variant/warehouse/batch. */
async function unshippedPool(tx: Tx, orderId: string): Promise<PoolEntry[]> {
  const rows = await tx.$queryRaw<Array<{ variantId: string; warehouseId: string; batchId: string | null; qty: bigint; expiresAt: Date | null }>>`
    WITH committed AS (
      SELECT m."variantId", m."warehouseId", m."batchId", -SUM(m.delta) AS qty
      FROM stock_movements m
      WHERE m.reference = ${`order:${orderId}`} AND m.reason = ANY(${ORDER_POOL_REASONS}::text[])
      GROUP BY 1, 2, 3
    ), shipped AS (
      SELECT ol."variantId", f."warehouseId", fl."batchId", SUM(fl.quantity) AS qty
      FROM fulfilment_lines fl
      JOIN fulfilments f ON f.id = fl."fulfilmentId" AND f.status = ANY(${ACTIVE}::text[])
      JOIN order_lines ol ON ol.id = fl."orderLineId"
      WHERE f."orderId" = ${orderId}
      GROUP BY 1, 2, 3
    )
    SELECT c."variantId", c."warehouseId", c."batchId", c.qty - COALESCE(s.qty, 0) AS qty, ib."expiresAt"
    FROM committed c
    LEFT JOIN shipped s ON s."variantId" = c."variantId" AND s."warehouseId" = c."warehouseId" AND s."batchId" IS NOT DISTINCT FROM c."batchId"
    LEFT JOIN inventory_batches ib ON ib.id = c."batchId"
    WHERE c.qty - COALESCE(s.qty, 0) > 0
    ORDER BY ib."expiresAt" ASC NULLS LAST, c."batchId"`;
  return rows.map((r) => ({ ...r, qty: Number(r.qty) }));
}

export type LineProgress = { orderLineId: string; variantId: string | null; ordered: number; cancelled: number; onShipments: number; shipped: number; delivered: number; open: number };

/** Per-line quantities: open = ordered − cancelled − on any active shipment. */
export async function lineProgress(db: Db | Tx, orderId: string): Promise<LineProgress[]> {
  const lines = await db.orderLine.findMany({
    where: { orderId },
    include: { fulfilmentLines: { include: { fulfilment: { select: { status: true } } } } },
    orderBy: { id: "asc" },
  });
  return lines.map((l) => {
    const active = l.fulfilmentLines.filter((fl) => ACTIVE.includes(fl.fulfilment.status));
    const sum = (statuses: string[]) => active.filter((fl) => statuses.includes(fl.fulfilment.status)).reduce((n, fl) => n + fl.quantity, 0);
    const onShipments = sum(ACTIVE);
    return {
      orderLineId: l.id,
      variantId: l.variantId,
      ordered: l.quantity,
      cancelled: l.cancelledQty,
      onShipments,
      shipped: sum(["shipped", "delivered"]),
      delivered: sum(["delivered"]),
      open: l.variantId ? l.quantity - l.cancelledQty - onShipments : 0,
    };
  });
}

/** Order-level summary derived from line progress. Stored on the order for listing and filtering. */
export function deriveFulfilmentState(progress: LineProgress[], hasPacking: boolean) {
  const physical = progress.filter((p) => p.variantId);
  const live = physical.reduce((n, p) => n + p.ordered - p.cancelled, 0);
  if (physical.length && live === 0) return "cancelled";
  const shipped = physical.reduce((n, p) => n + p.shipped, 0);
  const delivered = physical.reduce((n, p) => n + p.delivered, 0);
  if (live > 0 && delivered === live) return "delivered";
  if (live > 0 && shipped === live) return "shipped";
  if (shipped > 0) return "partially_shipped";
  if (hasPacking) return "packing";
  return "unfulfilled";
}

async function refreshFulfilmentState(tx: Tx, orderId: string, actorId: string | null, note: string) {
  const [progress, packing, order] = await Promise.all([
    lineProgress(tx, orderId),
    tx.fulfilment.count({ where: { orderId, status: "packing" } }),
    tx.order.findUniqueOrThrow({ where: { id: orderId } }),
  ]);
  const next = deriveFulfilmentState(progress, packing > 0);
  await tx.order.update({ where: { id: orderId }, data: { fulfilmentState: next, version: { increment: 1 } } });
  if (next !== order.fulfilmentState)
    await tx.orderEvent.create({ data: { orderId, kind: "fulfilment_changed", fromState: order.fulfilmentState, toState: next, actorId, note } });
  return next;
}

function requireQuantities(progress: LineProgress[], lines: Array<{ orderLineId: string; quantity: number }>, verb: string) {
  for (const req of lines) {
    const p = progress.find((x) => x.orderLineId === req.orderLineId);
    if (!p) throw new AppError(422, "validation_failed", "A line does not belong to this order", { lines: ["Unknown order line"] });
    if (!p.variantId) throw conflict(`Package header lines cannot be ${verb} directly; use their component lines.`);
    if (req.quantity > p.open) throw conflict(`Only ${p.open} unit(s) of a line can still be ${verb}.`);
  }
}

/** Create one shipment per source warehouse in `packing` status, assigning committed batches FEFO. */
export async function createShipment(
  db: Db,
  args: { orderId: string; version: number; lines: Array<{ orderLineId: string; quantity: number }>; note?: string; actorId: string; requestId?: string | null },
) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, args.orderId);
    if (order.version !== args.version) throw stale();
    if (order.state !== "confirmed") throw conflict(`Only confirmed orders can be shipped (this order is ${order.state}).`);
    const progress = await lineProgress(tx, order.id);
    requireQuantities(progress, args.lines, "shipped");

    const pool = await unshippedPool(tx, order.id);
    const byWarehouse = new Map<string, Array<{ orderLineId: string; batchId: string | null; quantity: number }>>();
    for (const req of args.lines) {
      const variantId = order.lines.find((l) => l.id === req.orderLineId)!.variantId!;
      let need = req.quantity;
      for (const entry of pool.filter((e) => e.variantId === variantId && e.qty > 0)) {
        if (!need) break;
        const take = Math.min(need, entry.qty);
        entry.qty -= take;
        need -= take;
        const list = byWarehouse.get(entry.warehouseId) ?? [];
        list.push({ orderLineId: req.orderLineId, batchId: entry.batchId, quantity: take });
        byWarehouse.set(entry.warehouseId, list);
      }
      // Open quantity said these units exist; a gap means the committed ledger and the order disagree.
      if (need) throw new AppError(409, "stock_unavailable", "The committed stock for this order does not cover the requested quantity. Check the inventory ledger.");
    }

    const created = [];
    for (const [warehouseId, lines] of byWarehouse) {
      created.push(await tx.fulfilment.create({ data: { orderId: order.id, warehouseId, status: "packing", lines: { create: lines } }, include: { lines: true } }));
    }
    await tx.orderEvent.create({ data: { orderId: order.id, kind: "shipment_created", actorId: args.actorId, note: args.note ?? null, data: { fulfilmentIds: created.map((f) => f.id) } } });
    await audit(tx, { actorId: args.actorId, action: "fulfilment.create", objectType: "order", objectId: order.id, requestId: args.requestId ?? undefined, data: { lines: args.lines } });
    await refreshFulfilmentState(tx, order.id, args.actorId, "Shipment created");
    return created;
  });
}

async function moveShipment(
  db: Db,
  args: { fulfilmentId: string; from: string; to: "shipped" | "delivered" | "cancelled"; actorId: string; reason: string; data?: Record<string, unknown>; requestId?: string | null },
) {
  return db.$transaction(async (tx) => {
    const f = await tx.fulfilment.findUnique({ where: { id: args.fulfilmentId } });
    if (!f) throw notFound("Shipment");
    const order = await lockOrder(tx, f.orderId);
    const moved = await tx.fulfilment.updateMany({ where: { id: f.id, status: args.from }, data: { status: args.to, ...(args.data ?? {}) } });
    if (!moved.count) throw conflict(`This shipment is ${f.status}; it cannot become ${args.to}.`);
    if (order.state !== "confirmed" && args.to !== "delivered") throw conflict(`The order is ${order.state}.`);
    await tx.orderEvent.create({ data: { orderId: order.id, kind: `shipment_${args.to}`, actorId: args.actorId, note: args.reason, data: { fulfilmentId: f.id } } });
    await audit(tx, { actorId: args.actorId, action: `fulfilment.${args.to}`, objectType: "fulfilment", objectId: f.id, reason: args.reason, requestId: args.requestId ?? undefined });
    await enqueueOutbox(tx, `shipment.${args.to}`, order.id, { reference: order.publicReference, email: order.email, fulfilmentId: f.id });
    await refreshFulfilmentState(tx, order.id, args.actorId, args.reason);
    return tx.fulfilment.findUniqueOrThrow({ where: { id: f.id }, include: { lines: true } });
  });
}

export const dispatchShipment = (db: Db, a: { fulfilmentId: string; carrier: string; trackingRef?: string; actorId: string; requestId?: string | null }) =>
  moveShipment(db, {
    fulfilmentId: a.fulfilmentId,
    from: "packing",
    to: "shipped",
    actorId: a.actorId,
    requestId: a.requestId,
    reason: `Dispatched with ${a.carrier}${a.trackingRef ? ` (${a.trackingRef})` : ""}`,
    data: { carrier: a.carrier, trackingRef: a.trackingRef || null, shippedAt: new Date() },
  });

export const markDelivered = (db: Db, a: { fulfilmentId: string; reason: string; actorId: string; requestId?: string | null }) =>
  moveShipment(db, { fulfilmentId: a.fulfilmentId, from: "shipped", to: "delivered", actorId: a.actorId, requestId: a.requestId, reason: a.reason, data: { deliveredAt: new Date() } });

/** Void a shipment that has not left the warehouse; its units become open again. */
export const cancelShipment = (db: Db, a: { fulfilmentId: string; reason: string; actorId: string; requestId?: string | null }) =>
  moveShipment(db, { fulfilmentId: a.fulfilmentId, from: "packing", to: "cancelled", actorId: a.actorId, requestId: a.requestId, reason: a.reason });

/** Put unshipped committed units back into sellable stock (same batch), writing ledger rows tagged to the order. */
async function restockFromPool(tx: Tx, orderId: string, variantId: string | null, quantity: number | "all", reason: string, actorId: string | null) {
  const pool = (await unshippedPool(tx, orderId)).filter((e) => variantId === null || e.variantId === variantId).reverse(); // latest-expiring back first
  let need = quantity === "all" ? Number.POSITIVE_INFINITY : quantity;
  for (const e of pool) {
    if (need <= 0) break;
    const take = Math.min(need, e.qty);
    const balance = await tx.stockBalance.findFirst({ where: { variantId: e.variantId, warehouseId: e.warehouseId, batchId: e.batchId } });
    if (balance) await tx.stockBalance.update({ where: { id: balance.id }, data: { onHand: { increment: take }, version: { increment: 1 } } });
    else await tx.stockBalance.create({ data: { variantId: e.variantId, warehouseId: e.warehouseId, batchId: e.batchId, onHand: take } });
    await tx.stockMovement.create({ data: { variantId: e.variantId, warehouseId: e.warehouseId, batchId: e.batchId, delta: take, reason, reference: `order:${orderId}`, actorId } });
    need -= take;
  }
  if (quantity !== "all" && need > 0) throw new AppError(409, "stock_unavailable", "The committed stock for this order does not cover the cancelled quantity.");
}

/** Cancel unshipped units on a confirmed order. Stock returns to its batch; a captured payment is flagged for refund. */
export async function cancelLines(
  db: Db,
  args: { orderId: string; version: number; lines: Array<{ orderLineId: string; quantity: number }>; reason: string; actorId: string; requestId?: string | null },
) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, args.orderId);
    if (order.version !== args.version) throw stale();
    if (order.state !== "confirmed") throw conflict("Line cancellation applies to confirmed orders. Cancel a placed order as a whole.");
    requireQuantities(await lineProgress(tx, order.id), args.lines, "cancelled");
    for (const req of args.lines) {
      const line = order.lines.find((l) => l.id === req.orderLineId)!;
      await tx.orderLine.update({ where: { id: line.id }, data: { cancelledQty: { increment: req.quantity } } });
      await restockFromPool(tx, order.id, line.variantId, req.quantity, "order_line_cancelled", args.actorId);
    }
    if (order.paymentState === "captured" || order.paymentState === "partially_refunded")
      await tx.order.update({ where: { id: order.id }, data: { paymentState: "refund_required" } });
    await tx.orderEvent.create({ data: { orderId: order.id, kind: "lines_cancelled", actorId: args.actorId, note: args.reason, data: { lines: args.lines } } });
    await audit(tx, { actorId: args.actorId, action: "order.cancel_lines", objectType: "order", objectId: order.id, reason: args.reason, requestId: args.requestId ?? undefined, data: { lines: args.lines } });
    await enqueueOutbox(tx, "order.lines_cancelled", order.id, { reference: order.publicReference, email: order.email });
    await refreshFulfilmentState(tx, order.id, args.actorId, args.reason);
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });
}

/**
 * Called inside transitionOrder when a confirmed order is cancelled as a whole:
 * refuses if anything has left the warehouse, voids packing shipments, and restocks every unshipped unit.
 */
export async function unwindConfirmedOrder(tx: Tx, orderId: string, actorId: string | null) {
  const left = await tx.fulfilment.count({ where: { orderId, status: { in: ["shipped", "delivered"] } } });
  if (left) throw conflict("Part of this order has already been dispatched. Cancel the remaining lines instead, and handle shipped units as a return.");
  await tx.fulfilment.updateMany({ where: { orderId, status: "packing" }, data: { status: "cancelled" } });
  await restockFromPool(tx, orderId, null, "all", "order_cancelled_restock", actorId);
  await tx.order.update({ where: { id: orderId }, data: { fulfilmentState: "cancelled" } });
}

/** An order can be closed only when every live unit is delivered (or cancelled). */
export async function assertFulfilmentComplete(tx: Tx, orderId: string) {
  const [progress, inFlight] = await Promise.all([lineProgress(tx, orderId), tx.fulfilment.count({ where: { orderId, status: { in: ["packing", "shipped"] } } })]);
  const undelivered = progress.reduce((n, p) => n + (p.variantId ? p.ordered - p.cancelled - p.delivered : 0), 0);
  if (undelivered > 0 || inFlight > 0) throw conflict("This order still has undelivered units. Close it after every shipment is delivered or the remaining lines are cancelled.");
}
