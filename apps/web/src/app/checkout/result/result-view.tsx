"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPaise } from "@oryvia/contracts";
import { Banner } from "@/components/forms";
import { call } from "@/lib/client";
import { OrderTimeline, type TrackedOrder } from "@/components/order-timeline";

/** Shows the order as recorded by the server. A browser redirect alone never marks anything paid. */
export function ResultView({ reference }: { reference: string }) {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const t = sessionStorage.getItem(`oryvia:order:${reference}`);
    setToken(t);
    if (!t) return;
    call<TrackedOrder>(`/v1/track?token=${encodeURIComponent(t)}`).then((r) => (r.ok ? setOrder(r.data) : setFailed(true)));
  }, [reference]);

  if (!token)
    return <Banner tone="info">Order {reference} was placed in another session. Use the tracking link from your confirmation, or sign in to see your orders.</Banner>;
  if (failed) return <Banner tone="error">We could not load this order. Please try again from the tracking page.</Banner>;
  if (!order) return <p className="text-muted">Loading your order…</p>;
  const trackUrl = `/track-order?token=${encodeURIComponent(token)}`;
  return (
    <div className="space-y-6">
      {order.isDevelopmentOrder ? (
        <Banner tone="warning">
          Development order recorded. <strong>No payment was taken</strong> and the order is not paid. This option exists only in development.
        </Banner>
      ) : order.paymentState === "captured" ? (
        <Banner tone="success">Payment confirmed by the payment provider.</Banner>
      ) : (
        <Banner tone="info">Order received. We are waiting for payment confirmation from the provider.</Banner>
      )}
      <div className="card p-6">
        <p className="text-muted">Order reference</p>
        <p className="tabular font-display text-3xl">{order.reference}</p>
        <p className="mt-2 tabular">Total {formatPaise(order.totals.totalPaise)}</p>
      </div>
      <OrderTimeline order={order} />
      <div className="card p-6">
        <p className="mb-2 font-medium">Save your private tracking link</p>
        <p className="mb-3 text-sm text-muted">Anyone with this link can see the order status (never your address). Keep it safe.</p>
        <Link href={trackUrl} className="break-all text-teal underline">{typeof window !== "undefined" ? window.location.origin : ""}{trackUrl}</Link>
      </div>
      <Link href="/shop" className="btn btn-secondary">Continue shopping</Link>
    </div>
  );
}
