import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/header";
import { Pending } from "@/components/sections";
import { apiOrNull, type Me } from "@/lib/api";

export const metadata: Metadata = { title: "Oryvia Pro", robots: { index: false } };

const NAV = [
  ["/partner", "Overview"],
  ["/partner/orders", "Orders"],
  ["/partner/stock", "Reorder / Stock"],
  ["/partner/quotes", "Quotes"],
  ["/partner/commissions", "Commissions"],
  ["/partner/settlements", "Settlements"],
  ["/partner/resources", "Resources"],
  ["/partner/training", "Training"],
  ["/partner/team", "Team"],
  ["/partner/settings", "Settings"],
];

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const me = await apiOrNull<Me>("/v1/account/me");
  if (!me) redirect("/login?next=/partner");
  const active = me.memberships.find((m) => m.accountStatus === "active");
  return (
    <div className="mx-auto grid max-w-[1400px] gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[248px_1fr]">
      <aside className="glass h-fit rounded-[18px] p-4 lg:sticky lg:top-28">
        <div className="mb-4 px-2"><Wordmark className="text-base" /> <span className="eyebrow ml-1">Pro</span></div>
        <nav aria-label="Partner workspace">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            {NAV.map(([href, label]) => (
              <li key={href}><Link href={href} className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-sunk">{label}</Link></li>
            ))}
          </ul>
        </nav>
      </aside>
      <div>
        {active ? (
          children
        ) : (
          <Pending title="No approved business account" actions={[{ href: "/partners/apply", label: "Apply as a partner" }]}>
            The partner workspace opens after Oryvia approves your business application. Partner access is checked on every request by the server.
          </Pending>
        )}
      </div>
    </div>
  );
}
