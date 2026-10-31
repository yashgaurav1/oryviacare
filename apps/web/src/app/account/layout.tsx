import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountNav } from "@/components/account-nav";
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
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <p className="mb-1 font-display text-3xl tracking-[-0.02em]">Hello, <em className="text-copper">{me.name.split(" ")[0]}</em></p>
        <p className="mb-6 truncate text-sm text-muted">{me.email}</p>
        <AccountNav
          items={[
            ...NAV.map(([href, label]) => ({ href, label })),
            ...(me.isStaff ? [{ href: "/admin", label: "Admin workspace", accent: true }] : []),
            ...(me.memberships.length > 0 ? [{ href: "/partner", label: "Partner workspace", accent: true }] : []),
          ]}
        />
      </aside>
      <div>{children}</div>
    </Container>
  );
}
