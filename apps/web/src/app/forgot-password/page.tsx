import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function Forgot() {
  return (
    <div className="mx-auto max-w-md px-5 py-14">
      <h1 className="mb-2 font-display text-4xl">Reset your password</h1>
      <p className="mb-8 text-muted">We will email you a link to choose a new password.</p>
      <div className="card p-6 sm:p-8">
        <Suspense>
          <ForgotForm />
        </Suspense>
      </div>
    </div>
  );
}
