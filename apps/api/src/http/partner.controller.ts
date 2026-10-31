import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { randomBytes } from "node:crypto";
import { ApplicationDecisionInput, PartnerApplicationInput } from "@oryvia/contracts";
import { z } from "zod";
import type { ApplicationState } from "@oryvia/db";
import { DbService } from "../core/db.js";
import { AppError, conflict, forbidden, notFound, parse, stale } from "../core/errors.js";
import { audit, enqueueOutbox } from "../core/outbox.js";
import { Authenticated, CurrentPrincipal, RequirePermissions, type Principal } from "../core/principal.js";

const TRANSITIONS: Record<ApplicationState, ApplicationState[]> = {
  draft: ["submitted"],
  submitted: ["under_review", "needs_information", "approved", "rejected"],
  under_review: ["needs_information", "approved", "rejected"],
  needs_information: ["submitted", "rejected"],
  approved: ["suspended"],
  rejected: [],
  suspended: ["approved"],
};

@ApiTags("partner")
@Controller("v1/partner")
export class PartnerController {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  @Get("programmes")
  programmes() {
    return this.db.client.partnerProgramme.findMany({ where: { active: true }, select: { key: true, name: true, businessType: true, requiredDocs: true } });
  }

  /** Save (draft) or submit the caller's own application. One open application per user. */
  @Post("applications")
  @Authenticated()
  async save(@Body() body: unknown, @Query("submit") submit: string | undefined, @CurrentPrincipal() p: Principal) {
    const input = parse(PartnerApplicationInput, body);
    const submitting = submit === "1";
    if (submitting && !input.acceptTerms) throw new AppError(422, "validation_failed", "Please accept the programme terms to submit", { acceptTerms: ["Required"] });
    const programme = await this.db.client.partnerProgramme.findUnique({ where: { key: input.programmeKey } });
    if (!programme || !programme.active) throw notFound("Programme");
    const open = await this.db.client.partnerApplication.findFirst({ where: { userId: p.userId, state: { in: ["draft", "needs_information", "submitted", "under_review"] } } });
    if (open && !["draft", "needs_information"].includes(open.state)) throw conflict("Your application has been submitted and is being reviewed");
    return this.db.client.$transaction(async (tx) => {
      const data = { ...input, acceptTerms: undefined };
      const app = open
        ? await tx.partnerApplication.update({
            where: { id: open.id },
            data: { data, programmeId: programme.id, businessType: input.businessType, version: { increment: 1 }, ...(submitting ? { state: "submitted", submittedAt: new Date(), submittedVersion: open.version + 1 } : {}) },
          })
        : await tx.partnerApplication.create({
            data: {
              reference: `APP-${randomBytes(4).toString("hex").toUpperCase()}`,
              userId: p.userId,
              programmeId: programme.id,
              businessType: input.businessType,
              data,
              ...(submitting ? { state: "submitted", submittedAt: new Date(), submittedVersion: 1 } : {}),
            },
          });
      if (submitting) {
        await tx.consentEvent.create({ data: { userId: p.userId, purpose: "partner_programme_terms", decision: true, source: "partner_application", policyVersion: "pending-merchant-terms" } });
        await enqueueOutbox(tx, "partner.application_submitted", app.id, { to: p.email, reference: app.reference });
      }
      return { reference: app.reference, state: app.state, version: app.version };
    });
  }

  @Get("applications/mine")
  @Authenticated()
  async mine(@CurrentPrincipal() p: Principal) {
    const rows = await this.db.client.partnerApplication.findMany({
      where: { userId: p.userId },
      orderBy: { createdAt: "desc" },
      include: { reviews: { orderBy: { createdAt: "asc" }, select: { toState: true, reason: true, requestedFields: true, createdAt: true } }, programme: { select: { name: true } } },
    });
    return rows.map((a) => ({ reference: a.reference, state: a.state, programme: a.programme.name, data: a.data, version: a.version, history: a.reviews, submittedAt: a.submittedAt }));
  }

