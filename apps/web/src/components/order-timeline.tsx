import { formatPaise } from "@oryvia/contracts";
import { formatDateTime, titleCase } from "@/lib/format";

export interface TrackedOrder {
  id: string;
  reference: string;
  state: string;
  paymentState: string;
  fulfilmentState: string;
  isDevelopmentOrder: boolean;
  placedAt: string;
  totals: { subtotalPaise: number; shippingPaise: number; totalPaise: number; taxMode: string };
  lines: Array<{ id: string; name: string; quantity: number; cancelledQty: number; lineTotalPaise: number; returnable: number }>;
  timeline: Array<{ kind: string; toState: string | null; at: string; note: string | null }>;
  shipments: Array<{ id: string; status: string; carrier: string | null; trackingRef: string | null; shippedAt: string | null; deliveredAt: string | null; lines: Array<{ orderLineId: string; quantity: number }> }>;
  returns: Array<{ id: string; reference: string; status: string; reason: string; decisionNote: string | null; createdAt: string; lines: Array<{ orderLineId: string; quantity: number }> }>;
  returnPolicy: { windowDays: number; label: string; isDevelopment: boolean } | null;
  shippingAddress?: { name: string; line1: string; city: string; state: string; postalCode: string } | null;
}

const EVENT_LABEL: Record<string, string> = {
  order_placed: "Order placed",
  shipment_shipped: "A parcel was dispatched",
  shipment_delivered: "A parcel was delivered",
  lines_cancelled: "Some items were cancelled",
  return_requested: "Return requested",
  return_approved: "Return approved — please send the items back",
  return_rejected: "Return not approved",
  return_received: "Returned items received",
  refund_recorded_development: "Refund recorded (development order — no money moved)",
  refund_succeeded: "Refund sent",
};

const SHIPMENT_LABEL: Record<string, string> = { packing: "Being packed", shipped: "On its way", delivered: "Delivered" };

export function OrderTimeline({ order }: { order: TrackedOrder }) {
  const name = (lineId: string) => order.lines.find((l) => l.id === lineId)?.name ?? "Item";
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="card p-6">
        <h2 className="mb-4 font-display text-xl">Status</h2>
        <dl className="mb-6 grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-muted">Order</dt><dd className="font-medium">{titleCase(order.state)}</dd></div>
          <div><dt className="text-muted">Payment</dt><dd className="font-medium">{titleCase(order.paymentState)}</dd></div>
          <div><dt className="text-muted">Delivery</dt><dd className="font-medium">{titleCase(order.fulfilmentState)}</dd></div>
        </dl>
        <ol className="space-y-3 border-l-2 border-gold-soft pl-5">
          {order.timeline.map((e, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[27px] top-1.5 size-3 rounded-full bg-gold" aria-hidden="true" />
              <p className="font-medium">{EVENT_LABEL[e.kind] ?? (e.toState ? `Order ${e.toState}` : titleCase(e.kind))}</p>
              <p className="text-sm text-muted">{formatDateTime(e.at)}{e.note ? ` · ${e.note}` : ""}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="card p-6">
        <h2 className="mb-4 font-display text-xl">Items</h2>
        <ul className="space-y-2">
          {order.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-4">
              <span>
                {l.name} × {l.quantity}
                {l.cancelledQty > 0 && <span className="block text-sm text-muted">{l.cancelledQty} cancelled</span>}
              </span>
              <span className="tabular">{formatPaise(l.lineTotalPaise)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between border-t border-divider pt-4 font-medium"><span>Total</span><span className="tabular">{formatPaise(order.totals.totalPaise)}</span></p>
        {order.shippingAddress && (
          <div className="mt-6 text-sm">
            <p className="text-muted">Delivering to</p>
            <p>{order.shippingAddress.name}, {order.shippingAddress.line1}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</p>
          </div>
        )}
      </section>
      {order.shipments.length > 0 && (
        <section className="card p-6 md:col-span-2" aria-labelledby="parcels-h">
          <h2 id="parcels-h" className="mb-4 font-display text-xl">Parcels</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {order.shipments.map((s, i) => (
              <li key={s.id} className="rounded-xl border border-divider p-4">
                <p className="font-medium">Parcel {i + 1} · {SHIPMENT_LABEL[s.status] ?? titleCase(s.status)}</p>
                {s.carrier && <p className="text-sm">{s.carrier}{s.trackingRef ? <> · tracking <span className="tabular">{s.trackingRef}</span></> : ""}</p>}
                {s.shippedAt && <p className="text-sm text-muted">Dispatched {formatDateTime(s.shippedAt)}</p>}
                {s.deliveredAt && <p className="text-sm text-muted">Delivered {formatDateTime(s.deliveredAt)}</p>}
                <ul className="mt-2 text-sm text-muted">{s.lines.map((l, j) => <li key={j}>{l.quantity} × {name(l.orderLineId)}</li>)}</ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
