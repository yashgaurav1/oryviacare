import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageIntro } from "@/components/catalog-listing";

export const metadata: Metadata = { title: "For business", alternates: { canonical: "/business" } };

export default function Business() {
  return (
    <>
      <PageIntro eyebrow="Oryvia Pro" title="For salons, retailers and distributors">
        Order the Oryvia range for your business through one account, with orders, quotes and documents in one place.
      </PageIntro>
      <Container className="space-y-10">
        <ol className="grid gap-4 md:grid-cols-4">
          {[
            ["1", "Create an account", "Register with your work email."],
            ["2", "Apply", "Tell us about your business and the programme you are interested in."],
            ["3", "Review", "Oryvia reviews your application and may ask for more information."],
            ["4", "Order", "Once approved, your business workspace opens for orders and quotes."],
          ].map(([n, t, d]) => (
            <li key={n} className="card p-6">
              <span className="tabular font-display text-3xl text-gold">{n}</span>
              <h2 className="mt-2 font-medium">{t}</h2>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
        <div className="card grid gap-6 p-8 md:grid-cols-2">
          <div>
            <h2 className="mb-2 font-display text-2xl">Programme terms</h2>
            <p className="text-muted">
              Partner pricing, minimum orders, credit and any commission are set by Oryvia per programme and shared with approved partners. Nothing on this page is an offer of territory, margin or earnings.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-3 md:justify-end">
            <Link href="/partners/apply" className="btn btn-primary">Apply as a partner</Link>
            <Link href="/packages" className="btn btn-secondary">Compare packages</Link>
            <Link href="/contact" className="btn btn-ghost">Ask a question</Link>
          </div>
        </div>
      </Container>
    </>
  );
}
