import Link from "next/link";
import { api } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";

export const metadata = { title: "Returns" };

type Row = { id: string; reference: string; status: string; reason: string; createdAt: string; order: { id: string; publicReference: string; email: string; isDevelopmentOrder: boolean }; _count: { lines: number } };
const STATUSES = ["submitted", "approved", "received", "inspected", "rejected"];

export default async function AdminReturns({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ pageSize: "25", page: sp.page ?? "1", ...(sp.status ? { status: sp.status } : {}) });
  const data = await api<{ items: Row[]; total: number; page: number; pageSize: number }>(`/v1/admin/returns?${qs}`);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl">Returns</h1>
      <p className="max-w-2xl text-sm text-muted">Returned units go into the quarantine location when received and are never sellable until an inspection restocks them.</p>
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        <Link href="/admin/returns" className={`btn ${!sp.status ? "btn-primary" : "btn-ghost"}`}>All</Link>
        {STATUSES.map((s) => <Link key={s} href={`/admin/returns?status=${s}`} className={`btn ${sp.status === s ? "btn-primary" : "btn-ghost"}`}>{titleCase(s)}</Link>)}
      </nav>
      <p className="text-sm text-muted" aria-live="polite">{data.total} return{data.total === 1 ? "" : "s"}</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-divider text-muted">
            <tr>{["Return", "Opened", "Order", "Status", "Lines", "Reason"].map((h) => <th key={h} scope="col" className="p-3 font-normal">{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.items.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted">No returns{sp.status ? ` with status ${titleCase(sp.status)}` : ""}.</td></tr>}
            {data.items.map((r) => (
              <tr key={r.id} className="border-b border-divider last:border-0">
                <td className="p-3"><Link href={`/admin/returns/${r.id}`} className="tabular font-medium text-teal underline">{r.reference}</Link></td>
                <td className="p-3">{formatDateTime(r.createdAt)}</td>
                <td className="p-3"><Link href={`/admin/orders/${r.order.id}`} className="tabular text-teal underline">{r.order.publicReference}</Link>{r.order.isDevelopmentOrder && <span className="ml-2 rounded bg-warning-bg px-1.5 py-0.5 text-xs text-warning">DEV</span>}</td>
                <td className="p-3">{titleCase(r.status)}</td>
                <td className="tabular p-3">{r._count.lines}</td>
                <td className="p-3">{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.total > data.pageSize && (
        <nav aria-label="Pagination" className="flex gap-2">
          {data.page > 1 && <Link className="btn btn-secondary" href={`/admin/returns?${new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), page: String(data.page - 1) })}`}>Previous</Link>}
          {data.page * data.pageSize < data.total && <Link className="btn btn-secondary" href={`/admin/returns?${new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), page: String(data.page + 1) })}`}>Next</Link>}
        </nav>
      )}
    </div>
  );
}
