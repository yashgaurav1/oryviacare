"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Banner, Field } from "./forms";

async function authCall(path: string, body: unknown) {
  try {
    const r = await fetch(`/api/auth${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, message: (j as { message?: string }).message ?? null };
  } catch {
    return { ok: false, status: 0, message: "We could not reach the server. Try again." };
  }
}

/** After sign-in the guest cart is merged server-side; the response reports anything that could not be merged. */
async function mergeCart() {
  await fetch("/api/v1/carts/merge", { method: "POST", credentials: "same-origin" }).catch(() => null);
}

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/account");

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await authCall("/sign-in/email", { email, password });
        if (!r.ok) {
          setBusy(false);
          // Same message for unknown email and wrong password: no account enumeration.
          setError(r.status === 429 ? "Too many attempts. Please wait a minute and try again." : "Email or password is incorrect.");
          return;
        }
        await mergeCart();
        router.push(next);
        router.refresh();
      }}
    >
      <Field id="l-email" label="Email"><input id="l-email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
      <Field id="l-pw" label="Password"><input id="l-pw" type="password" className="input" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
      {error && <Banner tone="error">{error}</Banner>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <p className="flex justify-between text-sm">
        <Link href="/forgot-password" className="underline">Forgot password?</Link>
        <Link href={`/register${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`} className="underline">Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (f.password.length < 10) return setError("Use at least 10 characters for your password.");
        setBusy(true);
        setError(null);
        const r = await authCall("/sign-up/email", f);
        if (!r.ok) {
          setBusy(false);
          setError(r.status === 429 ? "Too many attempts. Please wait and try again." : "We could not create the account. If you already have one, sign in or reset your password.");
          return;
        }
        await mergeCart();
        router.push(next);
        router.refresh();
      }}
    >
      <Field id="r-name" label="Name"><input id="r-name" className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
      <Field id="r-email" label="Email"><input id="r-email" type="email" className="input" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></Field>
      <Field id="r-pw" label="Password" hint="At least 10 characters"><input id="r-pw" type="password" className="input" required minLength={10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></Field>
      {error && <Banner tone="error">{error}</Banner>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      <p className="text-xs text-muted">We will email you a link to verify your address. See our <Link href="/policies/privacy" className="underline">privacy policy</Link>.</p>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  if (state === "sent") return <Banner tone="success">If an account exists for {email}, a reset link is on its way. Check your inbox.</Banner>;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        await authCall("/request-password-reset", { email, redirectTo: "/reset-password" });
        setState("sent"); // identical outcome whether or not the email is registered
      }}
    >
      <Field id="fp-email" label="Email"><input id="fp-email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
      <button className="btn btn-primary w-full" disabled={state === "busy"}>Send reset link</button>
    </form>
  );
}

export function ResetForm() {
  const token = useSearchParams().get("token");
  const [pw, setPw] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  if (!token) return <Banner tone="error">This reset link is missing its token. Request a new link.</Banner>;
  if (state === "done") return <Banner tone="success">Password updated. Other sessions were signed out. <Link href="/login" className="underline">Sign in</Link></Banner>;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        const r = await authCall("/reset-password", { newPassword: pw, token });
        if (r.ok) setState("done");
        else {
          setState("idle");
          setError("This link has expired or was already used. Request a new one.");
        }
      }}
    >
      <Field id="rp" label="New password" hint="At least 10 characters"><input id="rp" type="password" minLength={10} required className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
      {error && <Banner tone="error">{error}</Banner>}
      <button className="btn btn-primary w-full" disabled={state === "busy"}>Set new password</button>
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-secondary"
      onClick={async () => {
        await authCall("/sign-out", {});
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
