import Link from "next/link";
import { formatPaise } from "@oryvia/contracts";
import { Banner } from "@/components/forms";
import { api, type Me } from "@/lib/api";
import { formatDate, titleCase } from "@/lib/format";

export type OrderRow = { id: string; reference: string; state: string; paymentState: string; totalPaise: number; placedAt: string; lineCount: number; isDevelopmentOrder: boolean };

export default async function AccountHome() {
  const [me, orders] = await Promise.all([api<Me>("/v1/account/me"), api<OrderRow[]>("/v1/account/orders")]);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Your account</h1>
      {!me.emailVerified && <Banner tone="warning">Please verify your email address using the link we sent you.</Banner>}
      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl">Recent orders</h2>
          <Link href="/account/orders" className="btn btn-ghost">All orders</Link>
        </div>
        {orders.length === 0 ? (
          <p className="text-muted">No orders yet. <Link href="/shop" className="underline">Start shopping</Link>.</p>
        ) : (
          <ul className="divide-y divide-divider">
            {orders.slice(0, 3).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <Link href={`/account/orders/${o.id}`} className="tabular font-medium hover:text-primary">{o.reference}</Link>
                <span className="text-sm text-muted">{formatDate(o.placedAt)} · {titleCase(o.state)}</span>
                <span className="tabular">{formatPaise(o.totalPaise)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/contact" className="card lift p-6"><span className="font-medium">Need help with an order?</span><span className="block text-sm text-muted">Send a message with your order reference.</span></Link>
        <Link href="/partners/apply" className="card lift p-6"><span className="font-medium">Buying for a salon or shop?</span><span className="block text-sm text-muted">Apply for a business account.</span></Link>
      </section>
    </div>
  );
}
