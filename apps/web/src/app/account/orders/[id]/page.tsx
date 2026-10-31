import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderTimeline, type TrackedOrder } from "@/components/order-timeline";
import { apiOrNull } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";
import { ReturnRequestForm } from "./return-form";

const RETURN_STATUS: Record<string, string> = {
  submitted: "Waiting for review",
  approved: "Approved — please send the items back",
  rejected: "Not approved",
  received: "Received — being inspected",
  inspected: "Inspection complete",
};

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await apiOrNull<TrackedOrder>(`/v1/account/orders/${encodeURIComponent(id)}`);
  if (!o) notFound();
  const returnable = o.lines.filter((l) => l.returnable > 0).map((l) => ({ id: l.id, name: l.name, max: l.returnable }));
  const name = (lineId: string) => o.lines.find((l) => l.id === lineId)?.name ?? "Item";
  return (
    <div className="space-y-6">
      <Link href="/account/orders" className="text-sm text-teal">← Orders</Link>
      <h1 className="tabular font-display text-4xl">{o.reference}</h1>
      {o.isDevelopmentOrder && <p className="rounded-xl bg-warning-bg px-4 py-3 text-sm text-warning">Development order — no payment was taken.</p>}
      <OrderTimeline order={o} />

      {o.returns.length > 0 && (
        <section className="card p-6" aria-labelledby="returns-h">
          <h2 id="returns-h" className="mb-4 font-display text-xl">Returns</h2>
          <ul className="space-y-3">
            {o.returns.map((r) => (
              <li key={r.id} className="text-sm">
                <p><span className="tabular font-medium">{r.reference}</span> · {RETURN_STATUS[r.status] ?? titleCase(r.status)} · {formatDateTime(r.createdAt)}</p>
                <p className="text-muted">{r.lines.map((l) => `${l.quantity} × ${name(l.orderLineId)}`).join(", ")}</p>
                {r.status === "rejected" && r.decisionNote && <p>Reason: {r.decisionNote}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {returnable.length > 0 && o.returnPolicy ? (
        <div className="space-y-2">
          {o.returnPolicy.isDevelopment && <p className="text-xs text-muted">Return window shown is a development setting, not Oryvia&apos;s published policy.</p>}
          <ReturnRequestForm orderId={o.id} lines={returnable} windowDays={o.returnPolicy.windowDays} />
        </div>
      ) : (
        <p className="text-sm text-muted">
          {returnable.length > 0
            ? "Online returns are not open yet."
            : "Items can be returned once they are delivered."}{" "}
          Need help with this order? <Link href="/contact" className="underline">Contact us</Link> with your order reference.
        </p>
      )}
    </div>
  );
}
