// Identity and authorization are derived only from the verified Better Auth session.
// No route trusts a role, user id or account id supplied by the client.
import { type CanActivate, createParamDecorator, type ExecutionContext, Inject, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { auth } from "./auth.js";
import { prisma } from "./db.js";
import { forbidden, unauthenticated } from "./errors.js";
import type { PermissionKey } from "./permissions.js";

export interface Principal {
  userId: string;
  email: string;
  name: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  permissions: Set<PermissionKey>;
  isStaff: boolean;
  memberships: Array<{ accountId: string; role: string; accountStatus: string }>;
}

type Req = Request & { principal?: Principal | null; id?: string };

export async function resolvePrincipal(req: Req): Promise<Principal | null> {
  if (req.principal !== undefined) return req.principal;
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return (req.principal = null);
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      staffRoles: { include: { role: { include: { permissions: true } } } },
      memberships: { where: { status: "active" }, include: { account: { select: { status: true } } } },
    },
  });
  if (!user || user.status !== "active") return (req.principal = null);
  const permissions = new Set<PermissionKey>();
  for (const a of user.staffRoles) for (const p of a.role.permissions) permissions.add(p.permissionKey as PermissionKey);
  return (req.principal = {
    userId: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    twoFactorEnabled: !!user.twoFactorEnabled,
    permissions,
    isStaff: user.staffRoles.length > 0,
    memberships: user.memberships.map((m) => ({ accountId: m.accountId, role: m.role, accountStatus: m.account.status })),
  });
}

const PERMS_KEY = "oryvia:permissions";
const AUTH_KEY = "oryvia:auth";

/** Route requires a signed-in user. */
export const Authenticated = () => SetMetadata(AUTH_KEY, true);
/** Route requires a staff user holding every listed permission. */
export const RequirePermissions = (...perms: PermissionKey[]) => SetMetadata(PERMS_KEY, perms);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Req>();
    const perms = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(PERMS_KEY, [ctx.getHandler(), ctx.getClass()]);
    const needsAuth = this.reflector.getAllAndOverride<boolean | undefined>(AUTH_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!perms && !needsAuth) {
      await resolvePrincipal(req); // optional identity for public routes (e.g. cart ownership)
      return true;
    }
    const p = await resolvePrincipal(req);
    if (!p) throw unauthenticated();
    if (perms) {
      if (!p.isStaff) throw forbidden();
      const missing = perms.filter((k) => !p.permissions.has(k));
      if (missing.length) throw forbidden(`Missing permission: ${missing.join(", ")}`);
    }
    return true;
  }
}

export const CurrentPrincipal = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Req>().principal ?? null);
export const RequestId = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Req>().id ?? null);
