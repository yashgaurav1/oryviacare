import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function Register() {
  return (
    <AuthShell title="Create an account" intro="Customers only. Business partners apply separately after creating an account.">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
