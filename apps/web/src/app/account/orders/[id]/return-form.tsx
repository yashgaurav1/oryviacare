"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Banner, Field } from "@/components/forms";
import { call, newIdempotencyKey, type ClientError } from "@/lib/client";

/** Customer return request. One idempotency key per open form, so a double submit creates one return. */
export function ReturnRequestForm({ orderId, lines, windowDays }: { orderId: string; lines: Array<{ id: string; name: string; max: number }>; windowDays: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());
  const chosen = lines.filter((l) => (qty[l.id] ?? 0) > 0).map((l) => ({ orderLineId: l.id, quantity: qty[l.id] }));

  if (done) return <Banner tone="success">{done}</Banner>;
  if (!open)
    return (
      <button className="btn btn-secondary" onClick={() => setOpen(true)}>
        Return items
      </button>
    );
  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await call<{ reference: string }>(`/v1/account/orders/${orderId}/returns`, { method: "POST", body: { lines: chosen, reason }, headers: { "Idempotency-Key": key.current } });
        setBusy(false);
        if (!r.ok) {
          setError(r.error);
          if (r.error.code !== "idempotency_conflict") key.current = newIdempotencyKey();
          return;
        }
        setDone(`Return ${r.data.reference} requested. We will review it and tell you how to send the items back.`);
        router.refresh();
      }}
    >
      <h2 className="font-display text-xl">Return items</h2>
      <p className="text-sm text-muted">Delivered items can be returned within {windowDays} days of delivery. Choose how many of each item you are returning.</p>
      <fieldset className="space-y-3">
        <legend className="sr-only">Items to return</legend>
        {lines.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-4">
            <label htmlFor={`ret-${l.id}`}>{l.name} <span className="text-sm text-muted">(up to {l.max})</span></label>
            <input
              id={`ret-${l.id}`}
              type="number"
              min={0}
              max={l.max}
              className="input w-20 text-right"
              value={qty[l.id] ?? 0}
              onChange={(e) => setQty((s) => ({ ...s, [l.id]: Math.max(0, Math.min(l.max, Number(e.target.value) || 0)) }))}
            />
          </div>
        ))}
      </fieldset>
      <Field id="ret-reason" label="Why are you returning these?" error={error?.fields?.reason}>
        <textarea id="ret-reason" className="input min-h-24" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} />
      </Field>
      {error && !error.fields?.reason && <Banner tone="error">{error.message}</Banner>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy || !chosen.length || reason.trim().length < 3}>{busy ? "Sending…" : "Request return"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
