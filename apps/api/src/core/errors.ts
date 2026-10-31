import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import type { ApiErrorCode } from "@oryvia/contracts";
import type { Request, Response } from "express";
import { ZodError, type ZodType } from "zod";

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new AppError(404, "not_found", `${what} not found`);
export const forbidden = (msg = "You do not have permission to do this") => new AppError(403, "forbidden", msg);
export const unauthenticated = () => new AppError(401, "unauthenticated", "Sign in to continue");
export const stale = () => new AppError(409, "stale_version", "This record changed since you loaded it. Refresh and try again.");
export const conflict = (msg: string) => new AppError(409, "commercial_conflict", msg);
export const unavailable = (msg: string) => new AppError(503, "integration_unavailable", msg);

export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw zodToAppError(r.error);
  return r.data;
}

function zodToAppError(e: ZodError) {
  const fields: Record<string, string[]> = {};
  for (const i of e.issues) (fields[i.path.join(".") || "_"] ??= []).push(i.message);
  return new AppError(422, "validation_failed", "Some fields need attention", fields);
}

@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly log = new Logger("Error");
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request>();
    const requestId = (req as Request & { id?: string }).id;
    if (err instanceof AppError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, fields: err.fields, requestId } });
      return;
    }
    if (err instanceof ZodError) {
      const e = zodToAppError(err);
      res.status(422).json({ error: { code: e.code, message: e.message, fields: e.fields, requestId } });
      return;
    }
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const code: ApiErrorCode = status === 404 ? "not_found" : status === 401 ? "unauthenticated" : status === 403 ? "forbidden" : status === 429 ? "rate_limited" : "validation_failed";
      res.status(status).json({ error: { code, message: err.message, requestId } });
      return;
    }
    // Prisma CHECK violation on stock means another buyer took the last unit.
    const msg = String((err as Error)?.message ?? err);
    if (/stock_balances_nonnegative/.test(msg)) {
      res.status(409).json({ error: { code: "stock_unavailable", message: "Not enough stock for this quantity", requestId } });
      return;
    }
    this.log.error(`${req.method} ${req.path} [${requestId}] ${(err as Error)?.stack ?? msg}`);
    res.status(500).json({ error: { code: "internal", message: "Something went wrong on our side. Please try again.", requestId } });
  }
}
