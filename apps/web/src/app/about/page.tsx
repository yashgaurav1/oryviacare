import type { Metadata } from "next";
import { Container, PageIntro } from "@/components/catalog-listing";
import { Pending, Sections, type Section } from "@/components/sections";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "About Oryvia", alternates: { canonical: "/about" } };

export default async function About() {
  const page = await api<{ state: string; body: { sections: Section[] } | null }>("/v1/content/pages/about");
  return (
    <>
      <PageIntro eyebrow="About" title="About Oryvia">Skincare and hair care marketed from Rampur, Uttar Pradesh.</PageIntro>
      <Container className="max-w-3xl">
        {page.state === "published" && page.body ? (
          <Sections sections={page.body.sections} />
        ) : (
          <Pending title="Our story is being updated" actions={[{ href: "/shop", label: "Browse products" }, { href: "/contact", label: "Contact us" }]}>
            The brand story on the previous site still contains unfinished placeholder text, so it is being reviewed before it appears here.
          </Pending>
        )}
      </Container>
    </>
  );
}
