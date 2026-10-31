import type { Metadata } from "next";
import Link from "next/link";
import { formatPaise } from "@oryvia/contracts";
import { Container, PageIntro } from "@/components/catalog-listing";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Professional packages", alternates: { canonical: "/packages" } };

export type Pkg = {
  slug: string;
  name: string;
  state: "approved" | "under_review";
  pricePaise: number | null;
  totalUnits: number | null;
  components: Array<{ product: string; slug: string; paidQty: number | null; freeQty: number | null }>;
  notice: string | null;
};

export default async function Packages() {
  const pkgs = await api<Pkg[]>("/v1/packages");
  return (
    <>
      <PageIntro eyebrow="For salons & retailers" title="Professional packages">
        Multi-product assortments for salons and resellers. Price and exact composition are confirmed by Oryvia before any package is sold.
      </PageIntro>
      <Container>
        <ul className="grid gap-5 md:grid-cols-2">
          {pkgs.map((p) => (
            <li key={p.slug} className="card flex flex-col p-6 sm:p-8">
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 className="font-display text-2xl leading-snug">{p.name}</h2>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${p.state === "approved" ? "bg-success-bg text-success" : "bg-warning-bg text-warning"}`}>
                  {p.state === "approved" ? "Confirmed" : "Being confirmed"}
                </span>
              </div>
              {p.state === "approved" && p.pricePaise ? (
                <p className="tabular mb-4 text-2xl">{formatPaise(p.pricePaise)} <span className="text-sm text-muted">· {p.totalUnits} units</span></p>
              ) : (
                <p className="mb-4 text-muted">{p.notice}</p>
              )}
              <p className="mb-2 text-sm font-medium">Includes products from</p>
              <ul className="mb-6 space-y-1 text-sm">
                {p.components.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/products/${c.slug}`} className="hover:text-primary">{c.product}</Link>
                    {c.paidQty !== null && <span className="tabular text-muted"> · {c.paidQty} paid{c.freeQty ? ` + ${c.freeQty} complimentary` : ""}</span>}
                  </li>
                ))}
              </ul>
              <Link href={`/packages/${p.slug}`} className="btn btn-primary mt-auto">{p.state === "approved" ? "View details" : "Request a quote"}</Link>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
