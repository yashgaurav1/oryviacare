import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPaise } from "@oryvia/contracts";
import { apiOrNull, type Me } from "@/lib/api";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import { ReasonAction } from "../../admin-actions";
import { DispatchForm, LineQuantityForm, RefundRequestForm } from "../../line-forms";

type O = {
  id: string;
  publicReference: string;
  email: string;
  phone: string;
  state: string;
  paymentState: string;
  fulfilmentState: string;
  isDevelopmentOrder: boolean;
  version: number;
  subtotalPaise: number;
  shippingPaise: number;
  totalPaise: number;
  paymentMethod: string;
  shippingAddress: Record<string, string>;
  lines: Array<{ id: string; identitySnapshot: { name: string }; quantity: number; unitPaise: number; lineTotalPaise: number }>;
  events: Array<{ id: string; kind: string; fromState: string | null; toState: string | null; note: string | null; createdAt: string; actorId: string | null }>;
  payments: Array<{ id: string; provider: string; state: string; amountPaise: number; externalId: string | null }>;
  reservations: Array<{ id: string; quantity: number; status: string; expiresAt: string }>;
};

type Ops = {
  lines: Array<{ orderLineId: string; variantId: string | null; ordered: number; cancelled: number; onShipments: number; shipped: number; delivered: number; open: number; returnable: number }>;
  fulfilments: Array<{
    id: string;
    status: string;
    carrier: string | null;
    trackingRef: string | null;
    createdAt: string;
    shippedAt: string | null;
    deliveredAt: string | null;
    warehouse: { code: string };
    lines: Array<{ id: string; orderLineId: string; quantity: number; batch: { lot: string; expiresAt: string | null } | null }>;
  }>;
  returns: Array<{ id: string; reference: string; status: string; reason: string; createdAt: string; lines: Array<{ id: string; orderLineId: string; quantity: number; disposition: string }> }>;
  refunds: {
    basis: { provider: string; amountPaise: number; development: boolean } | null;
    refundablePaise: number;
    refunds: Array<{ id: string; amountPaise: number; state: string; reason: string; requestedBy: string; approvedBy: string | null; createdAt: string }>;
  };
};

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await apiOrNull<O>(`/v1/admin/orders/${encodeURIComponent(id)}`);
  if (!o) notFound();
  const [ops, me] = await Promise.all([apiOrNull<Ops>(`/v1/admin/orders/${encodeURIComponent(id)}/operations`), apiOrNull<Me>("/v1/account/me")]);
  const can = new Set(me?.permissions ?? []);
  const name = (lineId: string) => o.lines.find((l) => l.id === lineId)?.identitySnapshot.name ?? "Item";
  const pick = (key: "open" | "returnable") => (ops?.lines ?? []).filter((l) => l.variantId).map((l) => ({ id: l.orderLineId, name: name(l.orderLineId), max: l[key] }));
  const path = `/v1/admin/orders/${o.id}/transition`;
  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="text-sm text-teal">← Orders</Link>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="tabular font-display text-4xl">{o.publicReference}</h1>
        {o.isDevelopmentOrder && <span className="rounded bg-warning-bg px-2 py-1 text-sm text-warning">Development order · no money moved</span>}
      </header>
      <dl className="grid gap-4 sm:grid-cols-4">
        {[["Order", o.state], ["Payment", o.paymentState], ["Fulfilment", o.fulfilmentState], ["Method", o.paymentMethod]].map(([k, v]) => (
          <div key={k} className="glass rounded-[18px] p-4"><dt className="text-sm text-muted">{k}</dt><dd className="font-medium">{titleCase(v)}</dd></div>
        ))}
      </dl>
      <section className="flex flex-wrap gap-3">
        {o.state === "placed" && (
          <ReasonAction label="Confirm order" path={path} body={{ to: "confirmed", version: o.version }} confirm={o.isDevelopmentOrder ? "This commits reserved stock. The order remains unpaid (development)." : "Only allowed when the provider has verified payment. Commits reserved stock."} />
        )}
        {(o.state === "placed" || o.state === "confirmed") && (
          <ReasonAction
            label="Cancel order"
            tone="danger"
            path={path}
            body={{ to: "cancelled", version: o.version }}
            confirm={o.state === "confirmed" ? "Returns every unshipped unit to stock and voids packing shipments. Refused if anything has been dispatched. If payment was captured, the order is flagged for refund." : "Releases reserved stock. If payment was captured, the order is flagged for refund."}
          />
        )}
        {o.state === "confirmed" && <ReasonAction label="Close order" tone="secondary" path={path} body={{ to: "closed", version: o.version }} confirm="Allowed once every live unit is delivered or cancelled." />}
      </section>

      {ops && (
        <section className="card space-y-5 p-6" aria-labelledby="fulfil-h">
          <h2 id="fulfil-h" className="font-display text-xl">Fulfilment</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-muted">
                  {["Item", "Ordered", "Cancelled", "On shipments", "Shipped", "Delivered", "Open"].map((h, i) => <th key={h} className={`py-1 font-normal ${i ? "text-right" : ""}`}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {ops.lines.filter((l) => l.variantId).map((l) => (
                  <tr key={l.orderLineId} className="border-t border-divider">
                    <td className="py-2">{name(l.orderLineId)}</td>
                    {[l.ordered, l.cancelled, l.onShipments, l.shipped, l.delivered, l.open].map((n, i) => <td key={i} className="tabular py-2 text-right">{n}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {o.state === "confirmed" && (
            <div className="flex flex-wrap items-start gap-3">
              {can.has("orders.fulfil") && (
                <LineQuantityForm title="Create shipment" lines={pick("open")} path={`/v1/admin/orders/${o.id}/shipments`} body={{ version: o.version }} submitLabel="Create shipment (packing)" success="Shipment created. Batches were assigned earliest-expiry first." />
              )}
              {can.has("orders.transition") && (
                <LineQuantityForm title="Cancel unshipped units" tone="danger" defaultFull={false} lines={pick("open")} path={`/v1/admin/orders/${o.id}/cancel-lines`} body={{ version: o.version }} reasonField="reason" submitLabel="Cancel these units" success="Units cancelled and returned to stock." />
              )}
            </div>
          )}
          {o.state === "placed" && <p className="text-sm text-muted">Shipments can be created once the order is confirmed.</p>}

          <h3 className="font-medium">Shipments</h3>
          {ops.fulfilments.length === 0 ? (
            <p className="text-sm text-muted">No shipments yet.</p>
          ) : (
            <ul className="space-y-3">
              {ops.fulfilments.map((f) => (
                <li key={f.id} className="rounded-xl border border-divider p-4">
                  <p className="text-sm">
                    <span className="font-medium">{titleCase(f.status)}</span> · from {f.warehouse.code} · created {formatDateTime(f.createdAt)}
                    {f.carrier && <> · {f.carrier}{f.trackingRef ? ` (${f.trackingRef})` : ""}</>}
                    {f.shippedAt && <> · dispatched {formatDateTime(f.shippedAt)}</>}
                    {f.deliveredAt && <> · delivered {formatDateTime(f.deliveredAt)}</>}
                  </p>
                  <ul className="mt-1 text-sm text-muted">
                    {f.lines.map((fl) => <li key={fl.id}>{fl.quantity} × {name(fl.orderLineId)}{fl.batch ? ` · lot ${fl.batch.lot}${fl.batch.expiresAt ? `, expires ${formatDate(fl.batch.expiresAt)}` : ""}` : " · unbatched stock"}</li>)}
                  </ul>
                  {can.has("orders.fulfil") && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {f.status === "packing" && <DispatchForm fulfilmentId={f.id} />}
                      {f.status === "packing" && <ReasonAction label="Void shipment" tone="secondary" path={`/v1/admin/shipments/${f.id}/cancel`} body={{}} confirm="The units go back to open and can be shipped again." />}
                      {f.status === "shipped" && <ReasonAction label="Mark delivered" path={`/v1/admin/shipments/${f.id}/deliver`} body={{}} reasonLabel="How was delivery confirmed?" />}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {ops && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card space-y-4 p-6" aria-labelledby="returns-h">
            <h2 id="returns-h" className="font-display text-xl">Returns</h2>
            {ops.returns.length === 0 ? (
              <p className="text-sm text-muted">No returns.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {ops.returns.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/returns/${r.id}`} className="font-medium text-teal underline">{r.reference}</Link> · {titleCase(r.status)} · {r.lines.reduce((n, l) => n + l.quantity, 0)} unit(s) · {r.reason}
                  </li>
                ))}
              </ul>
            )}
            {can.has("returns.manage") && (
              <LineQuantityForm title="Open a return for the customer" defaultFull={false} lines={pick("returnable")} path={`/v1/admin/orders/${o.id}/returns`} body={{}} reasonField="reason" reasonLabel="Customer's reason" submitLabel="Open return" success="Return opened. Approve it from the return page." />
            )}
            {pick("returnable").every((l) => l.max === 0) && <p className="text-sm text-muted">Only delivered units can be returned.</p>}
          </section>

          <section className="card space-y-4 p-6" aria-labelledby="refunds-h">
            <h2 id="refunds-h" className="font-display text-xl">Refunds</h2>
            {ops.refunds.basis ? (
              <p className="text-sm">
                Basis: {ops.refunds.basis.development ? "development payment (no money exists to refund)" : `${ops.refunds.basis.provider} payment`} of {formatPaise(ops.refunds.basis.amountPaise)}. Still refundable: <span className="tabular font-medium">{formatPaise(ops.refunds.refundablePaise)}</span>
              </p>
            ) : (
              <p className="text-sm text-muted">No captured payment on this order, so nothing can be refunded.</p>
            )}
            {ops.refunds.refunds.length > 0 && (
              <ul className="space-y-3 text-sm">
                {ops.refunds.refunds.map((r) => (
                  <li key={r.id} className="rounded-xl border border-divider p-3">
                    <p><span className="tabular font-medium">{formatPaise(r.amountPaise)}</span> · {titleCase(r.state)} · {formatDateTime(r.createdAt)}</p>
                    <p className="text-muted">{r.reason}</p>
                    {r.state === "requested" && can.has("finance.refunds") && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {r.requestedBy === me?.userId ? (
                          <p className="text-xs text-muted">You requested this refund, so someone else must approve it.</p>
                        ) : (
                          <ReasonAction label="Approve refund" path={`/v1/admin/refunds/${r.id}/decide`} body={{ decision: "approved" }} reasonField="note" confirm={ops.refunds.basis?.development ? "Development order: this records the refund; no money moves." : "This sends the refund to the payment provider."} />
                        )}
                        <ReasonAction label="Reject refund" tone="secondary" path={`/v1/admin/refunds/${r.id}/decide`} body={{ decision: "rejected" }} reasonField="note" />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {can.has("finance.refunds") && (
              <RefundRequestForm orderId={o.id} refundablePaise={ops.refunds.refundablePaise} returns={ops.returns.filter((r) => !["submitted", "rejected"].includes(r.status)).map((r) => ({ id: r.id, reference: r.reference }))} />
            )}
          </section>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-4 font-display text-xl">Lines</h2>
          <table className="w-full text-sm">
            <tbody>
              {o.lines.map((l) => (
                <tr key={l.id} className="border-b border-divider"><td className="py-2">{l.identitySnapshot.name}</td><td className="tabular py-2 text-right">{l.quantity} × {formatPaise(l.unitPaise)}</td><td className="tabular py-2 text-right">{formatPaise(l.lineTotalPaise)}</td></tr>
              ))}
              <tr><td className="pt-3">Delivery</td><td /><td className="tabular pt-3 text-right">{formatPaise(o.shippingPaise)}</td></tr>
              <tr className="font-medium"><td className="pt-1">Total</td><td /><td className="tabular pt-1 text-right">{formatPaise(o.totalPaise)}</td></tr>
            </tbody>
          </table>
          <h3 className="mb-2 mt-6 font-medium">Customer</h3>
          <p className="text-sm">{o.email} · {o.phone}</p>
          <p className="text-sm text-muted">{[o.shippingAddress.name, o.shippingAddress.line1, o.shippingAddress.city, o.shippingAddress.state, o.shippingAddress.postalCode].filter(Boolean).join(", ")}</p>
        </section>
        <section className="card p-6">
          <h2 className="mb-4 font-display text-xl">Timeline</h2>
          <ol className="space-y-3">
            {o.events.map((e) => (
              <li key={e.id} className="text-sm">
                <span className="font-medium">{e.kind === "order_placed" ? "Placed" : e.toState ? `${titleCase(e.kind === "state_changed" ? "" : `${e.kind}: `)}${titleCase(e.fromState ?? "")} → ${titleCase(e.toState)}` : titleCase(e.kind)}</span>{" "}
                <span className="text-muted">· {formatDateTime(e.createdAt)}{e.note ? ` · ${e.note}` : ""}</span>
              </li>
            ))}
          </ol>
          <h3 className="mb-2 mt-6 font-medium">Payment attempts</h3>
          <ul className="text-sm">{o.payments.map((p) => <li key={p.id}>{p.provider} · {titleCase(p.state)} · {formatPaise(p.amountPaise)}{p.externalId ? ` · ${p.externalId}` : ""}</li>)}</ul>
          <h3 className="mb-2 mt-6 font-medium">Stock reservations</h3>
          <ul className="text-sm">{o.reservations.map((r) => <li key={r.id}>{r.quantity} unit(s) · {r.status} · expires {formatDateTime(r.expiresAt)}</li>)}</ul>
        </section>
      </div>
    </div>
  );
}
