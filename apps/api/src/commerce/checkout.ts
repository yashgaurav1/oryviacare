// Order placement. One transaction: revalidate quote → create order + snapshots → reserve stock → payment attempt
// → order event → outbox. Provider calls happen after commit, never while holding row locks.
import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@oryvia/db";
import type { CheckoutQuoteInput, PlaceOrderInput } from "@oryvia/contracts";
import { AppError, conflict, unavailable } from "../core/errors.js";
import { enqueueOutbox } from "../core/outbox.js";
import { env } from "../core/env.js";
import { buildQuote, type Quote } from "./pricing.js";
import { reserveStock } from "./stock.js";

const RESERVATION_MINUTES = 30;
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function publicReference(prefix = "ORY") {
  const bytes = randomBytes(10);
  let s = "";
  for (const b of bytes) s += REF_ALPHABET[b % REF_ALPHABET.length];
  return `${prefix}-${s.slice(0, 5)}-${s.slice(5)}`;
}

export const hashTrackingToken = (t: string) => createHash("sha256").update(t).digest("hex");

export function paymentMethods() {
  return [
    {
      key: "razorpay" as const,
      label: "Pay online (Razorpay)",
      available: !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET),
      unavailableReason: "Online payment is not set up yet. The merchant must connect a Razorpay account.",
    },
    ...(env.ALLOW_DEV_MANUAL_PAYMENT
      ? [
          {
            key: "dev_manual" as const,
            label: "Development order (no payment taken)",
            available: true,
            unavailableReason: null,
            notice: "DEVELOPMENT ONLY: creates a real order record but no money moves. The order stays unpaid.",
          },
        ]
      : []),
  ];
}

export class CheckoutService {
  constructor(private readonly db: Db) {}

  async quote(cartItems: Array<{ variantId: string; quantity: number }>, input: CheckoutQuoteInput): Promise<Quote> {
    if (!cartItems.length) throw new AppError(422, "validation_failed", "Your cart is empty");
    return buildQuote(this.db, cartItems, input);
  }

  async placeOrder(args: {
    cartId: string;
    cartItems: Array<{ variantId: string; quantity: number }>;
    input: PlaceOrderInput;
    customerId: string | null;
    requestId: string | null;
  }) {
    const { input } = args;
    const method = paymentMethods().find((m) => m.key === input.paymentMethod);
    if (!method || !method.available) throw unavailable(method?.unavailableReason ?? "This payment method is not available");

    const trackingToken = randomBytes(32).toString("base64url");
    const result = await this.db.$transaction(
      async (tx) => {
        const quote = await buildQuote(tx, args.cartItems, input.checkout);
        if (quote.problems.length) throw new AppError(409, "stock_unavailable", quote.problems.map((p) => p.message).join("; "));
        if (quote.hash !== input.quoteHash)
          throw Object.assign(conflict("Prices, delivery charges or availability changed. Please review the updated total."), { fields: { quote: [quote.hash] } });
        if (quote.totalPaise <= 0) throw conflict("Order total must be greater than zero");

        const ship = input.checkout.shippingAddress;
        const bill = input.checkout.billingSameAsShipping ? ship : (input.checkout.billingAddress ?? ship);
        const order = await tx.order.create({
          data: {
            publicReference: publicReference(),
            trackingTokenHash: hashTrackingToken(trackingToken),
            customerId: args.customerId,
            email: input.checkout.email,
            phone: ship.phone,
            state: "placed",
            paymentState: "awaiting_payment",
            subtotalPaise: quote.subtotalPaise,
            discountPaise: quote.discountPaise,
            shippingPaise: quote.shippingPaise,
            taxPaise: quote.taxPaise,
            totalPaise: quote.totalPaise,
            taxMode: quote.tax.mode,
            quoteHash: quote.hash,
            shippingAddress: ship,
            billingAddress: bill,
            paymentMethod: input.paymentMethod,
            isDevelopmentOrder: input.paymentMethod === "dev_manual",
            lines: {
              create: quote.lines.map((l) => ({
                variantId: l.variantId,
                identitySnapshot: { productId: l.productId, slug: l.productSlug, name: l.productName, variant: l.variantTitle, priceEntryId: l.priceEntryId },
                quantity: l.quantity,
                unitPaise: l.unitPaise,
                lineSubtotalPaise: l.lineSubtotalPaise,
                lineTotalPaise: l.lineSubtotalPaise,
                taxSnapshot: { mode: quote.tax.mode, computed: quote.tax.configured, note: quote.tax.note },
              })),
            },
          },
        });
        const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60_000);
        for (const l of quote.lines) await reserveStock(tx, order.id, l.variantId, l.quantity, expiresAt);
        const attempt = await tx.paymentAttempt.create({
          data: { orderId: order.id, provider: input.paymentMethod, state: input.paymentMethod === "dev_manual" ? "pending" : "created", amountPaise: quote.totalPaise },
        });
        await tx.orderEvent.create({
          data: { orderId: order.id, kind: "order_placed", toState: "placed", actorId: args.customerId, data: { requestId: args.requestId, quoteHash: quote.hash, paymentMethod: input.paymentMethod } },
        });
        await tx.cart.update({ where: { id: args.cartId }, data: { status: "converted" } });
        await enqueueOutbox(tx, "order.placed", order.id, { reference: order.publicReference, email: order.email });
        await tx.analyticsEvent.create({ data: { id: `order_placed:${order.id}`, name: "order_placed", userId: args.customerId, properties: { totalPaise: order.totalPaise, lines: quote.lines.length } } });
        return { order, attempt, quote };
      },
      { isolationLevel: "ReadCommitted", timeout: 20_000 },
    );

    return {
      orderId: result.order.id,
      reference: result.order.publicReference,
      trackingToken, // shown once; only its hash is stored
      totalPaise: result.order.totalPaise,
      paymentState: result.order.paymentState,
      paymentAttemptId: result.attempt.id,
      isDevelopmentOrder: result.order.isDevelopmentOrder,
      reservationExpiresInMinutes: RESERVATION_MINUTES,
    };
  }
}
