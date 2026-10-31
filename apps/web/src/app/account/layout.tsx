import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/catalog-listing";
import { apiOrNull, type Me } from "@/lib/api";

export const metadata: Metadata = { robots: { index: false } };

const NAV = [
  ["/account", "Overview"],
  ["/account/orders", "Orders"],
  ["/account/wishlist", "Wishlist"],
  ["/account/addresses", "Addresses"],
  ["/account/rewards", "Rewards"],
  ["/account/subscriptions", "Subscriptions"],
  ["/account/settings", "Settings & security"],
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const me = await apiOrNull<Me>("/v1/account/me");
  if (!me) redirect("/login?next=/account");
  return (
    <Container className="grid gap-8 py-10 lg:grid-cols-[220px_1fr]">
      <aside>
        <p className="mb-1 font-display text-2xl">Hello, {me.name.split(" ")[0]}</p>
        <p className="mb-6 truncate text-sm text-muted">{me.email}</p>
        <nav aria-label="Account">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map(([href, label]) => (
              <li key={href}><Link href={href} className="block whitespace-nowrap rounded-lg px-3 py-2 hover:bg-sunk">{label}</Link></li>
            ))}
            {me.isStaff && <li><Link href="/admin" className="block whitespace-nowrap rounded-lg px-3 py-2 text-teal hover:bg-sunk">Admin workspace</Link></li>}
            {me.memberships.length > 0 && <li><Link href="/partner" className="block whitespace-nowrap rounded-lg px-3 py-2 text-teal hover:bg-sunk">Partner workspace</Link></li>}
          </ul>
        </nav>
      </aside>
      <div>{children}</div>
    </Container>
  );
}
