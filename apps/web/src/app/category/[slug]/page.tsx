import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogListing, Container, PageIntro } from "@/components/catalog-listing";
import { apiOrNull } from "@/lib/api";

type Cat = { slug: string; name: string; description: string | null; productCount: number };
const find = async (slug: string) => (await apiOrNull<Cat[]>("/v1/catalog/categories"))?.find((c) => c.slug === slug) ?? null;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await find((await params).slug);
  return c ? { title: c.name, alternates: { canonical: `/category/${c.slug}` } } : { title: "Category not found" };
}

export default async function Category({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug } = await params;
  const c = await find(slug);
  if (!c) notFound();
  return (
    <>
      <PageIntro eyebrow="Category" title={c.name}>{c.description}</PageIntro>
      <Container>
        <CatalogListing basePath={`/category/${slug}`} category={slug} search={await searchParams} />
      </Container>
    </>
  );
}
