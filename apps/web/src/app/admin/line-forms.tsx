"use client";
import { useState, type ReactNode } from "react";
import { Banner, Field } from "@/components/forms";
import { useAdminPost } from "./admin-actions";

export type PickLine = { id: string; name: string; max: number };

/**
 * Pick quantities per order line (0…max) and post them with any extra fields.
 * Used for shipments, line cancellations and staff-created returns. The server re-checks every quantity.
 */
export function LineQuantityForm({
  title,
  lines,
  path,
  body,
  submitLabel,
  success,
  tone = "primary",
  reasonField,
  reasonLabel = "Reason (recorded in the audit log)",
  defaultFull = true,
  extraFields,
}: {
  title: string;
  lines: PickLine[];
  path: string;
  body: Record<string, unknown>;
  submitLabel: string;
  success: string;
  tone?: "primary" | "danger";
  reasonField?: "reason" | "note";
  reasonLabel?: string;
  defaultFull?: boolean;
  extraFields?: (set: (k: string, v: string) => void, values: Record<string, string>, fields: Record<string, string[]>) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const { post, error, busy, done, fields } = useAdminPost();
  const available = lines.filter((l) => l.max > 0);
  // Maxima change after each refresh; clamp what was typed (or defaulted) to what is allowed now.
  const valueOf = (l: PickLine) => Math.min(l.max, qty[l.id] ?? (defaultFull ? l.max : 0));
  const chosen = available.filter((l) => valueOf(l) > 0).map((l) => ({ orderLineId: l.id, quantity: valueOf(l) }));
  if (!available.length) return null;
  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  if (!open)
    return (
      <div>
        {done && <Banner tone="success">{done}</Banner>}
        <button className={`btn btn-${tone === "danger" ? "secondary" : "primary"} mt-2`} onClick={() => setOpen(true)}>
          {title}
        </button>
      </div>
    );
  return (
    <form
      className="card space-y-3 p-4 ring-1 ring-divider"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await post(path, { ...body, ...values, lines: chosen }, success);
        if (ok) setOpen(false);
      }}
    >
      <h3 className="font-medium">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted"><th className="py-1 font-normal">Item</th><th className="py-1 text-right font-normal">Available</th><th className="py-1 text-right font-normal">Quantity</th></tr>
        </thead>
        <tbody>
          {available.map((l) => (
            <tr key={l.id} className="border-t border-divider">
              <td className="py-2">{l.name}</td>
              <td className="tabular py-2 text-right">{l.max}</td>
              <td className="py-2 text-right">
                <label className="sr-only" htmlFor={`q-${title}-${l.id}`}>Quantity for {l.name}</label>
                <input
                  id={`q-${title}-${l.id}`}
                  type="number"
                  min={0}
                  max={l.max}
                  className="input w-20 text-right"
                  value={valueOf(l)}
                  onChange={(e) => setQty((s) => ({ ...s, [l.id]: Math.max(0, Math.min(l.max, Number(e.target.value) || 0)) }))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {extraFields?.(set, values, fields)}
      {reasonField && (
        <Field id={`r-${title}`} label={reasonLabel} error={fields[reasonField]}>
          <input id={`r-${title}`} className="input" value={values[reasonField] ?? ""} onChange={(e) => set(reasonField, e.target.value)} required minLength={3} />
        </Field>
      )}
      {error && <Banner tone="error">{error.message}</Banner>}
      <div className="flex gap-2">
        <button className={`btn btn-${tone}`} disabled={busy || !chosen.length}>{busy ? "Saving…" : submitLabel}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

/** Dispatch a packing shipment with carrier and optional tracking reference. */
export function DispatchForm({ fulfilmentId }: { fulfilmentId: string }) {
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [trackingRef, setTrackingRef] = useState("");
  const { post, error, busy, fields } = useAdminPost();
  if (!open) return <button className="btn btn-primary" onClick={() => setOpen(true)}>Dispatch</button>;
  return (
    <form
      className="card w-full space-y-3 p-4 ring-1 ring-divider"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await post(`/v1/admin/shipments/${fulfilmentId}/dispatch`, { carrier, trackingRef }, "Shipment dispatched")) setOpen(false);
      }}
    >
      <Field id={`carrier-${fulfilmentId}`} label="Carrier" error={fields.carrier}>
        <input id={`carrier-${fulfilmentId}`} className="input" value={carrier} onChange={(e) => setCarrier(e.target.value)} required minLength={2} />
      </Field>
      <Field id={`trk-${fulfilmentId}`} label="Tracking reference (optional)" error={fields.trackingRef} hint="Shown to the customer on their order page.">
        <input id={`trk-${fulfilmentId}`} className="input" value={trackingRef} onChange={(e) => setTrackingRef(e.target.value)} />
      </Field>
      {error && !fields.carrier && <Banner tone="error">{error.message}</Banner>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Confirm dispatch"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

/** Request a refund in rupees (converted to paise); approval happens separately by a second person. */
export function RefundRequestForm({ orderId, refundablePaise, returns }: { orderId: string; refundablePaise: number; returns: Array<{ id: string; reference: string }> }) {
  const [open, setOpen] = useState(false);
  const [rupees, setRupees] = useState("");
  const [reason, setReason] = useState("");
  const [returnRequestId, setReturn] = useState("");
  const { post, error, busy, done, fields } = useAdminPost();
  const paise = Math.round(Number(rupees) * 100);
  if (refundablePaise <= 0) return null;
  if (!open)
    return (
      <div>
        {done && <Banner tone="success">{done}</Banner>}
        <button className="btn btn-secondary mt-2" onClick={() => setOpen(true)}>Request refund</button>
      </div>
    );
  return (
    <form
      className="card space-y-3 p-4 ring-1 ring-divider"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await post(`/v1/admin/orders/${orderId}/refunds`, { amountPaise: paise, reason, ...(returnRequestId ? { returnRequestId } : {}) }, "Refund requested. A second team member must approve it.");
        if (ok) setOpen(false);
      }}
    >
      <Field id="refund-amount" label={`Amount in ₹ (at most ${(refundablePaise / 100).toFixed(2)})`} error={fields.amountPaise}>
        <input id="refund-amount" className="input" inputMode="decimal" value={rupees} onChange={(e) => setRupees(e.target.value)} required pattern="\d+(\.\d{1,2})?" />
      </Field>
      {returns.length > 0 && (
        <Field id="refund-return" label="For return (optional)">
          <select id="refund-return" className="input" value={returnRequestId} onChange={(e) => setReturn(e.target.value)}>
            <option value="">Not linked to a return</option>
            {returns.map((r) => <option key={r.id} value={r.id}>{r.reference}</option>)}
          </select>
        </Field>
      )}
      <Field id="refund-reason" label="Reason (recorded in the audit log)" error={fields.reason}>
        <input id="refund-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} />
      </Field>
      {error && !fields.reason && !fields.amountPaise && <Banner tone="error">{error.message}</Banner>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy || !(paise > 0)}>{busy ? "Saving…" : "Request refund"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
