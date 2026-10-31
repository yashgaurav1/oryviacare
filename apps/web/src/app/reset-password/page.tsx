import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function Reset() {
  return (
    <div className="mx-auto max-w-md px-5 py-14">
      <h1 className="mb-2 font-display text-4xl">Choose a new password</h1>
      <p className="mb-8 text-muted">Links expire after a short time for your security.</p>
      <div className="card p-6 sm:p-8">
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
