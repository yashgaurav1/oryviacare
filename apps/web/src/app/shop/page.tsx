import type { Metadata } from "next";
import { CatalogListing, Container, PageIntro } from "@/components/catalog-listing";

export const metadata: Metadata = { title: "Shop all products", alternates: { canonical: "/shop" } };

export default async function Shop({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const search = await searchParams;
  return (
    <>
      <PageIntro eyebrow="Shop" title="All products">Skincare and hair care from the Oryvia range.</PageIntro>
      <Container>
        <CatalogListing basePath="/shop" search={search} />
      </Container>
    </>
  );
}
