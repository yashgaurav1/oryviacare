import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageIntro } from "@/components/catalog-listing";
import { Pending } from "@/components/sections";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Journal", alternates: { canonical: "/journal" } };

export default async function Journal() {
  const articles = await api<Array<{ slug: string; title: string; excerpt: string | null; publishedAt: string }>>("/v1/content/articles");
  return (
    <>
      <PageIntro eyebrow="Journal" title="Skincare and hair care notes">Practical routines and habits from the Oryvia team.</PageIntro>
      <Container>
        {articles.length === 0 ? (
          <Pending title="Articles are being reviewed">Articles from the previous site are being checked before they are republished here.</Pending>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <li key={a.slug} className="card lift p-6">
                <p className="text-sm text-muted">{formatDate(a.publishedAt)}</p>
                <h2 className="mt-2 font-display text-xl leading-snug">
                  <Link href={`/journal/${a.slug}`}>{a.title}</Link>
                </h2>
                {a.excerpt && <p className="mt-3 line-clamp-3 text-muted">{a.excerpt}</p>}
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
