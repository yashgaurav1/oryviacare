"use client";
// Scroll-driven product story: the section pins, and scrolling turns a 3D carousel of real product photos
// while the copy beside it changes to the product in front. Narrow screens, touch and reduced motion get a plain list.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatPaise } from "@oryvia/contracts";

export interface StoryItem {
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  ingredients: Array<{ slug: string; name: string }>;
  pricePaise: number | null;
  image: { src: string; alt: string };
}

export function StickyStory({ items }: { items: StoryItem[] }) {
  const outer = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState(0); // continuous 0…n-1
  const n = items.length;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const sync = () => setPinned(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const o = outer.current;
    if (!o || !pinned) return;
    // Updated straight from the scroll event; React batches the state change into the next render.
    const on = () => {
      const r = o.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
      setPos(p * (n - 1));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [pinned, n]);

  if (!pinned)
    return (
      <ol className="grid gap-4 sm:grid-cols-2">
        {items.map((it, i) => (
          <li key={it.slug} className="overflow-hidden rounded-[28px] bg-surface shadow-[var(--shadow-ambient)] ring-1 ring-divider">
            <Link href={`/products/${it.slug}`} className="relative block aspect-[4/3] bg-cream">
              <Image src={it.image.src} alt={it.image.alt} fill sizes="(min-width: 640px) 45vw, 92vw" className="object-cover" />
            </Link>
            <div className="p-5">
              <p className="eyebrow">{String(i + 1).padStart(2, "0")} · {it.category}</p>
              <h3 className="mt-2 font-display text-2xl leading-tight"><Link href={`/products/${it.slug}`}>{it.name}</Link></h3>
              {it.description && <p className="mt-2 line-clamp-3 text-sm text-muted">{it.description}</p>}
            </div>
          </li>
        ))}
      </ol>
    );

  const active = Math.round(pos);
  const it = items[active];
  return (
    <div ref={outer} style={{ height: `${100 + n * 70}vh` }} className="relative">
      <div className="sticky top-0 grid h-screen grid-cols-[1fr_1.1fr] items-center gap-10 overflow-hidden">
        <div className="relative">
          <p className="tabular font-display text-[9rem] leading-none text-ink/[0.06]" aria-hidden="true">{String(active + 1).padStart(2, "0")}</p>
          <div key={active} className="story-copy -mt-16">
            <p className="eyebrow">{it.category}</p>
            <h3 className="mt-3 max-w-lg font-display text-4xl leading-[1.05] tracking-[-0.02em] xl:text-5xl" style={{ animationDelay: "60ms" }}>{it.name}</h3>
            {it.description && <p className="mt-5 max-w-md text-lg leading-relaxed text-muted line-clamp-4" style={{ animationDelay: "120ms" }}>{it.description}</p>}
            {it.ingredients.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2" style={{ animationDelay: "180ms" }}>
                {it.ingredients.map((g) => (
                  <li key={g.slug}><Link href={`/ingredients/${g.slug}`} className="inline-block rounded-full border border-kesar/60 bg-surface px-3.5 py-1 text-sm transition-colors hover:border-ink">{g.name}</Link></li>
                ))}
              </ul>
            )}
            <div className="mt-8 flex items-center gap-5" style={{ animationDelay: "240ms" }}>
              {it.pricePaise !== null && <span className="tabular font-display text-3xl">{formatPaise(it.pricePaise)}</span>}
              <Link href={`/products/${it.slug}`} className="btn btn-primary">View product <span aria-hidden="true">→</span></Link>
            </div>
          </div>
          <ol className="mt-10 flex gap-2" aria-label="Products in this story">
            {items.map((x, i) => (
              <li key={x.slug} className="h-1 flex-1 overflow-hidden rounded-full bg-divider">
                <span className="block h-full origin-left rounded-full bg-ink transition-transform duration-300" style={{ transform: `scaleX(${Math.min(1, Math.max(0, pos - i + 1))})` }} />
                <span className="sr-only">{x.name}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative h-[72vh] [perspective:1600px]" aria-hidden="true">
          <div className="absolute inset-[12%] rounded-full bg-gradient-to-br from-blush via-cream to-sage blur-2xl" />
          {items.map((x, i) => {
            const d = i - pos;
            const ad = Math.abs(d);
            return (
              <div
                key={x.slug}
                className="absolute left-1/2 top-1/2 aspect-[4/5] w-[58%] overflow-hidden rounded-[32px] bg-surface shadow-[0_50px_100px_-40px_rgb(26_20_17/0.55)] ring-1 ring-ink/5"
                style={
                  {
                    transform: `translate(-50%,-50%) translateX(${d * 62}%) translateZ(${-ad * 260}px) rotateY(${d * -38}deg)`,
                    opacity: Math.max(0, 1 - ad * 0.45),
                    zIndex: 100 - Math.round(ad * 10),
                    filter: `blur(${Math.min(6, ad * 2.5)}px)`,
                  } as CSSProperties
                }
              >
                <Image src={x.image.src} alt="" fill sizes="35vw" className="object-cover" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
