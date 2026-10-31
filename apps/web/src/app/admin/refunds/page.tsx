import Link from "next/link";
import { formatPaise } from "@oryvia/contracts";
import { api, apiOrNull, type Me } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";
import { ReasonAction } from "../admin-actions";

export const metadata = { title: "Refunds" };

type Row = {
  id: string;
  amountPaise: number;
  state: string;
  reason: string;
  requestedBy: string;
  approvedBy: string | null;
  createdAt: string;
  paymentAttempt: { provider: string; order: { id: string; publicReference: string; isDevelopmentOrder: boolean } };
  returnRequest: { reference: string } | null;
};
const STATES = ["requested", "recorded_development", "succeeded", "rejected"];

export default async function AdminRefunds({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ pageSize: "50", ...(sp.state ? { state: sp.state } : {}) });
  const [data, me] = await Promise.all([api<{ items: Row[]; total: number }>(`/v1/admin/refunds?${qs}`), apiOrNull<Me>("/v1/account/me")]);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl">Refunds</h1>
      <p className="max-w-2xl text-sm text-muted">
        Every refund needs two people: one requests it from the order page, another approves it here. Refunds through Razorpay are not connected yet, so approval of a real payment is refused and nothing is sent. Development orders only record the refund.
      </p>
      <nav aria-label="Filter by state" className="flex flex-wrap gap-2">
        <Link href="/admin/refunds" className={`btn ${!sp.state ? "btn-primary" : "btn-ghost"}`}>All</Link>
        {STATES.map((s) => <Link key={s} href={`/admin/refunds?state=${s}`} className={`btn ${sp.state === s ? "btn-primary" : "btn-ghost"}`}>{titleCase(s)}</Link>)}
      </nav>
      {data.items.length === 0 ? (
        <p className="card p-8 text-center text-muted">No refunds{sp.state ? ` in state ${titleCase(sp.state)}` : ""}.</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r.id} className="card p-4">
              <p className="text-sm">
                <span className="tabular text-base font-medium">{formatPaise(r.amountPaise)}</span> · {titleCase(r.state)} · order{" "}
                <Link href={`/admin/orders/${r.paymentAttempt.order.id}`} className="tabular text-teal underline">{r.paymentAttempt.order.publicReference}</Link>
                {r.returnRequest && <> · return {r.returnRequest.reference}</>} · {r.paymentAttempt.provider} · {formatDateTime(r.createdAt)}
                {r.paymentAttempt.order.isDevelopmentOrder && <span className="ml-2 rounded bg-warning-bg px-1.5 py-0.5 text-xs text-warning">DEV</span>}
              </p>
              <p className="text-sm text-muted">{r.reason}</p>
              {r.state === "requested" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.requestedBy === me?.userId ? (
                    <p className="text-xs text-muted">You requested this refund, so someone else must approve it.</p>
                  ) : (
                    <ReasonAction label="Approve refund" path={`/v1/admin/refunds/${r.id}/decide`} body={{ decision: "approved" }} reasonField="note" confirm={r.paymentAttempt.order.isDevelopmentOrder ? "Development order: this records the refund; no money moves." : "This sends the refund to the payment provider."} />
                  )}
                  <ReasonAction label="Reject refund" tone="secondary" path={`/v1/admin/refunds/${r.id}/decide`} body={{ decision: "rejected" }} reasonField="note" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
