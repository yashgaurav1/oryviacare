"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatPaise } from "@oryvia/contracts";
import { Banner, Field } from "@/components/forms";
import { call, cartChanged, newIdempotencyKey, type ClientError } from "@/lib/client";
import { Stepper } from "@/components/stepper";

interface Quote {
  lines: Array<{ variantId: string; productName: string; quantity: number; lineSubtotalPaise: number }>;
  problems: Array<{ message: string }>;
  subtotalPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  tax: { mode: string; configured: boolean; note: string };
  shipping: { label: string; isDevelopment: boolean } | null;
  hash: string;
}
interface Method {
  key: "razorpay" | "dev_manual";
  label: string;
  available: boolean;
  unavailableReason: string | null;
  notice?: string;
}

const STATES = ["Andaman and Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chandigarh","Chhattisgarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir","Jharkhand","Karnataka","Kerala","Ladakh","Lakshadweep","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Puducherry","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"];

export function CheckoutForm({ methods, email: initialEmail }: { methods: Method[]; email: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [addr, setAddr] = useState({ name: "", phone: "", line1: "", line2: "", city: "", state: "", postalCode: "" });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [method, setMethod] = useState<Method["key"] | null>(methods.find((m) => m.available)?.key ?? null);
  const [error, setError] = useState<ClientError | null>(null);
  const [step, setStep] = useState<"details" | "review" | "placing">("details");
  const [changed, setChanged] = useState(false);
  // One key per checkout attempt: retries and double-clicks reuse it, so only one order can be created.
  const idemKey = useRef(newIdempotencyKey());
  const fields = error?.fields ?? {};
  const checkout = { email, shippingAddress: addr, billingSameAsShipping: true };

  const getQuote = async () => {
    setError(null);
    const r = await call<Quote>("/v1/checkout/quote", { method: "POST", body: checkout });
    if (!r.ok) return setError(r.error);
    setQuote(r.data);
    setStep("review");
  };

  const place = async () => {
    if (!quote || !method) return;
    setStep("placing");
    setError(null);
    const r = await call<{ reference: string; trackingToken: string; isDevelopmentOrder: boolean }>("/v1/checkout/orders", {
      method: "POST",
      body: { quoteHash: quote.hash, paymentMethod: method, checkout },
      headers: { "idempotency-key": idemKey.current },
    });
    if (r.ok) {
      cartChanged(0);
      sessionStorage.setItem(`oryvia:order:${r.data.reference}`, r.data.trackingToken);
      router.push(`/checkout/result?ref=${encodeURIComponent(r.data.reference)}`);
      return;
    }
    if (r.error.code === "commercial_conflict" && r.error.fields?.quote) {
      // Server repriced: show the new total before asking again, with a fresh attempt key.
      idemKey.current = newIdempotencyKey();
      setChanged(true);
      await getQuote();
      return;
    }
    if (r.error.code !== "idempotency_conflict") idemKey.current = newIdempotencyKey();
    setError(r.error);
    setStep("review");
  };

  const set = (k: keyof typeof addr) => (e: { target: { value: string } }) => {
    setAddr({ ...addr, [k]: e.target.value });
    if (step !== "details") setStep("details");
  };
  const fe = (k: string) => fields[`shippingAddress.${k}`];

  return (
    <>
    <Stepper current={step === "details" ? 1 : 2} />
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <form
        noValidate
        className="card space-y-6 p-6 sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          getQuote();
        }}
      >
        <fieldset className="space-y-4">
          <legend className="mb-2 font-display text-2xl">Contact</legend>
          <Field id="co-email" label="Email for order updates" error={fields.email}>
            <input id="co-email" type="email" className="input" value={email} onChange={(e) => { setEmail(e.target.value); setStep("details"); }} autoComplete="email" aria-invalid={!!fields.email} />
          </Field>
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 font-display text-2xl sm:col-span-2">Delivery address</legend>
          <Field id="co-name" label="Full name" error={fe("name")}><input id="co-name" className="input" value={addr.name} onChange={set("name")} autoComplete="name" aria-invalid={!!fe("name")} /></Field>
          <Field id="co-phone" label="Mobile number" error={fe("phone")} hint="10-digit Indian mobile"><input id="co-phone" type="tel" inputMode="tel" className="input" value={addr.phone} onChange={set("phone")} autoComplete="tel" aria-invalid={!!fe("phone")} /></Field>
          <div className="sm:col-span-2"><Field id="co-l1" label="Address line 1" error={fe("line1")}><input id="co-l1" className="input" value={addr.line1} onChange={set("line1")} autoComplete="address-line1" aria-invalid={!!fe("line1")} /></Field></div>
          <div className="sm:col-span-2"><Field id="co-l2" label="Address line 2 (optional)" error={fe("line2")}><input id="co-l2" className="input" value={addr.line2} onChange={set("line2")} autoComplete="address-line2" /></Field></div>
          <Field id="co-city" label="City" error={fe("city")}><input id="co-city" className="input" value={addr.city} onChange={set("city")} autoComplete="address-level2" aria-invalid={!!fe("city")} /></Field>
          <Field id="co-state" label="State" error={fe("state")}>
            <select id="co-state" className="input" value={addr.state} onChange={set("state")} autoComplete="address-level1" aria-invalid={!!fe("state")}>
              <option value="">Select state</option>
              {STATES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field id="co-pin" label="PIN code" error={fe("postalCode")}><input id="co-pin" inputMode="numeric" maxLength={6} className="input" value={addr.postalCode} onChange={set("postalCode")} autoComplete="postal-code" aria-invalid={!!fe("postalCode")} /></Field>
        </fieldset>
        {error && !error.fields && <Banner tone="error">{error.message}</Banner>}
        {step === "details" && <button className="btn btn-primary w-full sm:w-auto">Continue to review</button>}
      </form>

      <aside className="glass h-fit rounded-[18px] p-6 lg:sticky lg:top-28" aria-label="Order review">
        <h2 className="mb-4 font-display text-2xl">Review</h2>
        {!quote || step === "details" ? (
          <p className="text-muted">Enter your details to see delivery charges and the final total.</p>
        ) : (
          <>
            {changed && <div className="mb-4"><Banner tone="warning">Prices, delivery or availability changed since you started. Please check the updated total.</Banner></div>}
            <ul className="mb-4 space-y-2 text-sm">
              {quote.lines.map((l) => (
                <li key={l.variantId} className="flex justify-between gap-3"><span>{l.productName} × {l.quantity}</span><span className="tabular">{formatPaise(l.lineSubtotalPaise)}</span></li>
              ))}
            </ul>
            <dl className="space-y-2 border-t border-divider pt-4">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular">{formatPaise(quote.subtotalPaise)}</dd></div>
              <div className="flex justify-between"><dt>Delivery</dt><dd className="tabular">{quote.shippingPaise ? formatPaise(quote.shippingPaise) : "Free"}</dd></div>
              <div className="flex justify-between text-lg font-medium"><dt>Total</dt><dd className="tabular">{formatPaise(quote.totalPaise)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-muted">{quote.tax.note}</p>
            {quote.shipping?.isDevelopment && <p className="mt-2 text-xs text-warning">{quote.shipping.label}</p>}
            {quote.problems.length > 0 && <div className="mt-4"><Banner tone="error">{quote.problems.map((p) => p.message).join(" ")}</Banner></div>}
            <fieldset className="mt-6 space-y-2">
              <legend className="mb-2 font-medium">Payment</legend>
              {methods.map((m) => (
                <label key={m.key} className={`flex gap-3 rounded-xl p-3 ring-1 ${method === m.key ? "ring-primary" : "ring-divider"} ${m.available ? "" : "opacity-60"}`}>
                  <input type="radio" name="pm" className="mt-1" disabled={!m.available} checked={method === m.key} onChange={() => setMethod(m.key)} />
                  <span>
                    <span className="block">{m.label}</span>
                    {!m.available && <span className="block text-xs text-muted">{m.unavailableReason}</span>}
                    {m.notice && <span className="block text-xs text-warning">{m.notice}</span>}
                  </span>
                </label>
              ))}
            </fieldset>
            {!methods.some((m) => m.available) && <p className="mt-3 text-sm text-error">No payment method is available yet, so orders cannot be placed.</p>}
            <button className="btn btn-primary mt-6 w-full" disabled={!method || step === "placing" || quote.problems.length > 0} onClick={place}>
              {step === "placing" ? "Placing order…" : `Place order · ${formatPaise(quote.totalPaise)}`}
            </button>
          </>
        )}
      </aside>
    </div>
    </>
  );
}
