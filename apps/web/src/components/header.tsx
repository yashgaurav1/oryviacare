"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/category/skin-care", label: "Skin Care" },
  { href: "/category/hair-care", label: "Hair Care" },
  { href: "/ingredients", label: "Ingredients" },
  { href: "/business", label: "For Business" },
  { href: "/journal", label: "Journal" },
];

export function Wordmark({ className = "" }: { className?: string }) {
  // The source site publishes a text wordmark (no image logo is configured). We keep it typographic.
  return (
    <span className={`font-display tracking-[0.28em] text-[1.35rem] leading-none ${className}`} aria-label="Oryvia">
      ORYVIA
    </span>
  );
}

function Icon({ d, label }: { d: string; label: string }) {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <title>{label}</title>
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35",
  bag: "M6 7h12l1 13H5L6 7Zm3 0a3 3 0 0 1 6 0",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
};

export function Header({ cartCount: initialCount, signedIn }: { cartCount: number; signedIn: boolean }) {
  const [count, setCount] = useState(initialCount);
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setCount(initialCount), [initialCount]);
  useEffect(() => {
    const on = (e: Event) => setCount((e as CustomEvent<{ count: number }>).detail.count);
    window.addEventListener("oryvia:cart", on);
    return () => window.removeEventListener("oryvia:cart", on);
  }, []);
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement))) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn btn-primary">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <div className="glass mx-auto flex h-16 max-w-[1400px] items-center gap-2 rounded-[18px] px-3 sm:px-5">
          <button className="btn btn-ghost lg:hidden -ml-1" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>
            <Icon d={ICONS.menu} label="Menu" />
          </button>
          <Link href="/" className="mr-4 text-ink">
            <Wordmark />
          </Link>
          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className={`rounded-lg px-3 py-2 text-[0.95rem] hover:bg-sunk ${pathname.startsWith(n.href) ? "text-primary font-medium" : "text-ink"}`}
                    aria-current={pathname.startsWith(n.href) ? "page" : undefined}
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <button className="btn btn-ghost" aria-label="Search products (press /)" onClick={() => setSearchOpen(true)}>
              <Icon d={ICONS.search} label="Search" />
            </button>
            <Link href={signedIn ? "/account" : "/login"} className="btn btn-ghost" aria-label={signedIn ? "Your account" : "Sign in"}>
              <Icon d={ICONS.user} label="Account" />
            </Link>
            <Link href="/cart" className="btn btn-ghost relative" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
              <Icon d={ICONS.bag} label="Cart" />
              {count > 0 && (
                <span className="tabular absolute -top-0.5 right-0.5 min-w-5 rounded-full bg-primary px-1.5 text-center text-[0.7rem] leading-5 text-white">{count}</span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-ink/30" aria-label="Close menu" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-sm bg-surface p-5 shadow-2xl rise">
            <div className="mb-6 flex items-center justify-between">
              <Wordmark />
              <button className="btn btn-ghost" aria-label="Close menu" onClick={() => setDrawer(false)} autoFocus>
                <Icon d={ICONS.close} label="Close" />
              </button>
            </div>
            <ul className="space-y-1">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="block rounded-xl px-3 py-3 text-lg hover:bg-sunk">
                    {n.label}
                  </Link>
                </li>
              ))}
              <li className="border-t border-divider pt-3 mt-3">
                <Link href="/track-order" className="block rounded-xl px-3 py-3 hover:bg-sunk">Track an order</Link>
              </li>
              <li>
                <Link href="/contact" className="block rounded-xl px-3 py-3 hover:bg-sunk">Contact</Link>
              </li>
            </ul>
          </div>
        </div>
      )}
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </>
  );
}

interface Suggestion {
  slug: string;
  name: string;
  pricePaise: number | null;
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    const ctl = new AbortController();
    setState("loading");
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/v1/catalog/products?q=${encodeURIComponent(q.trim())}&pageSize=6`, { signal: ctl.signal });
        const d = await r.json();
        setItems(d.items ?? []);
        setActive(0);
        setState("idle");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState("error");
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search products">
      <button className="absolute inset-0 bg-ink/30" aria-label="Close search" onClick={onClose} />
      <div className="relative mx-auto mt-[10vh] w-[min(640px,calc(100%-2rem))] card overflow-hidden rise">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (items[active]) go(`/products/${items[active].slug}`);
            else if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <label htmlFor="site-search" className="sr-only">Search products</label>
          <input
            id="site-search"
            ref={inputRef}
            className="w-full border-b border-divider px-5 py-4 text-lg outline-none"
            placeholder="Search face wash, shampoo, facial kit…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls="search-results"
            aria-activedescendant={items[active] ? `sr-${items[active].slug}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              }
            }}
          />
        </form>
        <ul id="search-results" role="listbox" className="max-h-[50vh] overflow-auto p-2">
          {state === "error" && <li className="p-4 text-error">Search failed. Try again.</li>}
          {q.trim().length >= 2 && state === "idle" && items.length === 0 && (
            <li className="p-4 text-muted">No products match “{q}”. Try “face”, “shampoo” or “facial kit”.</li>
          )}
          {items.map((it, i) => (
            <li key={it.slug} id={`sr-${it.slug}`} role="option" aria-selected={i === active}>
              <button onClick={() => go(`/products/${it.slug}`)} className={`w-full rounded-xl px-4 py-3 text-left ${i === active ? "bg-sunk" : ""}`} onMouseEnter={() => setActive(i)}>
                {it.name}
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-divider px-5 py-2 text-xs text-muted">↑ ↓ to move · Enter to open · Esc to close</p>
      </div>
    </div>
  );
}
