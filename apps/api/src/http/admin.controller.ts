import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { OrderTransitionInput, PackageApprovalInput, PageQuery, ProductPublishInput, StockReceiptInput } from "@oryvia/contracts";
import { z } from "zod";
import { DbService } from "../core/db.js";
import { AppError, conflict, notFound, parse, stale } from "../core/errors.js";
import { audit } from "../core/outbox.js";
import { CurrentPrincipal, RequestId, RequirePermissions, type Principal } from "../core/principal.js";
import { transitionOrder } from "../commerce/orders.js";
import { receiveStock } from "../commerce/stock.js";

const OrderListQuery = PageQuery.extend({
  state: z.enum(["placed", "confirmed", "cancelled", "closed"]).optional(),
  q: z.string().trim().max(100).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

/** Asia/Kolkata business date → UTC instant, inclusive start / exclusive end. */
const istStart = (d: string) => new Date(`${d}T00:00:00+05:30`);
const istEndExclusive = (d: string) => new Date(new Date(`${d}T00:00:00+05:30`).getTime() + 86_400_000);

@ApiTags("admin")
@Controller("v1/admin")
export class AdminController {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  // ── Overview: real aggregates only ──
  @Get("overview")
  @RequirePermissions("orders.read")
  async overview(@Query() raw: Record<string, string>) {
    const q = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).parse(raw);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const from = istStart(q.from ?? new Date(Date.now() - 29 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
    const to = istEndExclusive(q.to ?? today);
    const db = this.db.client;
    const range = { placedAt: { gte: from, lt: to } };
    const [placed, byState, byPayment, devOrders, openEnquiries, openQuotes, openExceptions, pendingApplications, lowStock, outboxDead, pkgsInReview, toShip, openReturns, pendingRefunds] = await Promise.all([
      db.order.count({ where: { ...range, isDevelopmentOrder: false } }),
      db.order.groupBy({ by: ["state"], where: { ...range, isDevelopmentOrder: false }, _count: true }),
      db.order.groupBy({ by: ["paymentState"], where: { ...range, isDevelopmentOrder: false }, _count: true, _sum: { totalPaise: true } }),
      db.order.count({ where: { ...range, isDevelopmentOrder: true } }),
      db.contactEnquiry.count({ where: { status: "open" } }),
      db.quoteRequest.count({ where: { status: "submitted" } }),
      db.migrationException.count({ where: { status: "open" } }),
      db.partnerApplication.count({ where: { state: { in: ["submitted", "under_review"] } } }),
      db.$queryRaw<Array<{ variantId: string; name: string; available: bigint }>>`
        SELECT v.id AS "variantId", p.name, COALESCE(SUM(b."onHand" - b.reserved), 0) AS available
        FROM variants v JOIN products p ON p.id = v."productId"
        LEFT JOIN stock_balances b ON b."variantId" = v.id AND b."warehouseId" IN (SELECT id FROM warehouses WHERE kind = 'sellable')
        WHERE p.status = 'published' GROUP BY v.id, p.name HAVING COALESCE(SUM(b."onHand" - b.reserved), 0) < 10 ORDER BY available ASC LIMIT 10`,
      db.outboxEvent.count({ where: { status: "dead" } }),
      db.package.count({ where: { status: "needs_review" } }),
      db.order.count({ where: { state: "confirmed", fulfilmentState: { in: ["unfulfilled", "packing", "partially_shipped"] } } }),
      db.returnRequest.count({ where: { status: { in: ["submitted", "approved", "received"] } } }),
      db.refund.count({ where: { state: "requested" } }),
    ]);
    const captured = byPayment.find((r) => r.paymentState === "captured");
    return {
      range: { from: from.toISOString(), toExclusive: to.toISOString(), timezone: "Asia/Kolkata" },
      definitions: {
        ordersPlaced: "Non-development orders placed in range (any state).",
        capturedPayments: "Sum of order totals whose payment state is 'captured' (provider-verified). Excludes development orders. Not bank settlement.",
      },
      kpis: {
        ordersPlaced: placed,
        capturedPaymentsPaise: captured?._sum.totalPaise ?? 0,
        capturedOrders: captured?._count ?? 0,
        developmentOrders: devOrders,
      },
      ordersByState: byState.map((r) => ({ state: r.state, count: r._count })),
      ordersByPaymentState: byPayment.map((r) => ({ paymentState: r.paymentState, count: r._count })),
      queues: { openEnquiries, openQuotes, openExceptions, pendingApplications, packagesInReview: pkgsInReview, ordersToShip: toShip, openReturns, pendingRefunds },
      lowStock: lowStock.map((r) => ({ ...r, available: Number(r.available) })),
      alerts: [
        ...(outboxDead ? [{ level: "error", message: `${outboxDead} notification job(s) failed permanently` }] : []),
        ...(pkgsInReview ? [{ level: "warning", message: `${pkgsInReview} package(s) have conflicting source evidence and are not purchasable` }] : []),
      ],
      dataFreshness: new Date().toISOString(),
    };
  }

  // ── Orders ──
  @Get("orders")
  @RequirePermissions("orders.read")
  async orders(@Query() raw: Record<string, string>) {
    const q = parse(OrderListQuery, raw);
    const where = {
      ...(q.state ? { state: q.state } : {}),
      ...(q.q ? { OR: [{ publicReference: { contains: q.q, mode: "insensitive" as const } }, { email: { contains: q.q, mode: "insensitive" as const } }] } : {}),
      ...(q.from || q.to ? { placedAt: { ...(q.from ? { gte: istStart(q.from) } : {}), ...(q.to ? { lt: istEndExclusive(q.to) } : {}) } } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.client.order.findMany({ where, orderBy: { placedAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { _count: { select: { lines: true } } } }),
      this.db.client.order.count({ where }),
    ]);
    return {
      items: items.map((o) => ({ id: o.id, reference: o.publicReference, email: o.email, state: o.state, paymentState: o.paymentState, fulfilmentState: o.fulfilmentState, totalPaise: o.totalPaise, placedAt: o.placedAt, lines: o._count.lines, isDevelopmentOrder: o.isDevelopmentOrder, version: o.version })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  @Get("orders/:id")
  @RequirePermissions("orders.read")
  async order(@Param("id") id: string) {
    const o = await this.db.client.order.findUnique({
      where: { id },
      include: { lines: true, events: { orderBy: { createdAt: "asc" } }, payments: true, reservations: true, customer: { select: { id: true, email: true, name: true } } },
    });
    if (!o) throw notFound("Order");
    const { trackingTokenHash: _secret, ...safe } = o;
    return safe;
  }

  @Post("orders/:id/transition")
  @RequirePermissions("orders.transition")
  async transition(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @RequestId() requestId: string | null) {
    const input = parse(OrderTransitionInput, body);
    return transitionOrder(this.db.client, { orderId: id, to: input.to, reason: input.reason, version: input.version, actorId: p.userId, requestId });
  }

  // ── Products ──
  @Get("products")
  @RequirePermissions("products.read")
  async products() {
    const rows = await this.db.client.product.findMany({
      orderBy: { name: "asc" },
      include: { variants: { include: { prices: { orderBy: { effectiveFrom: "desc" }, take: 1 } } }, _count: { select: { media: true } } },
    });
    return rows.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      status: p.status,
      version: p.version,
      sourceIdentity: p.sourceIdentity,
      mediaCount: p._count.media,
      variant: p.variants[0] ? { id: p.variants[0].id, internalCode: p.variants[0].internalCode, sku: p.variants[0].sku, title: p.variants[0].title } : null,
      price: p.variants[0]?.prices[0] ? { unitPaise: p.variants[0].prices[0].unitPaise, referencePaise: p.variants[0].prices[0].referencePaise, reviewState: p.variants[0].prices[0].reviewState } : null,
    }));
  }

  /** Publishing approves the product content and its current imported retail price together, with a recorded reason. */
  @Post("products/:id/publish")
  @RequirePermissions("products.publish")
  async publish(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @RequestId() requestId: string | null) {
    const input = parse(ProductPublishInput, body);
    return this.db.client.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id }, include: { variants: { include: { prices: true } }, categories: true } });
      if (!product) throw notFound("Product");
      if (product.version !== input.version) throw stale();
      if (!product.variants.some((v) => v.prices.length)) throw conflict("Product has no retail price to approve");
      const upd = await tx.product.updateMany({ where: { id, version: input.version }, data: { status: "published", publishedAt: product.publishedAt ?? new Date(), version: { increment: 1 } } });
      if (!upd.count) throw stale();
      await tx.priceEntry.updateMany({ where: { variantId: { in: product.variants.map((v) => v.id) }, reviewState: { in: ["observed", "needs_review", "approved"] } }, data: { reviewState: "published" } });
      await tx.category.updateMany({ where: { id: { in: product.categories.map((c) => c.categoryId) }, status: { not: "published" } }, data: { status: "published" } });
      await tx.reviewDecision.create({ data: { entityKey: product.sourceIdentity ?? `product:${id}`, decision: "published", reason: input.reason, actorId: p.userId } });
      await audit(tx, { actorId: p.userId, action: "product.publish", objectType: "product", objectId: id, reason: input.reason, requestId: requestId ?? undefined });
      return tx.product.findUniqueOrThrow({ where: { id } });
    });
  }

  @Post("products/:id/unpublish")
  @RequirePermissions("products.publish")
  async unpublish(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const input = parse(ProductPublishInput, body);
    const upd = await this.db.client.product.updateMany({ where: { id, version: input.version }, data: { status: "draft", version: { increment: 1 } } });
    if (!upd.count) throw stale();
    await audit(this.db.client, { actorId: p.userId, action: "product.unpublish", objectType: "product", objectId: id, reason: input.reason });
    return this.db.client.product.findUniqueOrThrow({ where: { id } });
  }

  // ── Packages & migration review ──
  @Get("packages")
  @RequirePermissions("packages.review")
  async packages() {
    return this.db.client.package.findMany({
      orderBy: { name: "asc" },
      include: { versions: { orderBy: { version: "desc" }, include: { components: { include: { variant: { include: { product: { select: { name: true, slug: true } } } } } } } } },
    });
  }

  @Post("packages/approve")
  @RequirePermissions("packages.approve")
  async approvePackage(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const input = parse(PackageApprovalInput, body);
    if (!p.twoFactorEnabled) throw new AppError(403, "forbidden", "Approving a package price requires two-factor authentication on your account");
    return this.db.client.$transaction(async (tx) => {
      const v = await tx.packageVersion.findUnique({ where: { id: input.packageVersionId }, include: { components: true } });
      if (!v) throw notFound("Package version");
      if (v.approvalState !== "needs_review") throw conflict(`Version is ${v.approvalState}`);
      const known = new Set(v.components.map((c) => c.variantId));
      for (const c of input.components) if (!known.has(c.variantId)) throw conflict("Component not part of the reviewed version");
      for (const c of input.components) {
        if (c.paidQty + c.freeQty === 0) throw new AppError(422, "validation_failed", "Every component needs a paid or complimentary quantity");
        await tx.packageComponent.update({ where: { packageVersionId_variantId: { packageVersionId: v.id, variantId: c.variantId } }, data: { paidQty: c.paidQty, freeQty: c.freeQty } });
      }
      await tx.packageVersion.updateMany({ where: { packageId: v.packageId, approvalState: "approved" }, data: { approvalState: "superseded", effectiveTo: new Date() } });
      await tx.packageVersion.update({
        where: { id: v.id },
        data: { approvalState: "approved", pricePaise: input.pricePaise, approvedBy: p.userId, approvedAt: new Date(), approvalNote: input.reason, effectiveFrom: new Date() },
      });
      await tx.package.update({ where: { id: v.packageId }, data: { status: "published" } });
      await tx.reviewDecision.create({ data: { entityKey: `package_version:${v.id}`, decision: "approved", reason: input.reason, actorId: p.userId, snapshot: input } });
      await audit(tx, { actorId: p.userId, action: "package.approve", objectType: "package_version", objectId: v.id, reason: input.reason, data: { pricePaise: input.pricePaise } });
      return tx.packageVersion.findUniqueOrThrow({ where: { id: v.id }, include: { components: true } });
    });
  }

  @Get("migration/exceptions")
  @RequirePermissions("migration.review")
  async exceptions(@Query() raw: Record<string, string>) {
    const q = z.object({ status: z.enum(["open", "resolved", "accepted"]).optional(), severity: z.string().max(20).optional() }).parse(raw);
    const rows = await this.db.client.migrationException.findMany({ where: { ...(q.status ? { status: q.status } : {}), ...(q.severity ? { severity: q.severity } : {}) }, orderBy: [{ severity: "asc" }, { entityKey: "asc" }] });
    const runs = await this.db.client.migrationRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 });
    const coverage = await this.db.client.sourcePage.groupBy({ by: ["status"], _count: true });
    return { exceptions: rows, runs, coverage: coverage.map((c) => ({ status: c.status, count: c._count })) };
  }

  @Post("migration/exceptions/:id/resolve")
  @RequirePermissions("migration.resolve")
  async resolveException(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const input = parse(z.object({ status: z.enum(["resolved", "accepted"]), reason: z.string().trim().min(5).max(1000) }), body);
    const row = await this.db.client.migrationException.update({ where: { id }, data: { status: input.status, resolution: input.reason, resolvedBy: p.userId, resolvedAt: new Date() } });
    await audit(this.db.client, { actorId: p.userId, action: "migration.exception_resolve", objectType: "migration_exception", objectId: id, reason: input.reason });
    return row;
  }

  // ── Inventory ──
  @Get("inventory")
  @RequirePermissions("inventory.read")
  async inventory() {
    const variants = await this.db.client.variant.findMany({
      include: { product: { select: { name: true, status: true } }, balances: { include: { warehouse: true, batch: true } } },
      orderBy: { product: { name: "asc" } },
    });
    const movements = await this.db.client.stockMovement.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { variant: { include: { product: { select: { name: true } } } }, warehouse: true } });
    const warehouses = await this.db.client.warehouse.findMany({ where: { active: true } });
    return {
      warehouses,
      variants: variants.map((v) => ({
        id: v.id,
        internalCode: v.internalCode,
        product: v.product.name,
        productStatus: v.product.status,
        onHand: v.balances.reduce((s, b) => s + b.onHand, 0),
        reserved: v.balances.reduce((s, b) => s + b.reserved, 0),
        batches: v.balances.map((b) => ({ warehouse: b.warehouse.code, lot: b.batch?.lot ?? null, status: b.batch?.status ?? null, expiresAt: b.batch?.expiresAt ?? null, onHand: b.onHand, reserved: b.reserved })),
      })),
      movements: movements.map((m) => ({ id: m.id, product: m.variant.product.name, warehouse: m.warehouse.code, delta: m.delta, reason: m.reason, reference: m.reference, note: m.note, at: m.createdAt })),
    };
  }

  @Post("inventory/receipts")
  @RequirePermissions("inventory.write")
  async receipt(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const input = parse(StockReceiptInput, body);
    const r = await receiveStock(
      this.db.client,
      { ...input, manufacturedAt: input.manufacturedAt ? new Date(input.manufacturedAt) : undefined, expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined },
      p.userId,
    );
    await audit(this.db.client, { actorId: p.userId, action: "inventory.receipt", objectType: "stock_movement", objectId: r.movement.id, data: { quantity: input.quantity, lot: input.lot } });
    return r;
  }

  // ── Enquiries & quotes ──
  @Get("enquiries")
  @RequirePermissions("support.read")
  async enquiries() {
    const [enquiries, quotes, tasks] = await Promise.all([
      this.db.client.contactEnquiry.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      this.db.client.quoteRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { package: { select: { name: true } } } }),
      this.db.client.followUpTask.findMany({ where: { status: "open" }, orderBy: { dueAt: "asc" }, take: 100 }),
    ]);
    return { enquiries, quotes, tasks };
  }

  @Post("enquiries/:id/status")
  @RequirePermissions("support.write")
  async enquiryStatus(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const input = parse(z.object({ status: z.enum(["open", "in_progress", "resolved"]), reason: z.string().trim().min(3).max(1000) }), body);
    const e = await this.db.client.contactEnquiry.update({ where: { id }, data: { status: input.status } });
    if (input.status === "resolved") await this.db.client.followUpTask.updateMany({ where: { enquiryId: id, status: "open" }, data: { status: "done" } });
    await this.db.client.crmNote.create({ data: { subjectKey: `enquiry:${id}`, authorId: p.userId, body: input.reason } });
    await audit(this.db.client, { actorId: p.userId, action: "enquiry.status", objectType: "contact_enquiry", objectId: id, data: { status: input.status } });
    return e;
  }

  // ── Store settings (validated, versioned, audited) ──
  @Get("settings")
  @RequirePermissions("settings.write")
  settings() {
    return this.db.client.storeSetting.findMany({ orderBy: { key: "asc" } });
  }

  @Post("settings/shipping")
  @RequirePermissions("settings.write")
  async shipping(@Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const input = z
      .object({
        label: z.string().trim().min(3).max(120),
        flatPaise: z.number().int().min(0).max(10_000_00),
        freeAboveSubtotalPaise: z.number().int().min(0).nullable(),
        serviceablePinPrefixes: z.array(z.string().regex(/^[1-9]\d{0,5}$/)).max(500),
        isDevelopment: z.boolean(),
        version: z.number().int().min(0),
      })
      .parse(body);
    const { version, ...value } = input;
    const existing = await this.db.client.storeSetting.findUnique({ where: { key: "shipping.rule" } });
    if ((existing?.version ?? 0) !== version) throw stale();
    const row = existing
      ? await this.db.client.storeSetting.update({ where: { key: "shipping.rule" }, data: { value, verified: !value.isDevelopment, updatedBy: p.userId, version: { increment: 1 } } })
      : await this.db.client.storeSetting.create({ data: { key: "shipping.rule", value, verified: !value.isDevelopment, updatedBy: p.userId } });
    await audit(this.db.client, { actorId: p.userId, action: "settings.shipping", objectType: "store_setting", objectId: "shipping.rule", data: value });
    return row;
  }
}
