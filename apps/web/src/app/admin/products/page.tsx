import Link from "next/link";
import { formatPaise } from "@oryvia/contracts";
import { api } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { ReasonAction } from "../admin-actions";

type P = {
  id: string;
  slug: string;
  name: string;
  status: string;
  version: number;
  sourceIdentity: string | null;
  mediaCount: number;
  variant: { internalCode: string; sku: string | null; title: string | null } | null;
  price: { unitPaise: number; referencePaise: number | null; reviewState: string } | null;
};

export default async function AdminProducts() {
  const rows = await api<P[]>("/v1/admin/products");
  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl">Products</h1>
      <p className="max-w-3xl text-sm text-muted">
        Imported products start as <em>needs review</em>. Publishing approves the content and the current retail price together and is recorded with your reason. Strike-through
        &ldquo;original prices&rdquo; stay hidden on the storefront until classified, because packaging photos show a lower printed MRP (see Migration review).
      </p>
      <ul className="space-y-3">
        {rows.map((p) => (
          <li key={p.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted">
                  {p.variant?.internalCode} {p.variant?.sku ? `· SKU ${p.variant.sku}` : "· no published SKU"} · {p.mediaCount} images · {p.sourceIdentity ?? "created here"}
                </p>
                <p className="mt-1 text-sm">
                  <span className={`rounded px-2 py-0.5 text-xs ${p.status === "published" ? "bg-success-bg text-success" : "bg-warning-bg text-warning"}`}>{titleCase(p.status)}</span>{" "}
                  {p.price ? <span className="tabular">{formatPaise(p.price.unitPaise)} · price {titleCase(p.price.reviewState)}</span> : "No price"}
                  {p.price?.referencePaise ? <span className="tabular text-muted"> · observed reference {formatPaise(p.price.referencePaise)} (unverified)</span> : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.status === "published" && <Link href={`/products/${p.slug}`} className="btn btn-ghost">View</Link>}
                {p.status !== "published" ? (
                  <ReasonAction label="Publish" path={`/v1/admin/products/${p.id}/publish`} body={{ version: p.version }} confirm="Publishes the product and approves its current retail price." />
                ) : (
                  <ReasonAction label="Unpublish" tone="secondary" path={`/v1/admin/products/${p.id}/unpublish`} body={{ version: p.version }} />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
