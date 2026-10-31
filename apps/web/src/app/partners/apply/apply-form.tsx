"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banner, Field } from "@/components/forms";
import { call, type ClientError } from "@/lib/client";

type Data = Record<string, string | boolean>;

export function ApplyForm({ programmes, existing }: { programmes: Array<{ key: string; name: string; businessType: string }>; existing: { data: Data; state: string } | null }) {
  const router = useRouter();
  const [f, setF] = useState<Data>({
    programmeKey: programmes[0]?.key ?? "",
    businessType: programmes[0]?.businessType ?? "salon",
    businessName: "",
    legalName: "",
    gstin: "",
    contactName: "",
    phone: "",
    city: "",
    state: "",
    postalCode: "",
    serviceRegion: "",
    notes: "",
    acceptTerms: false,
    ...(existing?.data ?? {}),
  });
  const [error, setError] = useState<ClientError | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fields = error?.fields ?? {};
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const save = async (submit: boolean) => {
    setBusy(true);
    setError(null);
    setSaved(null);
    const r = await call<{ reference: string; state: string }>(`/v1/partner/applications${submit ? "?submit=1" : ""}`, { method: "POST", body: f });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSaved(submit ? `Application ${r.data.reference} submitted. We will email you when it has been reviewed.` : `Draft ${r.data.reference} saved. You can come back and finish later.`);
    router.refresh();
  };

  const input = (k: string, label: string, opts: { type?: string; hint?: string; auto?: string } = {}) => (
    <Field id={`pa-${k}`} label={label} error={fields[k]} hint={opts.hint}>
      <input id={`pa-${k}`} type={opts.type ?? "text"} className="input" value={String(f[k] ?? "")} onChange={set(k)} autoComplete={opts.auto} aria-invalid={!!fields[k]} />
    </Field>
  );

  return (
    <form noValidate className="space-y-8" onSubmit={(e) => { e.preventDefault(); save(true); }}>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-display text-2xl">Business</legend>
        <Field id="pa-programme" label="Programme" error={fields.programmeKey}>
          <select id="pa-programme" className="input" value={String(f.programmeKey)} onChange={(e) => { const p = programmes.find((x) => x.key === e.target.value); setF({ ...f, programmeKey: e.target.value, businessType: p?.businessType ?? f.businessType }); }}>
            {programmes.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
          </select>
        </Field>
        {input("businessName", "Business name", { auto: "organization" })}
        {input("legalName", "Registered legal name (optional)")}
        {input("gstin", "GSTIN (optional)", { hint: "Only if your business is GST-registered. Format is checked; it is not verified with the GST portal." })}
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-display text-2xl">Contact &amp; location</legend>
        {input("contactName", "Contact person", { auto: "name" })}
        {input("phone", "Mobile number", { type: "tel", auto: "tel" })}
        {input("city", "City", { auto: "address-level2" })}
        {input("state", "State", { auto: "address-level1" })}
        {input("postalCode", "PIN code", { auto: "postal-code" })}
        {input("serviceRegion", "Area you serve (optional)")}
        <div className="sm:col-span-2">
          <Field id="pa-notes" label="Anything else we should know? (optional)" error={fields.notes}>
            <textarea id="pa-notes" rows={3} className="input py-3" value={String(f.notes ?? "")} onChange={set("notes")} />
          </Field>
        </div>
      </fieldset>
      <p className="text-sm text-muted">No identity documents are needed at this stage. If Oryvia needs a document, we will request it during review.</p>
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-1 size-4" checked={!!f.acceptTerms} onChange={(e) => setF({ ...f, acceptTerms: e.target.checked })} />
        <span>I confirm the details are correct and agree that Oryvia may review this application and contact me about it.</span>
      </label>
      {fields.acceptTerms && <p className="field-error">{fields.acceptTerms[0]}</p>}
      {error && !error.fields && <Banner tone="error">{error.message}</Banner>}
      {saved && <Banner tone="success">{saved}</Banner>}
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" disabled={busy}>Submit application</button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => save(false)}>Save draft</button>
      </div>
    </form>
  );
}
