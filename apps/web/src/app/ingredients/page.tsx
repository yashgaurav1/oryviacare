import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageIntro } from "@/components/catalog-listing";
import { Pending } from "@/components/sections";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Ingredients", alternates: { canonical: "/ingredients" } };

type Ing = { slug: string; name: string; summary: string | null; products: Array<{ slug: string; name: string }> };

export default async function Ingredients() {
  const rows = await api<Ing[]>("/v1/catalog/ingredients");
  return (
    <>
      <PageIntro eyebrow="Ingredient library" title="What is in the range">
        Ingredients highlighted on Oryvia product pages, and the products that feature them. These are highlights, not complete formulations.
      </PageIntro>
      <Container>
        {rows.length === 0 ? (
          <Pending title="No ingredients mapped yet">Ingredients appear here once products featuring them are published.</Pending>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((i) => (
              <li key={i.slug} className="card lift p-6">
                <h2 className="font-display text-2xl"><Link href={`/ingredients/${i.slug}`}>{i.name}</Link></h2>
                {i.summary && <p className="mt-2 text-muted">{i.summary}</p>}
                <p className="mt-3 text-sm text-muted">Featured in {i.products.length} product{i.products.length === 1 ? "" : "s"}</p>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
