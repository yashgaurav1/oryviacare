"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Account section navigation with an active pill; the page you are on is marked with aria-current. */
export function AccountNav({ items }: { items: Array<{ href: string; label: string; accent?: boolean }> }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/account" ? pathname === href : pathname.startsWith(href));
  return (
    <nav aria-label="Account">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:pb-0">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={isActive(it.href) ? "page" : undefined}
              className={`block whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                isActive(it.href) ? "bg-ink text-on-primary shadow-[var(--shadow-ambient)]" : it.accent ? "text-copper hover:bg-sunk" : "hover:bg-sunk"
              }`}
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
