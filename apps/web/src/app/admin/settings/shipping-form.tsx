"use client";
import { useState } from "react";
import { Banner, Field } from "@/components/forms";
import { useAdminPost } from "../admin-actions";

type Rule = { label: string; flatPaise: number; freeAboveSubtotalPaise: number | null; serviceablePinPrefixes: string[]; isDevelopment: boolean };

export function ShippingForm({ rule, version }: { rule: Rule | null; version: number }) {
  const { post, error, busy, done, fields } = useAdminPost();
  const [f, setF] = useState({
    label: rule?.label ?? "",
    flat: rule ? String(rule.flatPaise / 100) : "",
    freeAbove: rule?.freeAboveSubtotalPaise != null ? String(rule.freeAboveSubtotalPaise / 100) : "",
    pins: rule?.serviceablePinPrefixes.join(", ") ?? "",
    isDevelopment: rule?.isDevelopment ?? false,
  });
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        post(
          "/v1/admin/settings/shipping",
          {
            label: f.label,
            flatPaise: Math.round(Number(f.flat || 0) * 100),
            freeAboveSubtotalPaise: f.freeAbove ? Math.round(Number(f.freeAbove) * 100) : null,
            serviceablePinPrefixes: f.pins.split(/[,\s]+/).filter(Boolean),
            isDevelopment: f.isDevelopment,
            version,
          },
          "Delivery rule saved. It applies to new checkout quotes immediately.",
        );
      }}
    >
      <div className="sm:col-span-2"><Field id="sh-label" label="Label shown at checkout" error={fields.label}><input id="sh-label" className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field></div>
      <Field id="sh-flat" label="Flat delivery charge (₹)" error={fields.flatPaise}><input id="sh-flat" inputMode="decimal" className="input" value={f.flat} onChange={(e) => setF({ ...f, flat: e.target.value })} /></Field>
      <Field id="sh-free" label="Free delivery above subtotal (₹, optional)" error={fields.freeAboveSubtotalPaise}><input id="sh-free" inputMode="decimal" className="input" value={f.freeAbove} onChange={(e) => setF({ ...f, freeAbove: e.target.value })} /></Field>
      <div className="sm:col-span-2"><Field id="sh-pins" label="Serviceable PIN prefixes (blank = all India)" hint="e.g. 2449, 110" error={fields.serviceablePinPrefixes}><input id="sh-pins" className="input" value={f.pins} onChange={(e) => setF({ ...f, pins: e.target.value })} /></Field></div>
      <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" className="size-4" checked={f.isDevelopment} onChange={(e) => setF({ ...f, isDevelopment: e.target.checked })} />This is a development rule (shown as not merchant-approved)</label>
      {error && !error.fields && <div className="sm:col-span-2"><Banner tone="error">{error.message}</Banner></div>}
      {done && <div className="sm:col-span-2"><Banner tone="success">{done}</Banner></div>}
      <div><button className="btn btn-primary" disabled={busy}>Save delivery rule</button></div>
    </form>
  );
}
