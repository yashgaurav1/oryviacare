"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatPaise } from "@oryvia/contracts";
import { Banner } from "@/components/forms";
import { call, cartChanged } from "@/lib/client";

export interface CartView {
  id: string | null;
  items: Array<{
    id: string;
    variantId: string;
    quantity: number;
    productSlug: string;
    productName: string;
    variantTitle: string | null;
    image: { src: string; alt: string } | null;
    unitPaise: number | null;
    lineSubtotalPaise: number | null;
    availableQuantity: number;
    problem: { message: string } | null;
  }>;
  removed: Array<{ id: string; productName: string; quantity: number }>;
  quote: { subtotalPaise: number; problems: unknown[] };
}

export function CartViewClient({ initial }: { initial: CartView }) {
  const [cart, setCart] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (key: string, path: string, method: string, body?: unknown) => {
    setBusy(key);
    setError(null);
    const r = await call<CartView>(path, { method, body });
    setBusy(null);
    if (!r.ok) return setError(r.error.message);
    setCart(r.data);
    cartChanged(r.data.items.length);
  };

  if (!cart.items.length)
    return (
      <div className="space-y-4">
        {cart.removed.map((r) => (
          <Banner key={r.id} tone="info">
            Removed {r.productName}.{" "}
            <button className="underline" onClick={() => mutate(r.id, `/v1/carts/current/items/${r.id}/restore`, "POST")}>Undo</button>
          </Banner>
        ))}
        <div className="card p-10 text-center">
          <p className="mb-2 font-display text-2xl">Your cart is empty</p>
          <p className="mb-6 text-muted">Browse the range and add something you like.</p>
          <Link href="/shop" className="btn btn-primary">Shop products</Link>
        </div>
      </div>
    );

  const blocked = cart.items.some((i) => i.problem);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section aria-label="Cart items" className="space-y-3">
        {error && <Banner tone="error">{error}</Banner>}
        {cart.removed.map((r) => (
          <Banner key={r.id} tone="info">
            Removed {r.productName}.{" "}
            <button className="underline" onClick={() => mutate(r.id, `/v1/carts/current/items/${r.id}/restore`, "POST")}>Undo</button>
          </Banner>
        ))}
        <ul className="space-y-3">
          {cart.items.map((i, n) => (
            <li key={i.id} className="rise card flex gap-4 p-4 transition-shadow duration-300 hover:shadow-[var(--shadow-lift)]" style={{ animationDelay: `${n * 70}ms` }}>
              <Link href={`/products/${i.productSlug}`} className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-cream">
                {i.image && <Image src={i.image.src} alt={i.image.alt} fill sizes="96px" className="object-cover" />}
              </Link>
              <div className="flex flex-1 flex-col gap-2">
                <Link href={`/products/${i.productSlug}`} className="font-medium leading-snug hover:text-primary">{i.productName}</Link>
                {i.variantTitle && <span className="text-sm text-muted">{i.variantTitle}</span>}
                {i.problem && <p className="text-sm text-error" role="alert">{i.problem.message}</p>}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center rounded-full ring-1 ring-control">
                    <button className="h-10 w-10 disabled:opacity-40" aria-label={`Decrease quantity of ${i.productName}`} disabled={i.quantity <= 1 || busy === i.id} onClick={() => mutate(i.id, `/v1/carts/current/items/${i.id}`, "PATCH", { quantity: i.quantity - 1 })}>−</button>
                    <span className="tabular w-10 text-center" aria-live="polite">{i.quantity}</span>
                    <button className="h-10 w-10 disabled:opacity-40" aria-label={`Increase quantity of ${i.productName}`} disabled={i.quantity >= Math.min(99, i.availableQuantity) || busy === i.id} onClick={() => mutate(i.id, `/v1/carts/current/items/${i.id}`, "PATCH", { quantity: i.quantity + 1 })}>+</button>
                  </div>
                  <span className="tabular font-medium">{i.lineSubtotalPaise !== null ? formatPaise(i.lineSubtotalPaise) : "-"}</span>
                  <button className="btn btn-ghost text-sm" disabled={busy === i.id} onClick={() => mutate(i.id, `/v1/carts/current/items/${i.id}`, "DELETE")}>Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <aside className="glass rise h-fit rounded-[28px] p-6 lg:sticky lg:top-28" style={{ animationDelay: "150ms" }} aria-label="Order summary">
        <h2 className="mb-4 font-display text-2xl">Summary</h2>
        <dl className="space-y-2">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular">{formatPaise(cart.quote.subtotalPaise)}</dd></div>
          <div className="flex justify-between text-muted"><dt>Delivery</dt><dd>Calculated at checkout</dd></div>
        </dl>
        {blocked && <p className="mt-4 text-sm text-error">Resolve the highlighted items before checkout.</p>}
        {blocked ? (
          <button className="btn btn-primary mt-6 w-full" disabled>Checkout</button>
        ) : (
          <Link href="/checkout" className="btn btn-primary mt-6 w-full">Checkout</Link>
        )}
        <p className="mt-3 text-xs text-muted">Prices and stock are checked again on the server before you pay.</p>
      </aside>
    </div>
  );
}
