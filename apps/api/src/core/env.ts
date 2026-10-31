import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  PUBLIC_ORIGIN: z.string().url(),
  API_PORT: z.coerce.number().int().default(4000),
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
  ALLOW_DEV_MANUAL_PAYMENT: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type AppEnv = z.infer<typeof Env>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.ALLOW_DEV_MANUAL_PAYMENT)
    throw new Error("ALLOW_DEV_MANUAL_PAYMENT must be false in production");
  return parsed.data;
}

export const env = loadEnv();
