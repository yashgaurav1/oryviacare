// Explicit order state machine. Payment, fulfilment and order state are separate fields.
import type { Db } from "@oryvia/db";
import { AppError, conflict, stale } from "../core/errors.js";
import { audit, enqueueOutbox } from "../core/outbox.js";
import { assertFulfilmentComplete, lockOrder, unwindConfirmedOrder } from "./fulfilment.js";
import { commitReservations, releaseReservations } from "./stock.js";

const ALLOWED: Record<string, string[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["cancelled", "closed"],
  cancelled: [],
  closed: [],
  draft: ["placed", "cancelled"],
};

export async function transitionOrder(
  db: Db,
  args: { orderId: string; to: "confirmed" | "cancelled" | "closed"; reason: string; version: number; actorId: string | null; requestId?: string | null; system?: boolean },
) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, args.orderId);
    if (order.version !== args.version) throw stale();
    if (!ALLOWED[order.state]?.includes(args.to)) throw conflict(`An order that is ${order.state} cannot become ${args.to}`);

    let paymentState = order.paymentState;
    if (args.to === "confirmed") {
      const paid = order.paymentState === "captured";
      if (!paid && !order.isDevelopmentOrder)
        throw conflict("Only orders with a verified captured payment can be confirmed. Cash-on-delivery is not enabled.");
      const committed = await commitReservations(tx, order.id, args.actorId);
      if (!committed) throw new AppError(409, "stock_unavailable", "This order's stock reservation has expired. Stock must be re-reserved before confirming.");
      if (order.isDevelopmentOrder) paymentState = "unpaid_development";
    }
    if (args.to === "cancelled") {
      if (order.state === "confirmed") await unwindConfirmedOrder(tx, order.id, args.actorId);
      await releaseReservations(tx, order.id, args.reason);
      if (order.paymentState === "captured") paymentState = "refund_required";
      else if (order.paymentState === "awaiting_payment") paymentState = "not_paid";
    }

    if (args.to === "closed") await assertFulfilmentComplete(tx, order.id);

    const updated = await tx.order.updateMany({
      where: { id: order.id, version: order.version },
      data: { state: args.to, paymentState, version: { increment: 1 } },
    });
    if (!updated.count) throw stale();
    await tx.orderEvent.create({ data: { orderId: order.id, kind: "state_changed", fromState: order.state, toState: args.to, actorId: args.actorId, note: args.reason } });
    if (!args.system) await audit(tx, { actorId: args.actorId, action: `order.${args.to}`, objectType: "order", objectId: order.id, reason: args.reason, requestId: args.requestId ?? undefined });
    await enqueueOutbox(tx, `order.${args.to}`, order.id, { reference: order.publicReference, email: order.email });
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });
}

/** Worker job: cancel unpaid orders whose reservation window lapsed and release their stock. */
export async function expireUnpaidReservations(db: Db, now = new Date()) {
  const expired = await db.stockReservation.findMany({
    where: { status: "active", expiresAt: { lt: now }, order: { state: "placed", paymentState: "awaiting_payment" } },
    select: { orderId: true },
    distinct: ["orderId"],
    take: 200,
  });
  let cancelled = 0;
  for (const { orderId } of expired) {
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    try {
      await transitionOrder(db, { orderId, to: "cancelled", reason: "Payment window expired; reserved stock released", version: order.version, actorId: null, system: true });
      cancelled++;
    } catch (e) {
      if (!(e instanceof AppError && e.code === "stale_version")) throw e;
    }
  }
  return { cancelled };
}
