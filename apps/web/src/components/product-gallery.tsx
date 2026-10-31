"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { formatPaise } from "@oryvia/contracts";
import { AddToCart } from "./commerce";

type Img = { src: string; alt: string };

/** Main image with crossfading thumbnails and a cursor-following zoom on fine pointers. */
export function ProductGallery({ images, tint }: { images: Img[]; tint: string }) {
  const [active, setActive] = useState(0);
  const lens = useRef<HTMLDivElement>(null);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = lens.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    el.dataset.zoom = "true";
    el.style.setProperty("--ox", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--oy", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  if (!images.length) return <div className={`grid aspect-square place-items-center rounded-[28px] ${tint} text-muted`}>Image pending</div>;
  return (
    <div className="rise space-y-3">
      <div
        ref={lens}
        className={`zoom-lens relative aspect-square cursor-zoom-in overflow-hidden rounded-[28px] ${tint}`}
        onPointerMove={move}
        onPointerLeave={() => lens.current && (lens.current.dataset.zoom = "false")}
      >
        {images.map((img, i) => (
          <Image
            key={img.src}
            src={img.src}
            alt={i === active ? img.alt : ""}
            aria-hidden={i !== active}
            fill
            priority={i === 0}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover transition-opacity duration-700"
            style={{ opacity: i === active ? 1 : 0, transformOrigin: "var(--ox, 50%) var(--oy, 50%)" }}
          />
        ))}
      </div>
      {images.length > 1 && (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5" aria-label="Choose image">
          {images.map((img, i) => (
            <li key={img.src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-pressed={i === active}
                className={`relative block aspect-square w-full overflow-hidden rounded-2xl ${tint} transition-all duration-300 ${
                  i === active ? "ring-2 ring-ink ring-offset-2 ring-offset-canvas" : "opacity-70 hover:opacity-100"
                }`}
              >
                <Image src={img.src} alt="" fill sizes="120px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Slides up from the bottom once the main buy box has scrolled out of view. */
export function StickyBuyBar({
  targetId,
  name,
  image,
  pricePaise,
  variantId,
  available,
  maxQuantity,
}: {
  targetId: string;
  name: string;
  image: Img | null;
  pricePaise: number | null;
  variantId: string | null;
  available: boolean;
  maxQuantity: number;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = document.getElementById(targetId);
    if (!t) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(t);
    return () => io.disconnect();
  }, [targetId]);
  return (
    <div className="buy-bar fixed inset-x-3 bottom-3 z-40 sm:inset-x-auto sm:left-1/2 sm:w-[min(760px,calc(100%-2rem))] sm:-translate-x-1/2" data-show={show} aria-hidden={!show} inert={!show}>
      <div className="glass flex items-center gap-3 rounded-full p-2 pl-2 shadow-[var(--shadow-lift)] sm:gap-4">
        {image && (
          <span className="relative size-11 shrink-0 overflow-hidden rounded-full bg-cream">
            <Image src={image.src} alt="" fill sizes="44px" className="object-cover" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{name}</span>
          {pricePaise !== null && <span className="tabular block font-display text-base">{formatPaise(pricePaise)}</span>}
        </span>
        <span className="w-36 shrink-0 sm:w-44">
          <AddToCart variantId={variantId} available={available} maxQuantity={maxQuantity} compact name={name} image={image?.src} />
        </span>
      </div>
    </div>
  );
}
