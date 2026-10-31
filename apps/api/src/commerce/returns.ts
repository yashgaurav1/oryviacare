// Returns: submitted → approved | rejected → received (units enter quarantine) → inspected (each line restocked or disposed).
// Returned goods never go straight back to sellable stock: they land in a quarantine warehouse, which is
// excluded from available-to-sell, and only an inspection decision moves them out.
import type { Db, Tx } from "@oryvia/db";
import { AppError, conflict, notFound, stale } from "../core/errors.js";
import { audit, enqueueOutbox } from "../core/outbox.js";
import { publicReference } from "./checkout.js";
import { lineProgress, lockOrder } from "./fulfilment.js";
import { getSetting } from "./pricing.js";

export const QUARANTINE_WAREHOUSE = "RETURNS-QUARANTINE";
const OPEN_RETURN = ["submitted", "approved", "received", "inspected"];

export type ReturnPolicy = { windowDays: number; label: string; isDevelopment?: boolean };

/** Delivered units of each line minus units already on a return that was not rejected. */
export async function returnableByLine(db: Db | Tx, orderId: string) {
  const [progress, existing] = await Promise.all([
    lineProgress(db, orderId),
    db.returnLine.groupBy({ by: ["orderLineId"], where: { returnRequest: { orderId, status: { in: OPEN_RETURN } } }, _sum: { quantity: true } }),
  ]);
  return new Map(progress.map((p) => [p.orderLineId, p.delivered - (existing.find((e) => e.orderLineId === p.orderLineId)?._sum.quantity ?? 0)]));
}

/** Latest delivery time among shipments carrying the given lines; the return window runs from it. */
async function lastDelivery(tx: Tx, orderId: string, orderLineIds: string[]) {
  const f = await tx.fulfilment.findFirst({
    where: { orderId, status: "delivered", lines: { some: { orderLineId: { in: orderLineIds } } } },
    orderBy: { deliveredAt: "desc" },
    select: { deliveredAt: true },
  });
  return f?.deliveredAt ?? null;
}

export async function requestReturn(
  db: Db,
  args: {
    orderId: string;
    lines: Array<{ orderLineId: string; quantity: number }>;
    reason: string;
    requester: { kind: "customer"; userId: string } | { kind: "staff"; userId: string };
    requestId?: string | null;
  },
) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, args.orderId);
    if (args.requester.kind === "customer") {
      if (order.customerId !== args.requester.userId) throw notFound("Order");
      const policy = await getSetting<ReturnPolicy>(tx, "returns.policy");
      if (!policy) throw conflict("Online return requests are not open yet. Please contact Oryvia Care support about this order.");
      const delivered = await lastDelivery(tx, order.id, args.lines.map((l) => l.orderLineId));
      if (delivered && Date.now() - delivered.getTime() > policy.value.windowDays * 86_400_000)
        throw conflict(`The ${policy.value.windowDays}-day return window for these items has closed. Please contact support.`);
    }
    const returnable = await returnableByLine(tx, order.id);
    for (const l of args.lines) {
      const max = returnable.get(l.orderLineId);
      if (max === undefined) throw new AppError(422, "validation_failed", "A line does not belong to this order", { lines: ["Unknown order line"] });
      if (l.quantity > max) throw conflict(max ? `Only ${max} delivered unit(s) of a line can be returned.` : "Only delivered items can be returned.");
    }
    const ret = await tx.returnRequest.create({
      data: {
        orderId: order.id,
        reference: publicReference("RET"),
        requesterId: args.requester.userId,
        reason: args.reason,
        lines: { create: args.lines.map((l) => ({ orderLineId: l.orderLineId, quantity: l.quantity })) },
      },
      include: { lines: true },
    });
    await tx.orderEvent.create({ data: { orderId: order.id, kind: "return_requested", actorId: args.requester.userId, note: args.reason, data: { returnId: ret.id, reference: ret.reference } } });
    if (args.requester.kind === "staff")
      await audit(tx, { actorId: args.requester.userId, action: "return.create", objectType: "return", objectId: ret.id, reason: args.reason, requestId: args.requestId ?? undefined });
    await enqueueOutbox(tx, "return.submitted", ret.id, { reference: ret.reference, orderReference: order.publicReference, email: order.email });
    return ret;
  });
}

