import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogListing, Container, PageIntro } from "@/components/catalog-listing";
import { api } from "@/lib/api";

type Ing = { slug: string; name: string; summary: string | null; cosmeticRole: string | null; editorialStatus: string; products: Array<{ slug: string; name: string; sourceNote: string | null }> };
const find = async (slug: string) => (await api<Ing[]>("/v1/catalog/ingredients")).find((i) => i.slug === slug) ?? null;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const i = await find((await params).slug);
  return i ? { title: `${i.name} — ingredient`, alternates: { canonical: `/ingredients/${i.slug}` } } : { title: "Ingredient not found" };
}

export default async function IngredientPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug } = await params;
  const i = await find(slug);
  if (!i) notFound();
  return (
    <>
      <PageIntro eyebrow="Ingredient" title={i.name}>
        {i.summary ?? "An explanation of this ingredient is being prepared and reviewed. Below are the Oryvia products that highlight it."}
      </PageIntro>
      <Container>
        {i.cosmeticRole && <p className="mb-6"><strong>Role in cosmetics:</strong> {i.cosmeticRole}</p>}
        <p className="mb-6 text-sm text-muted">
          Inclusion here means the ingredient is highlighted on the product page or named in the product title; it does not indicate concentration or effect of the finished product.{" "}
          <Link href="/contact" className="underline">Ask about ingredients</Link>
        </p>
        <CatalogListing basePath={`/ingredients/${slug}`} search={{ ...(await searchParams), ingredient: slug }} />
      </Container>
    </>
  );
}
