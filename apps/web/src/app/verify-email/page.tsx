import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Email verification", robots: { index: false } };

/** Better Auth verifies the token at /api/auth/verify-email and redirects here with ?error on failure. */
export default async function VerifyEmail({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-5 py-14">
      <h1 className="mb-4 font-display text-4xl">{error ? "Link not valid" : "Email verified"}</h1>
      <p className="mb-8 text-muted">{error ? "This verification link has expired or was already used. Sign in to request a new one." : "Thanks: your email address is confirmed."}</p>
      <Link href="/account" className="btn btn-primary">Go to my account</Link>
    </div>
  );
}