async function lockReturn(tx: Tx, returnId: string, version: number) {
  const ret = await tx.returnRequest.findUnique({ where: { id: returnId }, include: { lines: { include: { orderLine: true } } } });
  if (!ret) throw notFound("Return");
  await lockOrder(tx, ret.orderId);
  if (ret.version !== version) throw stale();
  return ret;
}

export async function decideReturn(db: Db, args: { returnId: string; version: number; decision: "approved" | "rejected"; note: string; actorId: string; requestId?: string | null }) {
  return db.$transaction(async (tx) => {
    const ret = await lockReturn(tx, args.returnId, args.version);
    if (ret.status !== "submitted") throw conflict(`This return is already ${ret.status}.`);
    await tx.returnRequest.update({ where: { id: ret.id }, data: { status: args.decision, decisionNote: args.note, version: { increment: 1 } } });
    await tx.orderEvent.create({ data: { orderId: ret.orderId, kind: `return_${args.decision}`, actorId: args.actorId, note: args.note, data: { returnId: ret.id } } });
    await audit(tx, { actorId: args.actorId, action: `return.${args.decision}`, objectType: "return", objectId: ret.id, reason: args.note, requestId: args.requestId ?? undefined });
    await enqueueOutbox(tx, `return.${args.decision}`, ret.id, { reference: ret.reference });
    return tx.returnRequest.findUniqueOrThrow({ where: { id: ret.id }, include: { lines: true } });
  });
}

/**
 * Record physical receipt of an approved return. Each line's units go into the quarantine warehouse under the
 * batch they were shipped from (split across batches when a line shipped from more than one).
 */
export async function receiveReturn(db: Db, args: { returnId: string; version: number; note?: string; actorId: string; requestId?: string | null }) {
  return db.$transaction(async (tx) => {
    const ret = await lockReturn(tx, args.returnId, args.version);
    if (ret.status !== "approved") throw conflict(`Only approved returns can be received (this one is ${ret.status}).`);
    const quarantine = await tx.warehouse.upsert({
      where: { code: QUARANTINE_WAREHOUSE },
      create: { code: QUARANTINE_WAREHOUSE, name: "Returns quarantine (not sellable)", kind: "quarantine" },
      update: {},
    });
    if (quarantine.kind !== "quarantine") throw new Error(`Warehouse ${QUARANTINE_WAREHOUSE} exists but is not marked as quarantine`);

    for (const line of ret.lines) {
      // Batches this order line was delivered from, minus units of those batches already received on other returns.
      const shipped = await tx.fulfilmentLine.findMany({
        where: { orderLineId: line.orderLineId, fulfilment: { status: "delivered" } },
        include: { fulfilment: { select: { warehouseId: true } } },
        orderBy: { id: "asc" },
      });
      const prior = await tx.returnLine.findMany({ where: { orderLineId: line.orderLineId, id: { not: line.id }, disposition: { not: "pending" } } });
      const sources = shipped.map((s) => ({
        batchId: s.batchId,
        warehouseId: s.fulfilment.warehouseId,
        qty: s.quantity - prior.filter((p) => p.batchId === s.batchId && p.warehouseId === s.fulfilment.warehouseId).reduce((n, p) => n + p.quantity, 0),
      }));
      let need = line.quantity;
      let first = true;
      for (const src of sources.filter((s) => s.qty > 0)) {
        if (!need) break;
        const take = Math.min(need, src.qty);
        const data = { quantity: take, batchId: src.batchId, warehouseId: src.warehouseId, disposition: "quarantine" };
        if (first) await tx.returnLine.update({ where: { id: line.id }, data });
        else await tx.returnLine.create({ data: { ...data, returnRequestId: ret.id, orderLineId: line.orderLineId } });
        first = false;
        await adjustBalance(tx, line.orderLine.variantId!, quarantine.id, src.batchId, take);
        await tx.stockMovement.create({
          data: { variantId: line.orderLine.variantId!, warehouseId: quarantine.id, batchId: src.batchId, delta: take, reason: "return_received_quarantine", reference: `return:${ret.reference}`, actorId: args.actorId, note: args.note },
        });
        need -= take;
      }
      if (need) throw conflict("Delivered quantities no longer cover this return. Check the order's shipments.");
    }
    await tx.returnRequest.update({ where: { id: ret.id }, data: { status: "received", version: { increment: 1 } } });
    await tx.orderEvent.create({ data: { orderId: ret.orderId, kind: "return_received", actorId: args.actorId, note: args.note ?? null, data: { returnId: ret.id } } });
    await audit(tx, { actorId: args.actorId, action: "return.receive", objectType: "return", objectId: ret.id, reason: args.note, requestId: args.requestId ?? undefined });
    return tx.returnRequest.findUniqueOrThrow({ where: { id: ret.id }, include: { lines: true } });
  });
}

