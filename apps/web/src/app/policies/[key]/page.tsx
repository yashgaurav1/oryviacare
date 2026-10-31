import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container, PageIntro } from "@/components/catalog-listing";
import { Pending, Sections, type Section } from "@/components/sections";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

const TITLES: Record<string, string> = { privacy: "Privacy policy", terms: "Terms & conditions", shipping: "Shipping policy", returns: "Returns & refunds" };

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  return { title: TITLES[key] ?? "Policy", alternates: { canonical: `/policies/${key}` } };
}

export default async function Policy({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!TITLES[key]) notFound();
  const p = await api<{ state: string; body: Section[] | null; version: number | null; publishedAt: string | null }>(`/v1/content/policies/${key}`);
  return (
    <>
      <PageIntro eyebrow="Policy" title={TITLES[key]}>
        {p.state === "published" && p.publishedAt ? `Version ${p.version}, published ${formatDate(p.publishedAt)}.` : null}
      </PageIntro>
      <Container className="max-w-3xl">
        {p.state === "published" && p.body ? (
          <Sections sections={p.body} />
        ) : (
          <Pending title={p.state === "pending_approval" ? "This policy is awaiting approval" : "This policy has not been published yet"} actions={[{ href: "/contact", label: "Ask us a question" }]}>
            {p.state === "pending_approval"
              ? "The policy text from the previous website is being reviewed by Oryvia before it is published here. Until then, contact us for the terms that apply to your order."
              : "Oryvia has not yet published this policy. Contact us for the terms that apply to your order."}
          </Pending>
        )}
      </Container>
    </>
  );
}
