import type { Metadata } from "next";
import { CatalogListing, Container, PageIntro } from "@/components/catalog-listing";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default async function Search({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const search = await searchParams;
  return (
    <>
      <PageIntro eyebrow="Search" title={search.q ? `Results for “${search.q}”` : "Search products"} />
      <Container>
        <CatalogListing basePath="/search" search={search} />
      </Container>
    </>
  );
}
