import type { Metadata } from "next";
import { Container, PageIntro } from "@/components/catalog-listing";

export const metadata: Metadata = { title: "Careers" };

export default function Careers() {
  return (
    <>
      <PageIntro eyebrow="Careers" title="Work with Oryvia" />
      <Container className="max-w-3xl">
        <div className="card p-8">
          <h2 className="mb-2 font-display text-2xl">No open positions right now</h2>
          <p className="text-muted">When Oryvia is hiring, roles will be listed here with a way to apply.</p>
        </div>
      </Container>
    </>
  );
}
