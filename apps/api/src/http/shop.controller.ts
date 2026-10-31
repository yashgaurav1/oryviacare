import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { CartItemInput, CartQuantityInput, CheckoutQuoteInput, PlaceOrderInput, ReturnRequestInput } from "@oryvia/contracts";
import { z } from "zod";
import { DbService } from "../core/db.js";
import { env } from "../core/env.js";
import { AppError, notFound, parse } from "../core/errors.js";
import { withIdempotency } from "../core/idempotency.js";
import { Authenticated, CurrentPrincipal, RequestId, type Principal } from "../core/principal.js";
import { CART_COOKIE, CartService, type CartOwner } from "../commerce/cart.js";
import { CheckoutService, hashTrackingToken, paymentMethods } from "../commerce/checkout.js";
import { getSetting } from "../commerce/pricing.js";
import { requestReturn, returnableByLine, type ReturnPolicy } from "../commerce/returns.js";

const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: env.NODE_ENV === "production", path: "/", maxAge: 30 * 24 * 3600_000 };

function owner(req: Request, p: Principal | null): CartOwner {
  return { userId: p?.userId ?? null, guestToken: (req.cookies as Record<string, string> | undefined)?.[CART_COOKIE] ?? null };
}

@ApiTags("cart")
@Controller("v1/carts")
export class CartController {
  private readonly carts: CartService;
  constructor(@Inject(DbService) db: DbService) {
    this.carts = new CartService(db.client);
  }

  @Get("current")
  view(@Req() req: Request, @CurrentPrincipal() p: Principal | null) {
    return this.carts.view(owner(req, p));
  }

  @Post("current/items")
  async add(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown, @CurrentPrincipal() p: Principal | null) {
    const input = parse(CartItemInput, body);
    const { view, newGuestToken } = await this.carts.addItem(owner(req, p), input.variantId, input.quantity);
    if (newGuestToken) res.cookie(CART_COOKIE, newGuestToken, cookieOpts);
    return view;
  }

  @Patch("current/items/:id")
  setQty(@Req() req: Request, @Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal | null) {
    return this.carts.setQuantity(owner(req, p), id, parse(CartQuantityInput, body).quantity);
  }

  @Delete("current/items/:id")
  remove(@Req() req: Request, @Param("id") id: string, @CurrentPrincipal() p: Principal | null) {
    return this.carts.remove(owner(req, p), id);
  }

  @Post("current/items/:id/restore")
  restore(@Req() req: Request, @Param("id") id: string, @CurrentPrincipal() p: Principal | null) {
    return this.carts.restore(owner(req, p), id);
  }

  @Post("merge")
  @Authenticated()
  @HttpCode(200)
  async merge(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentPrincipal() p: Principal) {
    const token = (req.cookies as Record<string, string> | undefined)?.[CART_COOKIE];
    if (!token) return { view: await this.carts.view({ userId: p.userId, guestToken: null }), report: [] };
    const result = await this.carts.mergeGuestIntoUser(p.userId, token);
    res.clearCookie(CART_COOKIE, { path: "/" });
    return result;
  }
}

@ApiTags("checkout")
@Controller("v1/checkout")
export class CheckoutController {
  private readonly checkout: CheckoutService;
  private readonly carts: CartService;
  constructor(@Inject(DbService) private readonly db: DbService) {
    this.checkout = new CheckoutService(db.client);
    this.carts = new CartService(db.client);
  }

  private async cartItems(req: Request, p: Principal | null) {
    const cart = await this.carts.find(owner(req, p));
    if (!cart) throw new AppError(422, "validation_failed", "Your cart is empty");
    const items = await this.db.client.cartItem.findMany({ where: { cartId: cart.id, removedAt: null, variantId: { not: null } } });
    return { cart, items: items.map((i) => ({ variantId: i.variantId!, quantity: i.quantity })) };
  }

  @Get("payment-methods")
  methods() {
    return paymentMethods();
  }

  @Post("quote")
  @HttpCode(200)
  async quote(@Req() req: Request, @Body() body: unknown, @CurrentPrincipal() p: Principal | null) {
    const input = parse(CheckoutQuoteInput, body);
    const { items } = await this.cartItems(req, p);
    return this.checkout.quote(items, input);
  }

  @Post("orders")
  async place(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentPrincipal() p: Principal | null,
    @RequestId() requestId: string | null,
  ) {
    const input = parse(PlaceOrderInput, body);
    const { cart, items } = await this.cartItems(req, p).catch(async (e) => {
      // A converted cart on retry is expected: fall through to the idempotent replay.
      if (key) return { cart: null, items: [] as Array<{ variantId: string; quantity: number }> };
      throw e;
    });
    const principalKey = p?.userId ?? `guest:${(req.cookies as Record<string, string> | undefined)?.[CART_COOKIE]?.slice(0, 12) ?? "anon"}`;
    const r = await withIdempotency(key, principalKey, "checkout.place_order", input, async () => {
      if (!cart) throw new AppError(422, "validation_failed", "Your cart is empty");
      const body = await this.checkout.placeOrder({ cartId: cart.id, cartItems: items, input, customerId: p?.userId ?? null, requestId });
      return { status: 201, body };
    });
    res.status(r.status);
    if (r.replayed) res.setHeader("Idempotent-Replayed", "true");
    return r.body;
  }
}

const CUSTOMER_EVENTS = new Set([
  "order_placed",
  "state_changed",
  "shipment_shipped",
  "shipment_delivered",
  "lines_cancelled",
  "return_requested",
  "return_approved",
  "return_rejected",
  "return_received",
  "refund_recorded_development",
  "refund_succeeded",
]);

