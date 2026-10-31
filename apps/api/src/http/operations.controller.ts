import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import {
  LineCancelInput,
  PageQuery,
  RefundDecisionInput,
  RefundRequestInput,
  ReturnDecisionInput,
  ReturnInspectInput,
  ReturnReceiveInput,
  ReturnRequestInput,
  ShipmentCreateInput,
  ShipmentDispatchInput,
  ShipmentReasonInput,
} from "@oryvia/contracts";
import { z } from "zod";
import { DbService } from "../core/db.js";
import { notFound, parse } from "../core/errors.js";
import { CurrentPrincipal, RequestId, RequirePermissions, type Principal } from "../core/principal.js";
import { cancelLines, cancelShipment, createShipment, dispatchShipment, lineProgress, markDelivered } from "../commerce/fulfilment.js";
import { decideRefund, refundSummary, requestRefund } from "../commerce/refunds.js";
import { decideReturn, inspectReturnLine, receiveReturn, requestReturn, returnableByLine } from "../commerce/returns.js";

const ReturnListQuery = PageQuery.extend({ status: z.enum(["submitted", "approved", "rejected", "received", "inspected"]).optional() });

/** Fulfilment, returns and refunds for staff. Every mutation takes a reason or version and writes an audit row. */
@ApiTags("admin-operations")
@Controller("v1/admin")
export class OperationsController {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  /** Line progress, shipments, returns and refund balance for one order. */
  @Get("orders/:id/operations")
  @RequirePermissions("orders.read")
  async operations(@Param("id") id: string) {
    const db = this.db.client;
    const order = await db.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) throw notFound("Order");
    const [progress, returnable, fulfilments, returns, refunds] = await Promise.all([
      lineProgress(db, id),
      returnableByLine(db, id),
      db.fulfilment.findMany({ where: { orderId: id }, orderBy: { createdAt: "asc" }, include: { warehouse: { select: { code: true } }, lines: { include: { batch: { select: { lot: true, expiresAt: true } } } } } }),
      db.returnRequest.findMany({ where: { orderId: id }, orderBy: { createdAt: "asc" }, include: { lines: true } }),
      refundSummary(db, id),
    ]);
    return {
      lines: progress.map((p) => ({ ...p, returnable: returnable.get(p.orderLineId) ?? 0 })),
      fulfilments,
      returns,
      refunds,
    };
  }

  // ── Shipments ──
  @Post("orders/:id/shipments")
  @RequirePermissions("orders.fulfil")
  createShipment(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @RequestId() requestId: string | null) {
    const input = parse(ShipmentCreateInput, body);
    return createShipment(this.db.client, { orderId: id, ...input, actorId: p.userId, requestId });
  }

  @Post("shipments/:id/dispatch")
  @RequirePermissions("orders.fulfil")
  dispatch(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @RequestId() requestId: string | null) {
    const input = parse(ShipmentDispatchInput, body);
    return dispatchShipment(this.db.client, { fulfilmentId: id, carrier: input.carrier, trackingRef: input.trackingRef || undefined, actorId: p.userId, requestId });
  }

  @Post("shipments/:id/deliver")
  @RequirePermissions("orders.fulfil")
  deliver(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @RequestId() requestId: string | null) {
    const { reason } = parse(ShipmentReasonInput, body);
    return markDelivered(this.db.client, { fulfilmentId: id, reason, actorId: p.userId, requestId });
  }

  @Post("shipments/:id/cancel")
  @RequirePermissions("orders.fulfil")
  cancelShipment(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @RequestId() requestId: string | null) {
    const { reason } = parse(ShipmentReasonInput, body);
    return cancelShipment(this.db.client, { fulfilmentId: id, reason, actorId: p.userId, requestId });
  }

  @Post("orders/:id/cancel-lines")
  @RequirePermissions("orders.transition")
  cancelLines(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @RequestId() requestId: string | null) {
    const input = parse(LineCancelInput, body);
    return cancelLines(this.db.client, { orderId: id, ...input, actorId: p.userId, requestId });
  }

  // ── Returns ──
  @Get("returns")
  @RequirePermissions("orders.read")
  async returns(@Query() raw: Record<string, string>) {
    const q = parse(ReturnListQuery, raw);
    const where = q.status ? { status: q.status } : {};
    const [items, total] = await Promise.all([
      this.db.client.returnRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { order: { select: { id: true, publicReference: true, email: true, isDevelopmentOrder: true } }, _count: { select: { lines: true } } },
      }),
      this.db.client.returnRequest.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Get("returns/:id")
  @RequirePermissions("orders.read")
  async returnDetail(@Param("id") id: string) {
    const ret = await this.db.client.returnRequest.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, publicReference: true, email: true, isDevelopmentOrder: true } },
        lines: { orderBy: { id: "asc" }, include: { orderLine: { select: { identitySnapshot: true } } } },
        refunds: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!ret) throw notFound("Return");
    const batchIds = ret.lines.map((l) => l.batchId).filter((b): b is string => !!b);
    const batches = await this.db.client.inventoryBatch.findMany({ where: { id: { in: batchIds } }, select: { id: true, lot: true, status: true, expiresAt: true } });
    return {
      ...ret,
      lines: ret.lines.map(({ orderLine, ...l }) => ({ ...l, name: (orderLine.identitySnapshot as { name: string }).name, batch: batches.find((b) => b.id === l.batchId) ?? null })),
    };
  }

  @Post("orders/:id/returns")
  @RequirePermissions("returns.manage")
  createReturn(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @RequestId() requestId: string | null) {
    const input = parse(ReturnRequestInput, body);
    return requestReturn(this.db.client, { orderId: id, ...input, requester: { kind: "staff", userId: p.userId }, requestId });
  }

  @Post("returns/:id/decide")
  @RequirePermissions("returns.manage")
  decideReturn(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @RequestId() requestId: string | null) {
    const input = parse(ReturnDecisionInput, body);
    return decideReturn(this.db.client, { returnId: id, ...input, actorId: p.userId, requestId });
  }

  @Post("returns/:id/receive")
  @RequirePermissions("returns.manage", "inventory.write")
  receive(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @RequestId() requestId: string | null) {
    const input = parse(ReturnReceiveInput, body);
    return receiveReturn(this.db.client, { returnId: id, ...input, actorId: p.userId, requestId });
  }

  @Post("return-lines/:id/inspect")
  @RequirePermissions("returns.manage", "inventory.write")
  inspect(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @RequestId() requestId: string | null) {
    const input = parse(ReturnInspectInput, body);
    return inspectReturnLine(this.db.client, { returnLineId: id, ...input, actorId: p.userId, requestId });
  }

  // ── Refunds ──
  @Get("refunds")
  @RequirePermissions("finance.refunds")
  async refunds(@Query() raw: Record<string, string>) {
    const q = parse(PageQuery.extend({ state: z.enum(["requested", "approved", "rejected", "succeeded", "recorded_development"]).optional() }), raw);
    const where = q.state ? { state: q.state } : {};
    const [items, total] = await Promise.all([
      this.db.client.refund.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { paymentAttempt: { select: { provider: true, order: { select: { id: true, publicReference: true, isDevelopmentOrder: true } } } }, returnRequest: { select: { reference: true } } },
      }),
      this.db.client.refund.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Post("orders/:id/refunds")
  @RequirePermissions("finance.refunds")
  requestRefund(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @RequestId() requestId: string | null) {
    const input = parse(RefundRequestInput, body);
    return requestRefund(this.db.client, { orderId: id, ...input, actorId: p.userId, requestId });
  }

  @Post("refunds/:id/decide")
  @RequirePermissions("finance.refunds")
  decideRefund(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal, @RequestId() requestId: string | null) {
    const input = parse(RefundDecisionInput, body);
    return decideRefund(this.db.client, { refundId: id, ...input, actorId: p.userId, actorTwoFactor: p.twoFactorEnabled, requestId });
  }
}
