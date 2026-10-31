"use client";
// Small confirmation toasts. Anything can raise one with `toast({...})`; announced politely to screen readers.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export interface ToastInput {
  title: string;
  body?: string;
  image?: string | null;
  href?: string;
  linkLabel?: string;
}

export const toast = (t: ToastInput) => window.dispatchEvent(new CustomEvent<ToastInput>("oryvia:toast", { detail: t }));

export function Toaster() {
  const [items, setItems] = useState<Array<ToastInput & { id: number }>>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const id = ++n;
      setItems((xs) => [...xs.slice(-2), { ...(e as CustomEvent<ToastInput>).detail, id }]);
      window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4000);
    };
    window.addEventListener("oryvia:toast", on);
    return () => window.removeEventListener("oryvia:toast", on);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-24 z-[70] flex w-[min(360px,calc(100%-2rem))] flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className="toast glass pointer-events-auto flex items-center gap-3 rounded-[22px] p-3 shadow-[var(--shadow-lift)]">
          {t.image && (
            <span className="relative size-12 shrink-0 overflow-hidden rounded-2xl bg-cream">
              <Image src={t.image} alt="" fill sizes="48px" className="object-cover" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm font-bold">
              <span className="grid size-4 place-items-center rounded-full bg-success text-[0.6rem] text-white" aria-hidden="true">✓</span>
              {t.title}
            </span>
            {t.body && <span className="block truncate text-sm text-muted">{t.body}</span>}
          </span>
          {t.href && (
            <Link href={t.href} className="btn btn-primary h-9 min-h-0 shrink-0 px-4 text-sm">
              {t.linkLabel ?? "View"}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
