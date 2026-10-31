"use client";
import { useState, type ReactNode } from "react";
import { call, type ClientError } from "@/lib/client";

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string[];
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {hint && !error?.length && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error?.map((e) => (
        <p key={e} id={`${id}-error`} className="field-error" role="alert">
          {e}
        </p>
      ))}
    </div>
  );
}

export function Banner({ tone, children }: { tone: "success" | "error" | "warning" | "info"; children: ReactNode }) {
  const cls = { success: "bg-success-bg text-success", error: "bg-error-bg text-error", warning: "bg-warning-bg text-warning", info: "bg-info-bg text-info" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

function useSubmit<T>() {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<ClientError | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const submit = async (path: string, body: unknown) => {
    setState("saving");
    setError(null);
    const r = await call<T>(path, { method: "POST", body });
    if (r.ok) {
      setResult(r.data);
      setState("done");
    } else {
      setError(r.error);
      setState("idle");
    }
    return r;
  };
  return { state, error, result, submit, fields: error?.fields ?? {} };
}

export function NewsletterForm() {
  const { state, error, result, submit } = useSubmit<{ status: string }>();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  if (state === "done" && result)
    return <Banner tone="success">{result.status === "already_subscribed" ? "You are already subscribed." : "Subscribed. Your consent has been recorded."}</Banner>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit("/v1/newsletter", { email, consent });
      }}
      className="space-y-2"
    >
      <label htmlFor="nl-email" className="label">
        Product news by email
      </label>
      <div className="flex gap-2">
        <input id="nl-email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        <button className="btn btn-primary shrink-0" disabled={state === "saving" || !consent}>
          {state === "saving" ? "Saving…" : "Subscribe"}
        </button>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4" />I agree to receive marketing emails from Oryvia and can unsubscribe at any time.
      </label>
      {error && <p className="field-error">{error.fields?.email?.[0] ?? error.message}</p>}
    </form>
  );
}

export function ContactForm() {
  const { state, error, result, submit, fields } = useSubmit<{ reference: string }>();
  const [f, setF] = useState({ name: "", email: "", phone: "", topic: "product", message: "", consentToContact: false });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  if (state === "done" && result)
    return (
      <Banner tone="success">
        Thank you. Your enquiry reference is <strong className="tabular">{result.reference}</strong>. Keep it for follow-up; we will reply by email.
      </Banner>
    );
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit("/v1/contact", f);
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field id="c-name" label="Your name" error={fields.name}>
        <input id="c-name" className="input" value={f.name} onChange={set("name")} autoComplete="name" aria-invalid={!!fields.name} />
      </Field>
      <Field id="c-email" label="Email" error={fields.email}>
        <input id="c-email" type="email" className="input" value={f.email} onChange={set("email")} autoComplete="email" aria-invalid={!!fields.email} />
      </Field>
      <Field id="c-phone" label="Mobile (optional)" error={fields.phone}>
        <input id="c-phone" type="tel" className="input" value={f.phone} onChange={set("phone")} autoComplete="tel" inputMode="tel" aria-invalid={!!fields.phone} />
      </Field>
      <Field id="c-topic" label="Topic" error={fields.topic}>
        <select id="c-topic" className="input" value={f.topic} onChange={set("topic")}>
          <option value="product">A product</option>
          <option value="order">An order</option>
          <option value="business">Salon / business packages</option>
          <option value="ingredients">Ingredient information</option>
          <option value="other">Something else</option>
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field id="c-message" label="Message" error={fields.message}>
          <textarea id="c-message" rows={5} className="input py-3" value={f.message} onChange={set("message")} aria-invalid={!!fields.message} />
        </Field>
      </div>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" className="mt-1 size-4" checked={f.consentToContact} onChange={(e) => setF({ ...f, consentToContact: e.target.checked })} />
        Oryvia may use these details to reply to this enquiry.
      </label>
      {fields.consentToContact && <p className="field-error sm:col-span-2">{fields.consentToContact[0]}</p>}
      {error && !error.fields && <div className="sm:col-span-2"><Banner tone="error">{error.message}</Banner></div>}
      <div className="sm:col-span-2">
        <button className="btn btn-primary" disabled={state === "saving"}>
          {state === "saving" ? "Sending…" : "Send enquiry"}
        </button>
      </div>
    </form>
  );
}

export function QuoteForm({ packageSlug }: { packageSlug?: string }) {
  const { state, error, result, submit, fields } = useSubmit<{ reference: string }>();
  const [f, setF] = useState({ contactName: "", email: "", phone: "", businessName: "", city: "", message: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  if (state === "done" && result)
    return (
      <Banner tone="success">
        Quote request received. Reference <strong className="tabular">{result.reference}</strong>. Oryvia will confirm current price and composition with you.
      </Banner>
    );
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit("/v1/quotes", { ...f, packageSlug });
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field id="q-name" label="Contact name" error={fields.contactName}>
        <input id="q-name" className="input" value={f.contactName} onChange={set("contactName")} autoComplete="name" />
      </Field>
      <Field id="q-business" label="Business name (optional)" error={fields.businessName}>
        <input id="q-business" className="input" value={f.businessName} onChange={set("businessName")} autoComplete="organization" />
      </Field>
      <Field id="q-email" label="Email" error={fields.email}>
        <input id="q-email" type="email" className="input" value={f.email} onChange={set("email")} autoComplete="email" />
      </Field>
      <Field id="q-phone" label="Mobile" error={fields.phone}>
        <input id="q-phone" type="tel" inputMode="tel" className="input" value={f.phone} onChange={set("phone")} autoComplete="tel" />
      </Field>
      <Field id="q-city" label="City (optional)" error={fields.city}>
        <input id="q-city" className="input" value={f.city} onChange={set("city")} autoComplete="address-level2" />
      </Field>
      <div className="sm:col-span-2">
        <Field id="q-msg" label="Anything we should know? (optional)" error={fields.message}>
          <textarea id="q-msg" rows={3} className="input py-3" value={f.message} onChange={set("message")} />
        </Field>
      </div>
      {error && !error.fields && <div className="sm:col-span-2"><Banner tone="error">{error.message}</Banner></div>}
      <div className="sm:col-span-2">
        <button className="btn btn-primary" disabled={state === "saving"}>
          {state === "saving" ? "Sending…" : "Request a quote"}
        </button>
      </div>
    </form>
  );
}
