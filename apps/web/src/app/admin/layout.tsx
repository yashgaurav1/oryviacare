import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/header";
import { Pending } from "@/components/sections";
import { apiOrNull, type Me } from "@/lib/api";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Oryvia Admin" }, robots: { index: false } };

// Only modules that exist are linked. Planned modules are listed in docs/FEATURE_MATRIX.md, not as dead links.
const GROUPS: Array<{ label: string; items: Array<[string, string, string]> }> = [
  { label: "Overview", items: [["/admin", "Overview", "orders.read"]] },
  { label: "Commerce", items: [["/admin/orders", "Orders", "orders.read"], ["/admin/products", "Products", "products.read"], ["/admin/packages", "Packages", "packages.review"]] },
  { label: "Operations", items: [["/admin/inventory", "Inventory", "inventory.read"], ["/admin/returns", "Returns", "orders.read"], ["/admin/refunds", "Refunds", "finance.refunds"]] },
  { label: "Relationships", items: [["/admin/enquiries", "Enquiries & quotes", "support.read"], ["/admin/applications", "Partner applications", "partners.applications.review"]] },
  { label: "Administration", items: [["/admin/migration", "Migration review", "migration.review"], ["/admin/settings", "Store settings", "settings.write"]] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await apiOrNull<Me>("/v1/account/me");
  if (!me) redirect("/login?next=/admin");
  // The API enforces every permission; this check only avoids rendering an empty shell.
  if (!me.isStaff)
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <Pending title="You do not have access to the admin workspace">This area is for Oryvia staff. If you need access, ask an owner to invite you.</Pending>
      </div>
    );
  const can = new Set(me.permissions);
  return (
    <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[248px_1fr]">
      <aside className="glass h-fit rounded-[18px] p-4 lg:sticky lg:top-28">
        <div className="mb-5 px-2"><Wordmark className="text-base" /> <span className="eyebrow ml-1">Admin</span></div>
        <nav aria-label="Admin">
          {GROUPS.map((g) => {
            const items = g.items.filter(([, , p]) => can.has(p));
            if (!items.length) return null;
            return (
              <div key={g.label} className="mb-4">
                <p className="mb-1 px-3 text-xs uppercase tracking-wider text-muted">{g.label}</p>
                <ul>
                  {items.map(([href, label]) => (
                    <li key={href}><Link href={href} className="block rounded-lg px-3 py-2 text-sm hover:bg-sunk">{label}</Link></li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
        {!me.twoFactorEnabled && <p className="mt-2 rounded-lg bg-warning-bg p-3 text-xs text-warning">Two-factor is off. <Link href="/account/settings" className="underline">Turn it on</Link> to approve prices and packages.</p>}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
