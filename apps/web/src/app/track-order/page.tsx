import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageIntro } from "@/components/catalog-listing";
import { OrderTimeline, type TrackedOrder } from "@/components/order-timeline";
import { apiOrNull } from "@/lib/api";

export const metadata: Metadata = { title: "Track your order", robots: { index: false } };

export default async function TrackOrder({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const order = token ? await apiOrNull<TrackedOrder>(`/v1/track?token=${encodeURIComponent(token)}`) : null;
  return (
    <>
      <PageIntro title="Track your order">Use the private tracking link from your order confirmation. Signed-in customers can see every order in their account.</PageIntro>
      <Container className="max-w-4xl">
        {order ? (
          <>
            <p className="mb-4 tabular font-display text-2xl">{order.reference}</p>
            {order.isDevelopmentOrder && <p className="mb-4 rounded-xl bg-warning-bg px-4 py-3 text-sm text-warning">Development order: no payment was taken.</p>}
            <OrderTimeline order={order} />
          </>
        ) : (
          <div className="card p-8">
            {token && <p className="mb-4 text-error" role="alert">That tracking link is not valid. Check that you copied the whole link.</p>}
            <p className="mb-6">For your privacy, orders cannot be looked up by order number alone.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/account/orders" className="btn btn-primary">See orders in my account</Link>
              <Link href="/contact" className="btn btn-secondary">Contact support</Link>
            </div>
          </div>
        )}
      </Container>
    </>
  );
}
