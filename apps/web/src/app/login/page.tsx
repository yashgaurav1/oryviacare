import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function Login() {
  return (
    <div className="mx-auto max-w-md px-5 py-14">
      <h1 className="mb-2 font-display text-4xl">Sign in</h1>
      <p className="mb-8 text-muted">Track orders and check out faster.</p>
      <div className="card p-6 sm:p-8">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
