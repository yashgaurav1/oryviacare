import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { ReceiptForm } from "./receipt-form";

type Inv = {
  warehouses: Array<{ code: string; name: string }>;
  variants: Array<{ id: string; internalCode: string; product: string; productStatus: string; onHand: number; reserved: number; batches: Array<{ warehouse: string; lot: string | null; status: string | null; expiresAt: string | null; onHand: number; reserved: number }> }>;
  movements: Array<{ id: string; product: string; warehouse: string; delta: number; reason: string; reference: string | null; note: string | null; at: string }>;
};

export default async function Inventory() {
  const d = await api<Inv>("/v1/admin/inventory");
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Inventory</h1>
      <section className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-divider text-muted"><tr>{["Product", "Code", "On hand", "Reserved", "Available", "Batches"].map((h) => <th key={h} scope="col" className="p-3 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {d.variants.map((v) => (
              <tr key={v.id} className="border-b border-divider align-top last:border-0">
                <td className="p-3">{v.product}</td>
                <td className="p-3 text-muted">{v.internalCode}</td>
                <td className="tabular p-3">{v.onHand}</td>
                <td className="tabular p-3">{v.reserved}</td>
                <td className="tabular p-3 font-medium">{v.onHand - v.reserved}</td>
                <td className="p-3 text-xs">{v.batches.map((b, i) => <div key={i}>{b.warehouse} · {b.lot ?? "unbatched"} · {b.status ?? "—"}{b.expiresAt ? ` · exp ${formatDate(b.expiresAt)}` : ""} · {b.onHand}/{b.reserved}</div>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card p-6">
        <h2 className="mb-4 font-display text-xl">Record a stock receipt</h2>
        <ReceiptForm variants={d.variants.map((v) => ({ id: v.id, label: `${v.product} (${v.internalCode})` }))} warehouses={d.warehouses} />
      </section>
      <section className="card p-6">
        <h2 className="mb-4 font-display text-xl">Recent stock movements (immutable ledger)</h2>
        <ul className="space-y-1 text-sm">
          {d.movements.map((m) => <li key={m.id}><span className={`tabular ${m.delta > 0 ? "text-success" : "text-error"}`}>{m.delta > 0 ? "+" : ""}{m.delta}</span> {m.product} · {m.warehouse} · {m.reason}{m.reference ? ` · ${m.reference}` : ""}{m.note ? ` · ${m.note}` : ""} <span className="text-muted">· {formatDateTime(m.at)}</span></li>)}
        </ul>
      </section>
    </div>
  );
}
