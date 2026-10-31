import Link from "next/link";
import { formatPaise } from "@oryvia/contracts";
import { api } from "@/lib/api";
import { formatDate, titleCase } from "@/lib/format";
import type { OrderRow } from "../page";

export default async function Orders() {
  const orders = await api<OrderRow[]>("/v1/account/orders");
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Orders</h1>
      {orders.length === 0 ? (
        <div className="card p-8"><p className="mb-4">You have not placed any orders while signed in.</p><Link href="/shop" className="btn btn-primary">Shop products</Link></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead className="border-b border-divider text-sm text-muted">
              <tr><th scope="col" className="p-4 font-normal">Order</th><th scope="col" className="p-4 font-normal">Placed</th><th scope="col" className="p-4 font-normal">Status</th><th scope="col" className="p-4 font-normal">Payment</th><th scope="col" className="p-4 text-right font-normal">Total</th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-divider last:border-0">
                  <td className="p-4"><Link href={`/account/orders/${o.id}`} className="tabular font-medium text-teal underline">{o.reference}</Link></td>
                  <td className="p-4">{formatDate(o.placedAt)}</td>
                  <td className="p-4">{titleCase(o.state)}</td>
                  <td className="p-4">{o.isDevelopmentOrder ? "Development (unpaid)" : titleCase(o.paymentState)}</td>
                  <td className="tabular p-4 text-right">{formatPaise(o.totalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
