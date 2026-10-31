import Link from "next/link";
import { formatPaise } from "@oryvia/contracts";
import { apiOrNull } from "@/lib/api";
import { formatDate, titleCase } from "@/lib/format";

export type Workspace = {
  account: { displayName: string; type: string; status: string; tier: string | null; programme: string | null };
  role: string;
  orders: Array<{ reference: string; state: string; paymentState: string; totalPaise: number; placedAt: string }>;
  quotes: Array<{ reference: string; package: string | null; status: string; createdAt: string }>;
};

export default async function PartnerHome() {
  const ws = await apiOrNull<Workspace>("/v1/partner/workspace");
  if (!ws) return null;
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">{titleCase(ws.account.type)} · {ws.account.programme ?? "Programme pending"} · {ws.account.tier ?? "No tier"}</p>
        <h1 className="font-display text-4xl">{ws.account.displayName}</h1>
        <p className="text-muted">You are signed in as {ws.role}.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-[18px] p-5"><p className="text-sm text-muted">Orders</p><p className="tabular text-3xl">{ws.orders.length}</p></div>
        <div className="glass rounded-[18px] p-5"><p className="text-sm text-muted">Quote requests</p><p className="tabular text-3xl">{ws.quotes.length}</p></div>
        <div className="glass rounded-[18px] p-5"><p className="text-sm text-muted">Next step</p><Link href="/packages" className="mt-1 inline-block text-teal underline">Request a package quote</Link></div>
      </div>
      <section className="card p-6">
        <h2 className="mb-4 font-display text-2xl">Recent quote requests</h2>
        {ws.quotes.length === 0 ? <p className="text-muted">No quote requests yet.</p> : (
          <ul className="divide-y divide-divider">{ws.quotes.map((q) => <li key={q.reference} className="flex justify-between py-3"><span className="tabular">{q.reference}</span><span>{q.package ?? "General"}</span><span className="text-muted">{titleCase(q.status)} · {formatDate(q.createdAt)}</span></li>)}</ul>
        )}
      </section>
      <section className="card p-6">
        <h2 className="mb-4 font-display text-2xl">Recent orders</h2>
        {ws.orders.length === 0 ? <p className="text-muted">No business orders yet.</p> : (
          <ul className="divide-y divide-divider">{ws.orders.map((o) => <li key={o.reference} className="flex justify-between py-3"><span className="tabular">{o.reference}</span><span>{titleCase(o.state)}</span><span className="tabular">{formatPaise(o.totalPaise)}</span></li>)}</ul>
        )}
      </section>
    </div>
  );
}
