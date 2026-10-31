// Refunds: requested → approved (executed through the payment provider) | rejected.
// The refunds table is the ledger: the sum of live refunds against a payment can never exceed what was captured,
// checked under the order row lock. Approval needs a second person (maker-checker, D-013).
// Money moves only through a provider adapter; with none configured, approval is refused rather than faked.
import type { Db, Tx } from "@oryvia/db";
import { conflict, forbidden, notFound, unavailable } from "../core/errors.js";
import { audit, enqueueOutbox } from "../core/outbox.js";
import { lockOrder } from "./fulfilment.js";

/** States that count against the refundable balance. */
const LIVE = ["requested", "approved", "succeeded", "recorded_development"];

/** The payment a refund draws on: the captured attempt, or the development attempt on a development order. */
async function refundSource(tx: Tx, orderId: string, isDevelopmentOrder: boolean) {
  const attempts = await tx.paymentAttempt.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
  const captured = attempts.find((a) => a.state === "captured");
  if (captured) return captured;
  if (isDevelopmentOrder) return attempts.find((a) => a.provider === "dev_manual") ?? null;
  return null;
}

export async function refundSummary(db: Db | Tx, orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const attempts = await db.paymentAttempt.findMany({ where: { orderId }, include: { refunds: { orderBy: { createdAt: "asc" } } } });
  const source = attempts.find((a) => a.state === "captured") ?? (order.isDevelopmentOrder ? attempts.find((a) => a.provider === "dev_manual") : undefined);
  const refunds = attempts.flatMap((a) => a.refunds);
  const committed = refunds.filter((r) => LIVE.includes(r.state)).reduce((n, r) => n + r.amountPaise, 0);
  return {
    basis: source ? { provider: source.provider, amountPaise: source.amountPaise, development: source.provider === "dev_manual" } : null,
    refundablePaise: source ? source.amountPaise - committed : 0,
    refunds,
  };
}

export async function requestRefund(
  db: Db,
  args: { orderId: string; amountPaise: number; reason: string; returnRequestId?: string; actorId: string; requestId?: string | null },
) {
  return db.$transaction(async (tx) => {
    const order = await lockOrder(tx, args.orderId);
    const source = await refundSource(tx, order.id, order.isDevelopmentOrder);
    if (!source) throw conflict("This order has no captured payment, so there is nothing to refund.");
    if (args.returnRequestId) {
      const ret = await tx.returnRequest.findFirst({ where: { id: args.returnRequestId, orderId: order.id } });
      if (!ret) throw notFound("Return");
      if (ret.status === "rejected" || ret.status === "submitted") throw conflict(`A refund cannot be raised against a ${ret.status} return.`);
    }
    const live = await tx.refund.aggregate({ where: { paymentAttemptId: source.id, state: { in: LIVE } }, _sum: { amountPaise: true } });
    const refundable = source.amountPaise - (live._sum.amountPaise ?? 0);
    if (args.amountPaise > refundable) throw conflict(`At most ₹${(refundable / 100).toFixed(2)} can still be refunded on this payment.`);

    const refund = await tx.refund.create({
      data: { paymentAttemptId: source.id, amountPaise: args.amountPaise, reason: args.reason, requestedBy: args.actorId, returnRequestId: args.returnRequestId },
    });
    await tx.orderEvent.create({ data: { orderId: order.id, kind: "refund_requested", actorId: args.actorId, note: args.reason, data: { refundId: refund.id, amountPaise: args.amountPaise } } });
    await audit(tx, { actorId: args.actorId, action: "refund.request", objectType: "refund", objectId: refund.id, reason: args.reason, requestId: args.requestId ?? undefined, data: { amountPaise: args.amountPaise } });
    return refund;
  });
}

export async function decideRefund(
  db: Db,
  args: { refundId: string; decision: "approved" | "rejected"; note: string; actorId: string; actorTwoFactor: boolean; requestId?: string | null },
) {
  return db.$transaction(async (tx) => {
    const found = await tx.refund.findUnique({ where: { id: args.refundId }, include: { paymentAttempt: true } });
    if (!found) throw notFound("Refund");
    const order = await lockOrder(tx, found.paymentAttempt.orderId);
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: found.id } });
    if (refund.state !== "requested") throw conflict(`This refund is already ${refund.state}.`);
    if (args.decision === "approved" && refund.requestedBy === args.actorId)
      throw forbidden("A refund must be approved by someone other than the person who requested it.");

    let state: string = args.decision;
    if (args.decision === "approved") {
      if (found.paymentAttempt.provider === "dev_manual") state = "recorded_development"; // no money exists to move
      else if (!args.actorTwoFactor) throw forbidden("Approving a refund of real money requires two-factor authentication on your account.");
      else throw unavailable(`Refunds through ${found.paymentAttempt.provider} are not configured yet. Nothing was sent; the refund stays requested.`);
    }
    await tx.refund.update({ where: { id: refund.id }, data: { state, approvedBy: args.decision === "approved" ? args.actorId : null } });
    await tx.orderEvent.create({ data: { orderId: order.id, kind: `refund_${state}`, actorId: args.actorId, note: args.note, data: { refundId: refund.id, amountPaise: refund.amountPaise } } });
    await audit(tx, { actorId: args.actorId, action: `refund.${args.decision}`, objectType: "refund", objectId: refund.id, reason: args.note, requestId: args.requestId ?? undefined });
    if (state !== "rejected") await enqueueOutbox(tx, "refund.recorded", order.id, { reference: order.publicReference, email: order.email, amountPaise: refund.amountPaise, development: state === "recorded_development" });
    return tx.refund.findUniqueOrThrow({ where: { id: refund.id } });
  });
}
