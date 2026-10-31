import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function Login() {
  return (
    <AuthShell title="Sign in" intro="Track orders and check out faster.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
