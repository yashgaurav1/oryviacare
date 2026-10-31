// Better Auth is the single session issuer. It runs inside the API process and stores
// users/sessions/accounts in PostgreSQL via its Prisma adapter. The web app never validates
// sessions itself; it forwards cookies to /api and the API resolves identity + permissions.
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins/two-factor";
import { env } from "./env.js";
import { prisma } from "./db.js";
import { enqueueOutbox } from "./outbox.js";

export const auth = betterAuth({
  appName: "Oryvia",
  baseURL: env.PUBLIC_ORIGIN,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.PUBLIC_ORIGIN],
  telemetry: { enabled: false },
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    // Messages go through the transactional outbox; the worker delivers them via the mail adapter.
    sendResetPassword: async ({ user, url }) => {
      await enqueueOutbox(prisma, "auth.password_reset", user.id, { to: user.email, url });
    },
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await enqueueOutbox(prisma, "auth.verify_email", user.id, { to: user.email, url });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
    },
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    cookiePrefix: "oryvia",
  },
  plugins: [twoFactor({ issuer: "Oryvia Pro" })],
});

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
