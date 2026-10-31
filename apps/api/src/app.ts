import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Controller, Get, Module, type INestApplication } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { auth } from "./core/auth.js";
import { DbModule, DbService } from "./core/db.js";
import { ErrorFilter } from "./core/errors.js";
import { AuthGuard } from "./core/principal.js";
import { AdminController } from "./http/admin.controller.js";
import { OperationsController } from "./http/operations.controller.js";
import { AdminApplicationsController, PartnerController } from "./http/partner.controller.js";
import { CatalogController, ContentController, EnquiryController, PackagesController } from "./http/public.controller.js";
import { CartController, CheckoutController, OrdersController } from "./http/shop.controller.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

@Controller("health")
class HealthController {
  constructor(private readonly db: DbService) {}
  @Get("live")
  live() {
    return { status: "ok" };
  }
  @Get("ready")
  async ready() {
    await this.db.client.$queryRaw`SELECT 1`;
    return { status: "ready", database: "ok" };
  }
}

@Module({
  imports: [DbModule],
  controllers: [
    HealthController,
    CatalogController,
    PackagesController,
    EnquiryController,
    ContentController,
    CartController,
    CheckoutController,
    OrdersController,
    PartnerController,
    AdminController,
    OperationsController,
    AdminApplicationsController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
})
class AppModule {}

export async function createApp(opts: { logger?: boolean } = {}): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: opts.logger === false ? false : ["error", "warn", "log"] });
  app.setGlobalPrefix("api");
  const server = app.getHttpAdapter().getInstance() as express.Express;
  server.disable("x-powered-by");
  server.set("trust proxy", 1);
  const strict = helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, crossOriginResourcePolicy: { policy: "same-origin" } });
  const docsCsp = helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:"] } } });
  server.use((req: Request, res: Response, next: NextFunction) => (req.path.startsWith("/api/docs") ? docsCsp : strict)(req, res, next));
  server.use((req: Request & { id?: string }, res: Response, next: NextFunction) => {
    const incoming = req.header("x-request-id");
    req.id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    res.setHeader("x-request-id", req.id);
    next();
  });
  // Better Auth must see the raw request body, so it is mounted before the JSON parser.
  server.all("/api/auth/*splat", toNodeHandler(auth));
  server.use(cookieParser());
  server.use(express.json({ limit: "256kb" }));
  // Public brand media copied from the source site. Private uploads are never served from here.
  server.use("/media", express.static(join(REPO_ROOT, "storage", "public", "media"), { immutable: true, maxAge: "365d", index: false, dotfiles: "deny" }));

  const docs = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle("Oryvia Pro API").setVersion("1").setDescription("Storefront, account, partner and admin API. Session cookie auth via /api/auth.").build(),
  );
  SwaggerModule.setup("api/docs", app, docs, { jsonDocumentUrl: "api/openapi.json" });
  return app;
}
