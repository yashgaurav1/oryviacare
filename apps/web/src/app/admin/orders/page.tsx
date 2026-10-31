import Link from "next/link";
import { formatPaise } from "@oryvia/contracts";
import { api } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";

type Row = { id: string; reference: string; email: string; state: string; paymentState: string; fulfilmentState: string; totalPaise: number; placedAt: string; lines: number; isDevelopmentOrder: boolean };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  qs.set("pageSize", "25");
  const data = await api<{ items: Row[]; total: number; page: number; pageSize: number }>(`/v1/admin/orders?${qs}`);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const link = (p: number) => {
    const u = new URLSearchParams(qs);
    u.set("page", String(p));
    return `/admin/orders?${u}`;
  };
  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl">Orders</h1>
      <form method="get" className="card grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
        <div><label htmlFor="q" className="label">Reference or email</label><input id="q" name="q" defaultValue={sp.q} className="input" /></div>
        <div>
          <label htmlFor="state" className="label">State</label>
          <select id="state" name="state" defaultValue={sp.state ?? ""} className="input">
            <option value="">Any</option>
            {["placed", "confirmed", "cancelled", "closed"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
          </select>
        </div>
        <div><label htmlFor="from" className="label">From</label><input id="from" type="date" name="from" defaultValue={sp.from} className="input" /></div>
        <div><label htmlFor="to" className="label">To</label><input id="to" type="date" name="to" defaultValue={sp.to} className="input" /></div>
        <div className="flex gap-2"><button className="btn btn-primary">Filter</button><Link href="/admin/orders" className="btn btn-ghost">Clear</Link></div>
      </form>
      <p className="text-sm text-muted" aria-live="polite">{data.total} order{data.total === 1 ? "" : "s"}</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="sticky top-0 border-b border-divider bg-surface text-muted">
            <tr>{["Reference", "Placed", "Customer", "Order", "Payment", "Fulfilment", "Lines", "Total"].map((h) => <th key={h} scope="col" className={`p-3 font-normal ${h === "Total" ? "text-right" : ""}`}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.items.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted">No orders match these filters.</td></tr>}
            {data.items.map((o) => (
              <tr key={o.id} className="border-b border-divider last:border-0 hover:bg-canvas">
                <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="tabular font-medium text-teal underline">{o.reference}</Link>{o.isDevelopmentOrder && <span className="ml-2 rounded bg-warning-bg px-1.5 py-0.5 text-xs text-warning">DEV</span>}</td>
                <td className="p-3">{formatDateTime(o.placedAt)}</td>
                <td className="p-3">{o.email}</td>
                <td className="p-3">{titleCase(o.state)}</td>
                <td className="p-3">{titleCase(o.paymentState)}</td>
                <td className="p-3">{titleCase(o.fulfilmentState)}</td>
                <td className="tabular p-3">{o.lines}</td>
                <td className="tabular p-3 text-right">{formatPaise(o.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex gap-2">
          {data.page > 1 && <Link className="btn btn-secondary" href={link(data.page - 1)}>Previous</Link>}
          <span className="self-center text-sm text-muted">Page {data.page} of {pages}</span>
          {data.page < pages && <Link className="btn btn-secondary" href={link(data.page + 1)}>Next</Link>}
        </nav>
      )}
    </div>
  );
}
