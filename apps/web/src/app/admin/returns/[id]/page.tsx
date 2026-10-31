import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPaise } from "@oryvia/contracts";
import { apiOrNull, type Me } from "@/lib/api";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import { ReasonAction } from "../../admin-actions";

export const metadata = { title: "Return" };

type R = {
  id: string;
  reference: string;
  status: string;
  reason: string;
  decisionNote: string | null;
  version: number;
  createdAt: string;
  order: { id: string; publicReference: string; email: string; isDevelopmentOrder: boolean };
  lines: Array<{ id: string; name: string; quantity: number; disposition: string; dispositionNote: string | null; batch: { lot: string; status: string; expiresAt: string | null } | null }>;
  refunds: Array<{ id: string; amountPaise: number; state: string }>;
};

const DISPOSITION: Record<string, string> = {
  pending: "Not received yet",
  quarantine: "In quarantine — awaiting inspection",
  restocked: "Restocked to sellable stock",
  disposed: "Disposed (written off)",
};

export default async function AdminReturn({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, me] = await Promise.all([apiOrNull<R>(`/v1/admin/returns/${encodeURIComponent(id)}`), apiOrNull<Me>("/v1/account/me")]);
  if (!r) notFound();
  const can = new Set(me?.permissions ?? []);
  const canStock = can.has("returns.manage") && can.has("inventory.write");
  return (
    <div className="space-y-6">
      <Link href="/admin/returns" className="text-sm text-teal">← Returns</Link>
      <header className="space-y-2">
        <h1 className="tabular font-display text-4xl">{r.reference}</h1>
        <p className="text-sm">
          {titleCase(r.status)} · opened {formatDateTime(r.createdAt)} · order <Link href={`/admin/orders/${r.order.id}`} className="tabular text-teal underline">{r.order.publicReference}</Link>
          {r.order.isDevelopmentOrder && <span className="ml-2 rounded bg-warning-bg px-1.5 py-0.5 text-xs text-warning">Development order</span>}
        </p>
        <p className="text-sm text-muted">Customer&apos;s reason: {r.reason}{r.decisionNote ? ` · Decision note: ${r.decisionNote}` : ""}</p>
      </header>

      <section className="flex flex-wrap gap-3">
        {r.status === "submitted" && can.has("returns.manage") && (
          <>
            <ReasonAction label="Approve return" path={`/v1/admin/returns/${r.id}/decide`} body={{ decision: "approved", version: r.version }} reasonField="note" reasonLabel="Decision note" confirm="The customer is told to send the items back. No stock or money moves yet." />
            <ReasonAction label="Reject return" tone="danger" path={`/v1/admin/returns/${r.id}/decide`} body={{ decision: "rejected", version: r.version }} reasonField="note" reasonLabel="Reason shown to the customer" />
          </>
        )}
        {r.status === "approved" && canStock && (
          <ReasonAction label="Record items received" path={`/v1/admin/returns/${r.id}/receive`} body={{ version: r.version }} reasonField="note" reasonLabel="Receiving note (condition on arrival, courier, etc.)" confirm="Units are added to the RETURNS-QUARANTINE location under the batch they shipped from. They are not sellable." />
        )}
      </section>

      <section className="card p-6" aria-labelledby="lines-h">
        <h2 id="lines-h" className="mb-4 font-display text-xl">Lines</h2>
        <ul className="space-y-4">
          {r.lines.map((l) => (
            <li key={l.id} className="rounded-xl border border-divider p-4">
              <p className="font-medium">{l.quantity} × {l.name}</p>
              <p className="text-sm">{DISPOSITION[l.disposition] ?? titleCase(l.disposition)}{l.dispositionNote ? ` · ${l.dispositionNote}` : ""}</p>
              {l.batch && <p className="text-sm text-muted">Lot {l.batch.lot} · batch {titleCase(l.batch.status)}{l.batch.expiresAt ? ` · expires ${formatDate(l.batch.expiresAt)}` : ""}</p>}
              {l.disposition === "quarantine" && canStock && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <ReasonAction label="Restock" path={`/v1/admin/return-lines/${l.id}/inspect`} body={{ disposition: "restocked" }} reasonField="note" reasonLabel="Inspection note (seal, condition)" confirm="Moves these units back to sellable stock in their original batch. Refused if the batch is expired, recalled or on hold." />
                  <ReasonAction label="Dispose" tone="danger" path={`/v1/admin/return-lines/${l.id}/inspect`} body={{ disposition: "disposed" }} reasonField="note" reasonLabel="Why are these units being written off?" />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-6" aria-labelledby="ref-h">
        <h2 id="ref-h" className="mb-2 font-display text-xl">Refunds for this return</h2>
        {r.refunds.length === 0 ? (
          <p className="text-sm text-muted">None yet. Refunds are requested from the <Link href={`/admin/orders/${r.order.id}`} className="text-teal underline">order page</Link> and approved by a second person.</p>
        ) : (
          <ul className="text-sm">{r.refunds.map((f) => <li key={f.id}><span className="tabular">{formatPaise(f.amountPaise)}</span> · {titleCase(f.state)}</li>)}</ul>
        )}
      </section>
    </div>
  );
}
