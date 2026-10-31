"use client";
import { useState } from "react";
import { Banner, Field } from "@/components/forms";
import { useAdminPost } from "../admin-actions";

export function ReceiptForm({ variants, warehouses }: { variants: Array<{ id: string; label: string }>; warehouses: Array<{ code: string; name: string }> }) {
  const { post, error, busy, done, fields } = useAdminPost();
  const [f, setF] = useState({ variantId: variants[0]?.id ?? "", warehouseCode: warehouses[0]?.code ?? "", quantity: "", lot: "", manufacturedAt: "", expiresAt: "", note: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  if (!warehouses.length) return <p className="text-muted">No active warehouse exists. A warehouse must be configured before stock can be received.</p>;
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await post(
          "/v1/admin/inventory/receipts",
          { ...f, quantity: Number(f.quantity), manufacturedAt: f.manufacturedAt || undefined, expiresAt: f.expiresAt || undefined, note: f.note || undefined },
          `Received ${f.quantity} unit(s), lot ${f.lot}.`,
        );
        if (ok) setF({ ...f, quantity: "", lot: "", note: "" });
      }}
    >
      <Field id="rc-v" label="Product" error={fields.variantId}><select id="rc-v" className="input" value={f.variantId} onChange={set("variantId")}>{variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select></Field>
      <Field id="rc-w" label="Warehouse" error={fields.warehouseCode}><select id="rc-w" className="input" value={f.warehouseCode} onChange={set("warehouseCode")}>{warehouses.map((w) => <option key={w.code} value={w.code}>{w.name}</option>)}</select></Field>
      <Field id="rc-q" label="Quantity received" error={fields.quantity}><input id="rc-q" inputMode="numeric" className="input" value={f.quantity} onChange={set("quantity")} /></Field>
      <Field id="rc-l" label="Batch / lot number" error={fields.lot}><input id="rc-l" className="input" value={f.lot} onChange={set("lot")} /></Field>
      <Field id="rc-m" label="Manufactured (optional)" error={fields.manufacturedAt}><input id="rc-m" type="date" className="input" value={f.manufacturedAt} onChange={set("manufacturedAt")} /></Field>
      <Field id="rc-e" label="Expires (optional)" error={fields.expiresAt}><input id="rc-e" type="date" className="input" value={f.expiresAt} onChange={set("expiresAt")} /></Field>
      <div className="sm:col-span-2"><Field id="rc-n" label="Note (optional)" error={fields.note}><input id="rc-n" className="input" value={f.note} onChange={set("note")} /></Field></div>
      {error && !error.fields && <div className="sm:col-span-2"><Banner tone="error">{error.message}</Banner></div>}
      {done && <div className="sm:col-span-2"><Banner tone="success">{done}</Banner></div>}
      <div className="sm:col-span-2"><button className="btn btn-primary" disabled={busy}>Record receipt</button></div>
    </form>
  );
}
