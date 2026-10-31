import Link from "next/link";
import { formatPaise } from "@oryvia/contracts";
import { api } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";

type Overview = {
  range: { from: string; toExclusive: string; timezone: string };
  definitions: Record<string, string>;
  kpis: { ordersPlaced: number; capturedPaymentsPaise: number; capturedOrders: number; developmentOrders: number };
  ordersByState: Array<{ state: string; count: number }>;
  queues: { openEnquiries: number; openQuotes: number; openExceptions: number; pendingApplications: number; packagesInReview: number; ordersToShip: number; openReturns: number; pendingRefunds: number };
  lowStock: Array<{ variantId: string; name: string; available: number }>;
  alerts: Array<{ level: string; message: string }>;
  dataFreshness: string;
};

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  const o = await api<Overview>(`/v1/admin/overview?${qs}`);
  const kpi = (label: string, value: string, def: string | undefined, href: string) => (
    <Link href={href} className="glass block rounded-[18px] p-5 hover:ring-1 hover:ring-primary">
      <p className="text-sm text-muted" title={def}>{label}</p>
      <p className="tabular mt-1 text-3xl">{value}</p>
      {def && <p className="mt-2 text-xs text-muted">{def}</p>}
    </Link>
  );
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Overview</h1>
          <p className="text-sm text-muted">Asia/Kolkata dates · data as of {formatDateTime(o.dataFreshness)}</p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div><label htmlFor="from" className="label">From</label><input id="from" type="date" name="from" defaultValue={sp.from ?? o.range.from.slice(0, 10)} className="input" /></div>
          <div><label htmlFor="to" className="label">To</label><input id="to" type="date" name="to" defaultValue={sp.to} className="input" /></div>
          <button className="btn btn-secondary">Apply</button>
        </form>
      </header>
      {o.alerts.length > 0 && (
        <ul className="space-y-2">{o.alerts.map((a) => <li key={a.message} className={`rounded-xl px-4 py-3 text-sm ${a.level === "error" ? "bg-error-bg text-error" : "bg-warning-bg text-warning"}`}>{a.message}</li>)}</ul>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpi("Orders placed", String(o.kpis.ordersPlaced), o.definitions.ordersPlaced, "/admin/orders")}
        {kpi("Captured payments", formatPaise(o.kpis.capturedPaymentsPaise), o.definitions.capturedPayments, "/admin/orders")}
        {kpi("Development orders", String(o.kpis.developmentOrders), "Test orders placed with the development payment method. Excluded from every other figure.", "/admin/orders")}
        {kpi("Open migration issues", String(o.queues.openExceptions), "Source-data conflicts and gaps awaiting a decision.", "/admin/migration")}
      </div>
      {o.kpis.ordersPlaced === 0 && <p className="card p-5 text-sm text-muted">No live orders yet. Sales trends appear here once real orders are placed and payments are verified by the payment provider.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-4 font-display text-xl">Work queues</h2>
          <ul className="space-y-2">
            {[
              ["Confirmed orders to ship", o.queues.ordersToShip, "/admin/orders?state=confirmed"],
              ["Open returns", o.queues.openReturns, "/admin/returns"],
              ["Refunds awaiting approval", o.queues.pendingRefunds, "/admin/refunds?state=requested"],
              ["Open enquiries", o.queues.openEnquiries, "/admin/enquiries"],
              ["Quote requests", o.queues.openQuotes, "/admin/enquiries"],
              ["Partner applications to review", o.queues.pendingApplications, "/admin/applications"],
              ["Packages awaiting approval", o.queues.packagesInReview, "/admin/packages"],
            ].map(([l, n, h]) => (
              <li key={String(l)}><Link href={String(h)} className="flex justify-between rounded-lg px-3 py-2 hover:bg-sunk"><span>{l}</span><span className="tabular">{n}</span></Link></li>
            ))}
          </ul>
        </section>
        <section className="card p-6">
          <h2 className="mb-4 font-display text-xl">Low stock (published products, under 10 available)</h2>
          {o.lowStock.length === 0 ? <p className="text-muted">Nothing below the threshold.</p> : (
            <ul className="space-y-1">{o.lowStock.map((s) => <li key={s.variantId} className="flex justify-between"><span>{s.name}</span><span className="tabular">{s.available}</span></li>)}</ul>
          )}
          <p className="mt-4 text-sm"><Link href="/admin/inventory" className="text-teal underline">Inventory</Link></p>
        </section>
      </div>
      {o.ordersByState.length > 0 && (
        <section className="card p-6">
          <h2 className="mb-4 font-display text-xl">Orders by state</h2>
          <table className="w-full max-w-md text-left text-sm"><tbody>{o.ordersByState.map((s) => <tr key={s.state} className="border-b border-divider"><th scope="row" className="py-2 font-normal">{titleCase(s.state)}</th><td className="tabular py-2 text-right">{s.count}</td></tr>)}</tbody></table>
        </section>
      )}
    </div>
  );
}
