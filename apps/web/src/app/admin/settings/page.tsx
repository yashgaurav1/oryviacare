import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { ShippingForm } from "./shipping-form";

type Setting = { key: string; value: unknown; verified: boolean; version: number; updatedAt: string };

export default async function Settings() {
  const rows = await api<Setting[]>("/v1/admin/settings");
  const ship = rows.find((r) => r.key === "shipping.rule");
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Store settings</h1>
      <section className="card p-6">
        <h2 className="mb-1 font-display text-xl">Delivery rule</h2>
        <p className="mb-4 text-sm text-muted">Checkout is blocked until a rule exists. Rules are versioned; saving over someone else&rsquo;s change is refused.</p>
        <ShippingForm rule={(ship?.value as Parameters<typeof ShippingForm>[0]["rule"]) ?? null} version={ship?.version ?? 0} />
      </section>
      <section className="card p-6">
        <h2 className="mb-4 font-display text-xl">All settings</h2>
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap justify-between gap-2 border-b border-divider pb-2">
              <span className="font-medium">{r.key}</span>
              <span className={r.verified ? "text-success" : "text-warning"}>{r.verified ? "Verified" : "Unverified: not shown publicly"}</span>
              <span className="text-muted">v{r.version} · {formatDateTime(r.updatedAt)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">Contact details observed on the old site are stored as unverified. Verifying them (and editing tax, seller and policy settings) is not built in this screen yet.</p>
      </section>
    </div>
  );
}
