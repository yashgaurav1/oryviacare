// Stock ledger operations. Every balance change writes an immutable StockMovement in the same transaction.
// Reservations lock candidate balance rows (SELECT ... FOR UPDATE) in first-expiring-first-out order,
// so two buyers can never both take the last unit.
import type { Db, Tx } from "@oryvia/db";
import { AppError } from "../core/errors.js";

/** Available-to-sell: on hand minus reserved, excluding quarantined/held/expired batches. */
export async function availableByVariant(db: Db | Tx, variantIds: string[]): Promise<Map<string, number>> {
  if (!variantIds.length) return new Map();
  const rows = await db.$queryRaw<Array<{ variantId: string; available: bigint }>>`
    SELECT b."variantId", COALESCE(SUM(b."onHand" - b."reserved"), 0) AS available
    FROM stock_balances b
    LEFT JOIN inventory_batches ib ON ib.id = b."batchId"
    JOIN warehouses w ON w.id = b."warehouseId" AND w.active AND w.kind = 'sellable'
    WHERE b."variantId" = ANY(${variantIds}::text[])
      AND (b."batchId" IS NULL OR (ib.status = 'available' AND (ib."expiresAt" IS NULL OR ib."expiresAt" > now())))
    GROUP BY b."variantId"`;
  return new Map(rows.map((r) => [r.variantId, Number(r.available)]));
}

export async function reserveStock(tx: Tx, orderId: string, variantId: string, quantity: number, expiresAt: Date) {
  const candidates = await tx.$queryRaw<Array<{ id: string; warehouseId: string; free: number }>>`
    SELECT b.id, b."warehouseId", (b."onHand" - b."reserved")::int AS free
    FROM stock_balances b
    LEFT JOIN inventory_batches ib ON ib.id = b."batchId"
    JOIN warehouses w ON w.id = b."warehouseId" AND w.active AND w.kind = 'sellable'
    WHERE b."variantId" = ${variantId}
      AND b."onHand" - b."reserved" > 0
      AND (b."batchId" IS NULL OR (ib.status = 'available' AND (ib."expiresAt" IS NULL OR ib."expiresAt" > now())))
    ORDER BY ib."expiresAt" ASC NULLS LAST, b.id
    FOR UPDATE OF b`;
  let need = quantity;
  for (const c of candidates) {
    if (need === 0) break;
    const take = Math.min(need, c.free);
    await tx.stockBalance.update({ where: { id: c.id }, data: { reserved: { increment: take }, version: { increment: 1 } } });
    await tx.stockReservation.create({ data: { orderId, variantId, warehouseId: c.warehouseId, balanceId: c.id, quantity: take, expiresAt } });
    need -= take;
  }
  if (need > 0) throw new AppError(409, "stock_unavailable", "Sorry, there is not enough stock for one of your items. Please review your cart.");
}

/** Release active reservations (cancel/expiry). Idempotent: already-released rows are skipped. */
export async function releaseReservations(tx: Tx, orderId: string, reason: string) {
  const active = await tx.stockReservation.findMany({ where: { orderId, status: "active" } });
  for (const r of active) {
    const done = await tx.stockReservation.updateMany({ where: { id: r.id, status: "active" }, data: { status: "released", releasedAt: new Date() } });
    if (done.count) await tx.stockBalance.update({ where: { id: r.balanceId }, data: { reserved: { decrement: r.quantity }, version: { increment: 1 } } });
  }
  return { released: active.length, reason };
}

/** Convert reservations into a committed sale: on hand and reserved both drop; ledger records the issue. */
export async function commitReservations(tx: Tx, orderId: string, actorId: string | null) {
  const active = await tx.stockReservation.findMany({ where: { orderId, status: "active" }, include: { balance: true } });
  for (const r of active) {
    const done = await tx.stockReservation.updateMany({ where: { id: r.id, status: "active" }, data: { status: "committed", releasedAt: new Date() } });
    if (!done.count) continue;
    await tx.stockBalance.update({ where: { id: r.balanceId }, data: { onHand: { decrement: r.quantity }, reserved: { decrement: r.quantity }, version: { increment: 1 } } });
    await tx.stockMovement.create({
      data: { variantId: r.variantId, warehouseId: r.warehouseId, batchId: r.balance.batchId, delta: -r.quantity, reason: "sale_committed", reference: `order:${orderId}`, actorId },
    });
  }
  return active.length;
}

export async function receiveStock(
  db: Db,
  input: { variantId: string; warehouseCode: string; quantity: number; lot: string; manufacturedAt?: Date; expiresAt?: Date; note?: string },
  actorId: string,
) {
  return db.$transaction(async (tx) => {
    const wh = await tx.warehouse.findUnique({ where: { code: input.warehouseCode } });
    if (!wh) throw new AppError(404, "not_found", "Warehouse not found");
    const batch = await tx.inventoryBatch.upsert({
      where: { variantId_lot: { variantId: input.variantId, lot: input.lot } },
      create: { variantId: input.variantId, lot: input.lot, manufacturedAt: input.manufacturedAt, expiresAt: input.expiresAt },
      update: {},
    });
    const balance = await tx.stockBalance.upsert({
      where: { variantId_warehouseId_batchId: { variantId: input.variantId, warehouseId: wh.id, batchId: batch.id } },
      create: { variantId: input.variantId, warehouseId: wh.id, batchId: batch.id, onHand: input.quantity },
      update: { onHand: { increment: input.quantity }, version: { increment: 1 } },
    });
    const movement = await tx.stockMovement.create({
      data: { variantId: input.variantId, warehouseId: wh.id, batchId: batch.id, delta: input.quantity, reason: "receipt", reference: `lot:${input.lot}`, actorId, note: input.note },
    });
    return { balance, movement, batch };
  });
}
