import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPaise } from "@oryvia/contracts";
import { Container, PageIntro } from "@/components/catalog-listing";
import { QuoteForm } from "@/components/forms";
import { apiOrNull } from "@/lib/api";
import type { Pkg } from "../page";

const load = (slug: string) => apiOrNull<Pkg>(`/v1/packages/${encodeURIComponent(slug)}`);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  return p ? { title: p.name, alternates: { canonical: `/packages/${p.slug}` } } : { title: "Package not found" };
}

export default async function PackagePage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await load((await params).slug);
  if (!p) notFound();
  return (
    <>
      <PageIntro eyebrow="Professional package" title={p.name}>
        {p.state === "approved" && p.pricePaise ? `${formatPaise(p.pricePaise)} · ${p.totalUnits} units` : p.notice}
      </PageIntro>
      <Container className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <section className="card p-6">
          <h2 className="mb-4 font-display text-2xl">Composition</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-divider text-muted">
                <th scope="col" className="py-2 font-normal">Product</th>
                <th scope="col" className="py-2 text-right font-normal">Paid</th>
                <th scope="col" className="py-2 text-right font-normal">Complimentary</th>
              </tr>
            </thead>
            <tbody>
              {p.components.map((c) => (
                <tr key={c.slug} className="border-b border-divider last:border-0">
                  <td className="py-2.5 pr-3"><Link href={`/products/${c.slug}`} className="hover:text-primary">{c.product}</Link></td>
                  <td className="tabular py-2.5 text-right">{c.paidQty ?? "-"}</td>
                  <td className="tabular py-2.5 text-right">{c.freeQty ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {p.state !== "approved" && <p className="mt-4 text-sm text-muted">Quantities are shown once Oryvia confirms the package. Earlier listings disagreed on price and quantities, so none are shown here.</p>}
        </section>
        <section className="card p-6 sm:p-8">
          <h2 className="mb-2 font-display text-2xl">Request a quote</h2>
          <p className="mb-6 text-muted">Oryvia will confirm current price, composition and delivery for your business.</p>
          <QuoteForm packageSlug={p.slug} />
        </section>
      </Container>
    </>
  );
}
