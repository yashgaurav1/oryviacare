import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/catalog-listing";
import { Sections, type Section } from "@/components/sections";
import { apiOrNull } from "@/lib/api";
import { formatDate } from "@/lib/format";

type A = { slug: string; title: string; excerpt: string | null; body: Section[]; publishedAt: string; seo: { title: string | null; description: string | null } };
const load = (slug: string) => apiOrNull<A>(`/v1/content/articles/${encodeURIComponent(slug)}`);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = await load((await params).slug);
  return a ? { title: a.seo.title ?? a.title, description: a.seo.description ?? undefined, alternates: { canonical: `/journal/${a.slug}` } } : { title: "Article not found" };
}

export default async function Article({ params }: { params: Promise<{ slug: string }> }) {
  const a = await load((await params).slug);
  if (!a) notFound();
  return (
    <Container className="max-w-3xl py-12">
      <Link href="/journal" className="text-sm text-teal">← Journal</Link>
      <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">{a.title}</h1>
      <p className="mt-3 text-muted">{formatDate(a.publishedAt)}</p>
      <article className="mt-10">
        <Sections sections={a.body} />
      </article>
    </Container>
  );
}
