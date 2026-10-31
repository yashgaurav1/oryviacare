import { SignOutButton } from "@/components/auth-forms";
import { api, type Me } from "@/lib/api";
import { TwoFactor } from "./two-factor";

export default async function Settings() {
  const me = await api<Me>("/v1/account/me");
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Settings &amp; security</h1>
      <section className="card p-6">
        <h2 className="mb-2 font-display text-2xl">Profile</h2>
        <dl className="grid grid-cols-[8rem_1fr] gap-2">
          <dt className="text-muted">Name</dt><dd>{me.name}</dd>
          <dt className="text-muted">Email</dt><dd>{me.email} {me.emailVerified ? "· verified" : "· not verified"}</dd>
        </dl>
        <p className="mt-4 text-sm text-muted">Profile editing, notification preferences and data export/deletion requests are not available yet. Contact us for any of these.</p>
      </section>
      <section className="card p-6">
        <h2 className="mb-4 font-display text-2xl">Two-factor authentication</h2>
        <TwoFactor enabled={me.twoFactorEnabled} />
      </section>
      <section className="card p-6">
        <h2 className="mb-4 font-display text-2xl">Session</h2>
        <SignOutButton />
      </section>
    </div>
  );
}