  /** Partner workspace context: only accounts the caller is an active member of, never an id from the client. */
  @Get("workspace")
  @Authenticated()
  async workspace(@CurrentPrincipal() p: Principal) {
    const m = p.memberships.find((x) => x.accountStatus === "active");
    if (!m) throw forbidden("No approved business account is linked to your login");
    const account = await this.db.client.businessAccount.findUniqueOrThrow({ where: { id: m.accountId }, include: { tier: { include: { programme: true } } } });
    const [orders, quotes] = await Promise.all([
      this.db.client.order.findMany({ where: { businessAccountId: account.id }, orderBy: { placedAt: "desc" }, take: 20 }),
      this.db.client.quoteRequest.findMany({ where: { businessAccountId: account.id }, orderBy: { createdAt: "desc" }, take: 20, include: { package: { select: { name: true } } } }),
    ]);
    return {
      account: { id: account.id, displayName: account.displayName, type: account.type, status: account.status, tier: account.tier?.name ?? null, programme: account.tier?.programme.name ?? null },
      role: m.role,
      orders: orders.map((o) => ({ reference: o.publicReference, state: o.state, paymentState: o.paymentState, totalPaise: o.totalPaise, placedAt: o.placedAt })),
      quotes: quotes.map((q) => ({ reference: q.reference, package: q.package?.name ?? null, status: q.status, createdAt: q.createdAt })),
      commissionProgramme: null, // no approved commission rule exists; commission views stay hidden
    };
  }
}

@ApiTags("admin")
@Controller("v1/admin/applications")
export class AdminApplicationsController {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  @Get()
  @RequirePermissions("partners.applications.review")
  async list(@Query() raw: Record<string, string>) {
    const q = z.object({ state: z.string().max(30).optional() }).parse(raw);
    return this.db.client.partnerApplication.findMany({
      where: q.state ? { state: q.state as ApplicationState } : {},
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      include: { user: { select: { email: true, name: true } }, programme: { select: { name: true } }, reviews: { orderBy: { createdAt: "asc" } } },
    });
  }

  @Post(":id/decision")
  @RequirePermissions("partners.applications.decide")
  async decide(@Param("id") id: string, @Body() body: unknown, @CurrentPrincipal() p: Principal) {
    const input = parse(ApplicationDecisionInput, body);
    return this.db.client.$transaction(async (tx) => {
      const app = await tx.partnerApplication.findUnique({ where: { id }, include: { programme: { include: { tiers: true } } } });
      if (!app) throw notFound("Application");
      if (app.version !== input.version) throw stale();
      if (app.userId === p.userId) throw forbidden("You cannot decide your own application");
      if (!TRANSITIONS[app.state].includes(input.to)) throw conflict(`An application that is ${app.state} cannot move to ${input.to}`);
      let businessAccountId = app.businessAccountId;
      const d = app.data as { businessName: string; legalName?: string; gstin?: string };
      if (input.to === "approved") {
        if (!businessAccountId) {
          const acct = await tx.businessAccount.create({
            data: { type: app.businessType, displayName: d.businessName, legalName: d.legalName || null, gstin: d.gstin || null, tierId: app.programme.tiers[0]?.id ?? null },
          });
          businessAccountId = acct.id;
          await tx.membership.create({ data: { accountId: acct.id, userId: app.userId, role: "owner" } });
        } else {
          await tx.businessAccount.update({ where: { id: businessAccountId }, data: { status: "active" } });
        }
      }
      if (input.to === "suspended" && businessAccountId) await tx.businessAccount.update({ where: { id: businessAccountId }, data: { status: "suspended" } });
      const upd = await tx.partnerApplication.updateMany({
        where: { id, version: input.version },
        data: { state: input.to, businessAccountId, decidedAt: ["approved", "rejected"].includes(input.to) ? new Date() : undefined, version: { increment: 1 } },
      });
      if (!upd.count) throw stale();
      await tx.applicationReview.create({ data: { applicationId: id, reviewerId: p.userId, fromState: app.state, toState: input.to, reason: input.reason, requestedFields: input.requestedFields ?? undefined } });
      await audit(tx, { actorId: p.userId, action: `application.${input.to}`, objectType: "partner_application", objectId: id, reason: input.reason });
      const user = await tx.user.findUniqueOrThrow({ where: { id: app.userId } });
      await enqueueOutbox(tx, "partner.application_decided", id, { to: user.email, reference: app.reference, state: input.to });
      return tx.partnerApplication.findUniqueOrThrow({ where: { id } });
    });
  }
}
