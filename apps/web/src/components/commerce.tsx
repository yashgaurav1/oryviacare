"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPaise } from "@oryvia/contracts";
import { call, cartChanged } from "@/lib/client";
import { toast } from "./toaster";

export function Price({ pricePaise, referencePaise, referenceLabel, size = "md" }: { pricePaise: number | null; referencePaise?: number | null; referenceLabel?: string | null; size?: "md" | "lg" }) {
  if (pricePaise === null) return <span className="text-sm text-muted">Price not available</span>;
  const showRef = referencePaise && referencePaise > pricePaise;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className={`tabular font-display ${size === "lg" ? "text-4xl" : "text-xl"}`}>{formatPaise(pricePaise)}</span>
      {showRef && (
        <span className="tabular text-sm text-muted">
          <span className="sr-only">Listed reference price</span>
          <s>{formatPaise(referencePaise)}</s>
          {referenceLabel && size === "lg" && <span className="ml-1 text-xs no-underline">({referenceLabel})</span>}
        </span>
      )}
    </span>
  );
}

export function StockBadge({ availability, quantity }: { availability: "in_stock" | "out_of_stock" | "not_for_sale"; quantity: number }) {
  if (availability === "not_for_sale") return <span className="rounded-full bg-sunk px-2.5 py-1 text-xs text-muted">Not for sale online</span>;
  if (availability === "out_of_stock") return <span className="rounded-full bg-warning-bg px-2.5 py-1 text-xs text-warning">Out of stock</span>;
  return <span className="rounded-full bg-success-bg px-2.5 py-1 text-xs text-success">{quantity <= 5 ? `Only ${quantity} left` : "In stock"}</span>;
}

export function AddToCart({
  variantId,
  available,
  maxQuantity,
  compact = false,
  name,
  image,
}: {
  variantId: string | null;
  available: boolean;
  maxQuantity: number;
  compact?: boolean;
  /** Shown in the confirmation toast. */
  name?: string;
  image?: string | null;
}) {
  const [qty, setQty] = useState(1);
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  if (!variantId || !available)
    return (
      <button className="btn btn-secondary w-full" disabled aria-describedby={variantId ? undefined : "nfs"}>
        {variantId ? "Out of stock" : "Not available"}
      </button>
    );
  const add = async (thenCheckout: boolean) => {
    setState("adding");
    setError(null);
    const r = await call<{ items: unknown[] }>("/v1/carts/current/items", { method: "POST", body: { variantId, quantity: qty } });
    if (!r.ok) {
      setError(r.error.message);
      setState("idle");
      return;
    }
    cartChanged(r.data.items.length);
    setState("added");
    if (thenCheckout) router.push("/checkout");
    else {
      toast({ title: "Added to cart", body: name ? `${qty} × ${name}` : undefined, image, href: "/cart", linkLabel: "View cart" });
      router.refresh();
    }
  };
  const cap = Math.max(1, Math.min(maxQuantity, 99));
  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center gap-3">
          <label htmlFor="qty" className="text-sm">
            Quantity
          </label>
          <div className="inline-flex items-center rounded-full bg-surface ring-1 ring-control">
            <button type="button" className="h-11 w-11 text-lg disabled:opacity-40" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)}>
              −
            </button>
            <input id="qty" className="tabular h-11 w-12 text-center" inputMode="numeric" value={qty} onChange={(e) => setQty(Math.min(cap, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))} />
            <button type="button" className="h-11 w-11 text-lg disabled:opacity-40" aria-label="Increase quantity" disabled={qty >= cap} onClick={() => setQty((q) => q + 1)}>
              +
            </button>
          </div>
        </div>
      )}
      <div className={compact ? "" : "grid gap-2 sm:grid-cols-2"}>
        <button className="btn btn-primary w-full" disabled={state === "adding"} onClick={() => add(false)}>
          {state === "adding" ? "Adding…" : state === "added" ? <span key="added" className="pop inline-flex items-center gap-1.5"><span aria-hidden="true">✓</span> Added — add more</span> : "Add to cart"}
        </button>
        {!compact && (
          <button className="btn btn-secondary w-full" disabled={state === "adding"} onClick={() => add(true)}>
            Buy now
          </button>
        )}
      </div>
      {state === "added" && !compact && (
        <p role="status" className="text-sm text-success">
          Added to your cart. <Link href="/cart" className="underline">View cart</Link>
        </p>
      )}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