const TrackQuery = z.object({ token: z.string().min(20).max(100) });

@ApiTags("orders")
@Controller("v1")
export class OrdersController {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  private async present(orderId: string, includeAddress: boolean) {
    const o = await this.db.client.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        lines: true,
        events: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "asc" } },
        fulfilments: { where: { status: { not: "cancelled" } }, orderBy: { createdAt: "asc" }, include: { lines: true } },
        returns: { orderBy: { createdAt: "asc" }, include: { lines: true } },
      },
    });
    const returnable = includeAddress ? await returnableByLine(this.db.client, o.id) : null;
    const policy = includeAddress ? await getSetting<ReturnPolicy>(this.db.client, "returns.policy") : null;
    return {
      id: o.id,
      reference: o.publicReference,
      state: o.state,
      paymentState: o.paymentState,
      fulfilmentState: o.fulfilmentState,
      isDevelopmentOrder: o.isDevelopmentOrder,
      placedAt: o.placedAt,
      totals: { subtotalPaise: o.subtotalPaise, discountPaise: o.discountPaise, shippingPaise: o.shippingPaise, taxPaise: o.taxPaise, totalPaise: o.totalPaise, taxMode: o.taxMode },
      lines: o.lines.map((l) => ({
        id: l.id,
        name: (l.identitySnapshot as { name: string }).name,
        slug: (l.identitySnapshot as { slug: string }).slug,
        quantity: l.quantity,
        cancelledQty: l.cancelledQty,
        unitPaise: l.unitPaise,
        lineTotalPaise: l.lineTotalPaise,
        returnable: returnable?.get(l.id) ?? 0,
      })),
      shipments: o.fulfilments.map((f) => ({
        id: f.id,
        status: f.status,
        carrier: f.carrier,
        trackingRef: f.trackingRef,
        shippedAt: f.shippedAt,
        deliveredAt: f.deliveredAt,
        lines: f.lines.map((fl) => ({ orderLineId: fl.orderLineId, quantity: fl.quantity })),
      })),
      returns: includeAddress
        ? o.returns.map((r) => ({ id: r.id, reference: r.reference, status: r.status, reason: r.reason, decisionNote: r.decisionNote, createdAt: r.createdAt, lines: r.lines.map((rl) => ({ orderLineId: rl.orderLineId, quantity: rl.quantity })) }))
        : [],
      returnPolicy: policy ? { windowDays: policy.value.windowDays, label: policy.value.label, isDevelopment: !!policy.value.isDevelopment } : null,
      // Customers see an allow-list of events. Staff notes stay internal, except a return rejection reason, which is written for the customer.
      timeline: o.events
        .filter((e) => CUSTOMER_EVENTS.has(e.kind))
        .map((e) => ({ kind: e.kind, toState: e.toState, at: e.createdAt, note: e.kind === "return_rejected" ? e.note : null })),
      payments: o.payments.map((pa) => ({ provider: pa.provider, state: pa.state, amountPaise: pa.amountPaise })),
      shippingAddress: includeAddress ? o.shippingAddress : null,
      email: includeAddress ? o.email : null,
    };
  }

  /** Guest tracking by high-entropy token only. Address is never returned on this route. */
  @Get("track")
  async track(@Query() raw: Record<string, string>) {
    const { token } = parse(TrackQuery, raw);
    const o = await this.db.client.order.findUnique({ where: { trackingTokenHash: hashTrackingToken(token) }, select: { id: true } });
    if (!o) throw notFound("Order");
    return this.present(o.id, false);
  }

  @Get("account/orders")
  @Authenticated()
  async mine(@CurrentPrincipal() p: Principal) {
    const rows = await this.db.client.order.findMany({ where: { customerId: p.userId }, orderBy: { placedAt: "desc" }, take: 50, include: { _count: { select: { lines: true } } } });
    return rows.map((o) => ({ id: o.id, reference: o.publicReference, state: o.state, paymentState: o.paymentState, totalPaise: o.totalPaise, placedAt: o.placedAt, lineCount: o._count.lines, isDevelopmentOrder: o.isDevelopmentOrder }));
  }

  @Get("account/orders/:id")
  @Authenticated()
  async mineDetail(@Param("id") id: string, @CurrentPrincipal() p: Principal) {
    const o = await this.db.client.order.findFirst({ where: { id, customerId: p.userId }, select: { id: true } });
    if (!o) throw notFound("Order"); // same response for "not yours" and "does not exist"
    return this.present(o.id, true);
  }

  /** Customer return request for delivered items on their own order. Idempotent per key. */
  @Post("account/orders/:id/returns")
  @Authenticated()
  async requestReturn(
    @Param("id") id: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentPrincipal() p: Principal,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = parse(ReturnRequestInput, body);
    const r = await withIdempotency(key, p.userId, "account.request_return", { id, ...input }, async () => {
      const ret = await requestReturn(this.db.client, { orderId: id, ...input, requester: { kind: "customer", userId: p.userId } });
      return { status: 201, body: { id: ret.id, reference: ret.reference, status: ret.status } };
    });
    res.status(r.status);
    return r.body;
  }

  @Get("account/me")
  @Authenticated()
  me(@CurrentPrincipal() p: Principal) {
    return {
      userId: p.userId,
      name: p.name,
      email: p.email,
      emailVerified: p.emailVerified,
      isStaff: p.isStaff,
      permissions: [...p.permissions],
      twoFactorEnabled: p.twoFactorEnabled,
      memberships: p.memberships,
    };
  }
}
