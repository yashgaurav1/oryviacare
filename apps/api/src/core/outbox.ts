import type { Db, Tx } from "@oryvia/db";

/** Write an outbox event in the caller's transaction so committed state can never lose its notification. */
export async function enqueueOutbox(db: Db | Tx, topic: string, aggregateId: string, payload: Record<string, unknown>) {
  await db.outboxEvent.create({ data: { topic, aggregateId, payload: payload as object } });
}

export async function audit(
  db: Db | Tx,
  e: { actorId: string | null; action: string; objectType: string; objectId: string; reason?: string; requestId?: string; data?: Record<string, unknown> },
) {
  await db.auditEvent.create({ data: { ...e, data: (e.data ?? undefined) as object | undefined } });
}
