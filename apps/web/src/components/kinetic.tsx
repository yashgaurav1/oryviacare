// Server-safe typographic motion helpers (pure markup + CSS from globals.css).
import Link from "next/link";
import { Fragment, type CSSProperties, type ReactNode } from "react";

/** Splits a line into words that blur-rise in sequence. The text stays real (one copy) for search and screen readers. */
export function Kinetic({ text, base = 0, className = "", wordClass = "" }: { text: string; base?: number; className?: string; wordClass?: string }) {
  const words = text.split(" ");
  return (
    <span className={`kinetic ${className}`} style={{ "--base": `${base}ms` } as CSSProperties}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span>
            <span className={`w ${wordClass}`} style={{ "--i": i } as CSSProperties}>
              {w}
            </span>
          </span>
          {i < words.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </span>
  );
}

/** Infinite ticker. The second copy is decorative (aria-hidden, not focusable). */
export function Marquee({ items, speed = 40, className = "" }: { items: Array<{ label: string; href?: string }>; speed?: number; className?: string }) {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((it, i) => (
        <li key={i} className="flex items-center">
          {it.href && !hidden ? (
            <Link href={it.href} className="px-6 transition-colors hover:text-kesar-light">{it.label}</Link>
          ) : (
            <span className="px-6">{it.label}</span>
          )}
          <span className="text-kesar" aria-hidden="true">✦</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className={`marquee-wrap marquee-mask overflow-hidden ${className}`}>
      <div className="marquee" style={{ "--speed": `${speed}s` } as CSSProperties}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

/** Section heading with eyebrow; the gold rule draws in as it scrolls into view. */
export function SectionHead({ eyebrow, title, children, action, night = false }: { eyebrow: string; title: ReactNode; children?: ReactNode; action?: ReactNode; night?: boolean }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-2xl">
        <p className="eyebrow mb-3 flex items-center gap-3">
          <span className="draw-on-scroll inline-block h-px w-10 bg-kesar" aria-hidden="true" />
          {eyebrow}
        </p>
        <h2 className={`font-display text-4xl leading-[1.05] sm:text-5xl ${night ? "text-on-night" : ""}`}>{title}</h2>
        {children && <p className={`mt-4 text-lg ${night ? "text-on-night-muted" : "text-muted"}`}>{children}</p>}
      </div>
      {action}
    </div>
  );
}
