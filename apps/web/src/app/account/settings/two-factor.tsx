"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banner, Field } from "@/components/forms";

/** Better Auth two-factor enrolment: enable (password) → scan/enter TOTP secret → verify a code. */
export function TwoFactor({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{ totpURI: string; backupCodes: string[] } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const post = async (path: string, body: unknown) => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/auth${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError((j as { message?: string }).message ?? "That did not work. Check and try again.");
    return r.ok ? j : null;
  };
  if (enabled) return <Banner tone="success">Two-factor authentication is on for your account.</Banner>;
  if (!setup)
    return (
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); const r = await post("/two-factor/enable", { password }); if (r) setSetup(r as typeof setup); }}>
        <p className="text-muted">Required for staff who approve prices or packages. You will need an authenticator app.</p>
        <Field id="tf-pw" label="Confirm your password"><input id="tf-pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        {error && <Banner tone="error">{error}</Banner>}
        <button className="btn btn-primary" disabled={busy || !password}>Set up two-factor</button>
      </form>
    );
  const secret = new URL(setup.totpURI).searchParams.get("secret");
  return (
    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); const r = await post("/two-factor/verify-totp", { code }); if (r) router.refresh(); }}>
      <p>Add this key to your authenticator app, then enter the 6-digit code it shows.</p>
      <p className="tabular break-all rounded-xl bg-sunk p-3 font-mono text-sm">{secret}</p>
      <details><summary className="cursor-pointer text-sm">Backup codes (store them safely)</summary><ul className="tabular mt-2 grid grid-cols-2 gap-1 font-mono text-sm">{setup.backupCodes.map((c) => <li key={c}>{c}</li>)}</ul></details>
      <Field id="tf-code" label="6-digit code"><input id="tf-code" inputMode="numeric" maxLength={6} className="input" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" /></Field>
      {error && <Banner tone="error">{error}</Banner>}
      <button className="btn btn-primary" disabled={busy || code.length !== 6}>Verify and turn on</button>
    </form>
  );
}
