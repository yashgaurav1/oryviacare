import { formatPaise } from "@oryvia/contracts";
import { api } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { ApproveForm } from "./approve-form";

type Obs = { value: unknown; source_location: string; method: string };
type Version = {
  id: string;
  version: number;
  approvalState: string;
  pricePaise: number | null;
  observations: { selling_price_paise?: Obs[]; reference_value_paise?: Obs[]; total_units?: Obs[]; free_products_text?: Obs | null };
  conflicts: string[];
  components: Array<{ variantId: string; observedQty: number | null; paidQty: number; freeQty: number; variant: { product: { name: string } } }>;
};
type Pkg = { id: string; slug: string; name: string; status: string; versions: Version[] };

const money = (v: unknown) => (typeof v === "number" ? formatPaise(v) : "—");

export default async function AdminPackages() {
  const pkgs = await api<Pkg[]>("/v1/admin/packages");
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Packages</h1>
      <p className="max-w-3xl text-sm text-muted">Every observation from the old site is kept with its source location. A package cannot be sold until a version is approved with an explicit price and paid/complimentary split (two-factor required).</p>
      {pkgs.map((p) => (
        <section key={p.id} className="card space-y-4 p-6">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl">{p.name}</h2>
            <span className="rounded bg-sunk px-2 py-1 text-xs">{titleCase(p.status)}</span>
          </header>
          {p.versions.map((v) => (
            <div key={v.id} className="space-y-4 rounded-xl ring-1 ring-divider p-4">
              <p className="font-medium">Version {v.version} · {titleCase(v.approvalState)} {v.pricePaise ? `· ${formatPaise(v.pricePaise)}` : ""}</p>
              {v.conflicts.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-error">{v.conflicts.map((c) => <li key={c}>{c}</li>)}</ul>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <table className="text-sm">
                  <caption className="mb-1 text-left font-medium">Selling price observations</caption>
                  <tbody>{(v.observations.selling_price_paise ?? []).map((o, i) => <tr key={i}><td className="tabular pr-3">{money(o.value)}</td><td className="text-muted">{o.method} · {o.source_location}</td></tr>)}</tbody>
                </table>
                <table className="text-sm">
                  <caption className="mb-1 text-left font-medium">Reference value observations</caption>
                  <tbody>{(v.observations.reference_value_paise ?? []).map((o, i) => <tr key={i}><td className="tabular pr-3">{money(o.value)}</td><td className="text-muted">{o.method} · {o.source_location}</td></tr>)}</tbody>
                </table>
              </div>
              {v.observations.free_products_text && <p className="text-sm"><span className="text-muted">Narrative:</span> {String(v.observations.free_products_text.value)}</p>}
              {v.approvalState === "needs_review" ? (
                <details>
                  <summary className="cursor-pointer text-teal">Approve with merchant-confirmed values…</summary>
                  <div className="mt-4">
                    <ApproveForm versionId={v.id} components={v.components.map((c) => ({ variantId: c.variantId, name: c.variant.product.name, observedQty: c.observedQty }))} />
                  </div>
                </details>
              ) : (
                <ul className="text-sm">{v.components.map((c) => <li key={c.variantId}>{c.variant.product.name}: {c.paidQty} paid + {c.freeQty} complimentary</li>)}</ul>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
