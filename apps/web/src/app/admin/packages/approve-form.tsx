"use client";
import { useState } from "react";
import { Banner, Field } from "@/components/forms";
import { useAdminPost } from "../admin-actions";

type Comp = { variantId: string; name: string; observedQty: number | null };

/** Approval requires an explicit paid/complimentary split per component and a price; nothing is pre-filled from conflicting evidence. */
export function ApproveForm({ versionId, components }: { versionId: string; components: Comp[] }) {
  const { post, error, busy, done, fields } = useAdminPost();
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [qty, setQty] = useState<Record<string, { paid: string; free: string }>>(Object.fromEntries(components.map((c) => [c.variantId, { paid: "", free: "" }])));
  if (done) return <Banner tone="success">{done}</Banner>;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const rupees = Number(price);
        post(
          "/v1/admin/packages/approve",
          {
            packageVersionId: versionId,
            pricePaise: Number.isFinite(rupees) ? Math.round(rupees * 100) : 0,
            components: components.map((c) => ({ variantId: c.variantId, paidQty: Number(qty[c.variantId].paid || 0), freeQty: Number(qty[c.variantId].free || 0) })),
            reason,
          },
          "Package version approved and published.",
        );
      }}
    >
      <table className="w-full text-sm">
        <thead className="text-muted"><tr><th scope="col" className="py-1 text-left font-normal">Component</th><th scope="col" className="py-1 font-normal">Observed</th><th scope="col" className="py-1 font-normal">Paid</th><th scope="col" className="py-1 font-normal">Complimentary</th></tr></thead>
        <tbody>
          {components.map((c) => (
            <tr key={c.variantId}>
              <td className="py-1 pr-2">{c.name}</td>
              <td className="tabular py-1 text-center text-muted">{c.observedQty ?? "-"}</td>
              {(["paid", "free"] as const).map((k) => (
                <td key={k} className="py-1">
                  <label className="sr-only" htmlFor={`${versionId}-${c.variantId}-${k}`}>{k} quantity for {c.name}</label>
                  <input id={`${versionId}-${c.variantId}-${k}`} inputMode="numeric" className="input w-20" value={qty[c.variantId][k]} onChange={(e) => setQty({ ...qty, [c.variantId]: { ...qty[c.variantId], [k]: e.target.value.replace(/\D/g, "") } })} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Field id={`${versionId}-price`} label="Approved package price (₹, as the merchant confirmed)" error={fields.pricePaise}>
        <input id={`${versionId}-price`} inputMode="decimal" className="input max-w-xs" value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      <Field id={`${versionId}-reason`} label="Approval reason / merchant confirmation reference" error={fields.reason}>
        <input id={`${versionId}-reason`} className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {error && !error.fields && <Banner tone="error">{error.message}</Banner>}
      <button className="btn btn-primary" disabled={busy}>Approve this version</button>
    </form>
  );
}
