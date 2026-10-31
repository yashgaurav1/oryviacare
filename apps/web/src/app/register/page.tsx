import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function Register() {
  return (
    <div className="mx-auto max-w-md px-5 py-14">
      <h1 className="mb-2 font-display text-4xl">Create an account</h1>
      <p className="mb-8 text-muted">Customers only. Business partners apply separately after creating an account.</p>
      <div className="card p-6 sm:p-8">
        <Suspense>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
