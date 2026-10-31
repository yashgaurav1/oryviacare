import Image from "next/image";
import Link from "next/link";
import type { ProductCard as Card } from "@/lib/api";
import { AddToCart, Price, StockBadge } from "./commerce";

export function ProductCard({ p, priority = false }: { p: Card; priority?: boolean }) {
  const img = p.images[0];
  return (
    <article className="card lift group flex flex-col overflow-hidden">
      <Link href={`/products/${p.slug}`} className="relative block aspect-square bg-cream" aria-label={p.name}>
        {img ? (
          <Image src={img.src} alt={img.alt} fill sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" priority={priority} />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-sm text-muted">Image pending</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {p.categories[0] && <p className="eyebrow">{p.categories[0].name}</p>}
        <h3 className="text-[0.98rem] leading-snug">
          <Link href={`/products/${p.slug}`} className="hover:text-primary">
            {p.name}
          </Link>
        </h3>
        {p.packSize && <p className="text-sm text-muted">{p.packSize}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <Price pricePaise={p.pricePaise} referencePaise={p.referencePaise} />
          <StockBadge availability={p.availability} quantity={p.availableQuantity} />
        </div>
        <AddToCart variantId={p.variantId} available={p.availability === "in_stock"} maxQuantity={p.availableQuantity} compact />
      </div>
    </article>
  );
}
