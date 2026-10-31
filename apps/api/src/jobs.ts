// Durable background jobs, polled from PostgreSQL (no Redis available locally; see docs/DECISIONS.md D-004).
// Each handler is idempotent; rows are claimed with SKIP LOCKED so multiple workers never double-process.
import type { Db } from "@oryvia/db";
import { expireUnpaidReservations } from "./commerce/orders.js";

const MAX_ATTEMPTS = 8;

export interface MailAdapter {
  name: string;
  send(msg: { to: string; template: string; data: Record<string, unknown> }): Promise<{ providerId: string | null; state: "sent" | "captured_dev" | "not_sent_no_provider" }>;
}

/** Development mail sink: writes the message to the job log and database. It does not deliver email. */
export const devMailSink: MailAdapter = {
  name: "dev_mail_sink",
  async send(msg) {
    console.log(`[dev-mail-sink] to=${msg.to} template=${msg.template} data=${JSON.stringify(msg.data)}`);
    return { providerId: null, state: "captured_dev" };
  },
};

/**
 * Production stand-in until a real email provider is connected: nothing is sent and nothing personal is logged
 * (reset and verification links are credentials). Messages are recorded as not sent so they can be retried later.
 */
export const noProviderMail: MailAdapter = {
  name: "no_provider",
  async send(msg) {
    console.warn(`[mail] not sent, no email provider configured (template=${msg.template})`);
    return { providerId: null, state: "not_sent_no_provider" };
  },
};

const defaultMail = () => (process.env.NODE_ENV === "production" ? noProviderMail : devMailSink);

const TEMPLATE_BY_TOPIC: Record<string, string> = {
  "order.placed": "order_received",
  "order.confirmed": "order_confirmed",
  "order.cancelled": "order_cancelled",
  "auth.verify_email": "verify_email",
  "auth.password_reset": "password_reset",
  "enquiry.created": "enquiry_received",
  "quote.requested": "quote_received",
  "partner.application_submitted": "application_received",
  "partner.application_decided": "application_decision",
};

export async function processOutbox(db: Db, mail: MailAdapter, batch = 25) {
  const claimed = await db.$queryRaw<Array<{ id: string }>>`
    UPDATE outbox_events SET status = 'processing', attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM outbox_events
      WHERE status IN ('pending', 'retry') AND "availableAt" <= now()
      ORDER BY "createdAt" LIMIT ${batch}
      FOR UPDATE SKIP LOCKED)
    RETURNING id`;
  let done = 0;
  for (const { id } of claimed) {
    const ev = await db.outboxEvent.findUniqueOrThrow({ where: { id } });
    const payload = ev.payload as Record<string, unknown>;
    try {
      const template = TEMPLATE_BY_TOPIC[ev.topic];
      const to = typeof payload.to === "string" ? payload.to : typeof payload.email === "string" ? payload.email : null;
      if (template && to) {
        const already = await db.notificationDelivery.findUnique({ where: { outboxId_channel_recipient: { outboxId: ev.id, channel: "email", recipient: to } } });
        if (!already) {
          const r = await mail.send({ to, template, data: payload });
          await db.notificationDelivery.create({ data: { outboxId: ev.id, channel: "email", recipient: to, template, state: r.state, providerId: r.providerId } });
        }
      }
      await db.outboxEvent.update({ where: { id }, data: { status: "done", processedAt: new Date(), lastError: null } });
      done++;
    } catch (e) {
      const dead = ev.attempts >= MAX_ATTEMPTS;
      await db.outboxEvent.update({
        where: { id },
        data: { status: dead ? "dead" : "retry", lastError: String((e as Error).message).slice(0, 500), availableAt: new Date(Date.now() + 2 ** ev.attempts * 1000) },
      });
    }
  }
  return { claimed: claimed.length, done };
}

export async function runJobsOnce(db: Db, mail: MailAdapter = defaultMail()) {
  const started = new Date();
  const outbox = await processOutbox(db, mail);
  const expiry = await expireUnpaidReservations(db);
  // Stored idempotent responses can contain a one-time tracking token; keep them only for their 24h TTL.
  await db.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  if (outbox.claimed || expiry.cancelled)
    await db.auditEvent.create({ data: { action: "jobs.tick", objectType: "job", objectId: "worker", data: { outbox, expiry, startedAt: started.toISOString() } } });
  return { outbox, expiry };
}
