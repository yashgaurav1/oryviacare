import Image from "next/image";
import Link from "next/link";
import type { ProductCard as Card } from "@/lib/api";
import { AddToCart, Price, StockBadge } from "./commerce";
import { Tilt } from "./motion";

const TINT: Record<string, string> = { "skin-care": "bg-blush", "hair-care": "bg-sage" };

export function ProductCard({ p, priority = false }: { p: Card; priority?: boolean }) {
  const [img, alt2] = p.images;
  const tint = TINT[p.categories[0]?.slug ?? ""] ?? "bg-cream";
  return (
    <Tilt className="h-full rounded-[var(--radius-card)]">
      <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-ambient)]">
        <Link href={`/products/${p.slug}`} className={`relative block aspect-[4/5] overflow-hidden ${tint}`} aria-label={p.name}>
          {img ? (
            <>
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw"
                className={`object-cover transition-all duration-700 [transition-timing-function:var(--ease-out)] group-hover:scale-[1.06] ${alt2 ? "group-hover:opacity-0" : ""}`}
                priority={priority}
              />
              {alt2 && (
                <Image src={alt2.src} alt="" fill sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw" className="scale-[1.06] object-cover opacity-0 transition-all duration-700 [transition-timing-function:var(--ease-out)] group-hover:scale-100 group-hover:opacity-100" />
              )}
            </>
          ) : (
            <span className="absolute inset-0 grid place-items-center text-sm text-muted">Image pending</span>
          )}
          {p.categories[0] && (
            <span className="absolute left-3 top-3 rounded-full bg-surface/85 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-gold-text backdrop-blur">
              {p.categories[0].name}
            </span>
          )}
        </Link>
        <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
          <h3 className="font-display text-[1.08rem] leading-snug">
            <Link href={`/products/${p.slug}`} className="link-draw">
              {p.name}
            </Link>
          </h3>
          {p.packSize && <p className="text-sm text-muted">{p.packSize}</p>}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
            <Price pricePaise={p.pricePaise} referencePaise={p.referencePaise} />
            <StockBadge availability={p.availability} quantity={p.availableQuantity} />
          </div>
          <AddToCart variantId={p.variantId} available={p.availability === "in_stock"} maxQuantity={p.availableQuantity} compact name={p.name} image={img?.src} />
        </div>
        <span className="sheen" aria-hidden="true" />
      </article>
    </Tilt>
  );
}
