// Idempotency keys bound to principal + operation + request hash.
// A retried request with the same key returns the stored response; a different body with the same key is rejected.
import { createHash } from "node:crypto";
import { Prisma } from "@oryvia/db";
import { prisma } from "./db.js";
import { AppError } from "./errors.js";

const TTL_MS = 24 * 60 * 60 * 1000;

export const hashBody = (body: unknown) => createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");

export async function withIdempotency<T extends object>(
  key: string | undefined,
  principal: string,
  operation: string,
  body: unknown,
  run: () => Promise<{ status: number; body: T }>,
): Promise<{ status: number; body: T; replayed: boolean }> {
  if (!key || !/^[A-Za-z0-9_-]{16,128}$/.test(key))
    throw new AppError(422, "validation_failed", "An Idempotency-Key header (16-128 URL-safe characters) is required");
  const requestHash = hashBody(body);
  const scopedKey = `${operation}:${principal}:${key}`;
  try {
    await prisma.idempotencyKey.create({ data: { key: scopedKey, principal, operation, requestHash, expiresAt: new Date(Date.now() + TTL_MS) } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    const existing = await prisma.idempotencyKey.findUniqueOrThrow({ where: { key: scopedKey } });
    if (existing.requestHash !== requestHash)
      throw new AppError(409, "idempotency_conflict", "This idempotency key was already used for a different request");
    if (existing.status === "completed") return { status: existing.responseCode!, body: existing.responseBody as T, replayed: true };
    if (existing.status === "in_progress") throw new AppError(409, "idempotency_conflict", "This request is already being processed. Please wait a moment.");
    // failed: allow a clean retry
    await prisma.idempotencyKey.update({ where: { key: scopedKey }, data: { status: "in_progress", responseBody: Prisma.DbNull, responseCode: null } });
  }
  try {
    const result = await run();
    await prisma.idempotencyKey.update({ where: { key: scopedKey }, data: { status: "completed", responseCode: result.status, responseBody: result.body as object } });
    return { ...result, replayed: false };
  } catch (e) {
    // Business rejections are final for this key; unexpected failures can be retried.
    if (e instanceof AppError && e.status < 500) {
      await prisma.idempotencyKey.update({
        where: { key: scopedKey },
        data: { status: "completed", responseCode: e.status, responseBody: { error: { code: e.code, message: e.message, fields: e.fields } } },
      });
    } else {
      await prisma.idempotencyKey.update({ where: { key: scopedKey }, data: { status: "failed" } });
    }
    throw e;
  }
}