async function adjustBalance(tx: Tx, variantId: string, warehouseId: string, batchId: string | null, delta: number) {
  const balance = await tx.stockBalance.findFirst({ where: { variantId, warehouseId, batchId } });
  if (balance) await tx.stockBalance.update({ where: { id: balance.id }, data: { onHand: { increment: delta }, version: { increment: 1 } } });
  else await tx.stockBalance.create({ data: { variantId, warehouseId, batchId, onHand: delta } });
}

/** Inspection decision for one quarantined return line: back to the batch's sellable warehouse, or written off. */
export async function inspectReturnLine(db: Db, args: { returnLineId: string; disposition: "restocked" | "disposed"; note: string; actorId: string; requestId?: string | null }) {
  return db.$transaction(async (tx) => {
    const line = await tx.returnLine.findUnique({ where: { id: args.returnLineId }, include: { returnRequest: true, orderLine: true } });
    if (!line) throw notFound("Return line");
    await lockOrder(tx, line.returnRequest.orderId);
    const moved = await tx.returnLine.updateMany({ where: { id: line.id, disposition: "quarantine" }, data: { disposition: args.disposition, dispositionNote: args.note } });
    if (!moved.count) throw conflict(`This line is ${line.disposition}; only quarantined units can be inspected.`);

    const variantId = line.orderLine.variantId!;
    const quarantine = await tx.warehouse.findUniqueOrThrow({ where: { code: QUARANTINE_WAREHOUSE } });
    if (args.disposition === "restocked") {
      if (line.batchId) {
        const batch = await tx.inventoryBatch.findUniqueOrThrow({ where: { id: line.batchId } });
        if (batch.status !== "available" || (batch.expiresAt && batch.expiresAt <= new Date()))
          throw conflict(`Batch ${batch.lot} is ${batch.expiresAt && batch.expiresAt <= new Date() ? "expired" : batch.status}; these units cannot be restocked. Dispose of them instead.`);
      }
      if (!line.warehouseId) throw conflict("This line has no source warehouse recorded.");
    }
    const reference = `return:${line.returnRequest.reference}`;
    // Balance CHECK (onHand ≥ 0) guarantees the quarantine row actually holds these units.
    await adjustBalance(tx, variantId, quarantine.id, line.batchId, -line.quantity);
    await tx.stockMovement.create({ data: { variantId, warehouseId: quarantine.id, batchId: line.batchId, delta: -line.quantity, reason: `return_${args.disposition}`, reference, actorId: args.actorId, note: args.note } });
    if (args.disposition === "restocked") {
      await adjustBalance(tx, variantId, line.warehouseId!, line.batchId, line.quantity);
      await tx.stockMovement.create({ data: { variantId, warehouseId: line.warehouseId!, batchId: line.batchId, delta: line.quantity, reason: "return_restocked", reference, actorId: args.actorId, note: args.note } });
    }

    const remaining = await tx.returnLine.count({ where: { returnRequestId: line.returnRequestId, disposition: { in: ["pending", "quarantine"] } } });
    if (!remaining) await tx.returnRequest.update({ where: { id: line.returnRequestId }, data: { status: "inspected", version: { increment: 1 } } });
    else await tx.returnRequest.update({ where: { id: line.returnRequestId }, data: { version: { increment: 1 } } });
    await audit(tx, { actorId: args.actorId, action: `return.line_${args.disposition}`, objectType: "return_line", objectId: line.id, reason: args.note, requestId: args.requestId ?? undefined });
    return tx.returnRequest.findUniqueOrThrow({ where: { id: line.returnRequestId }, include: { lines: true } });
  });
}
