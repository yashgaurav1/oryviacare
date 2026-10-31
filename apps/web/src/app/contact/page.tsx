import type { Metadata } from "next";
import { Container, PageIntro } from "@/components/catalog-listing";
import { ContactForm } from "@/components/forms";
import { apiOrNull } from "@/lib/api";

export const metadata: Metadata = { title: "Contact us", alternates: { canonical: "/contact" } };

export default async function Contact() {
  const s = await apiOrNull<{ contact: { phone?: string; email?: string; whatsapp?: string; hours?: string } | null }>("/v1/content/settings/public");
  const c = s?.contact;
  return (
    <>
      <PageIntro eyebrow="Contact" title="We would love to hear from you">Questions about a product, an order or a salon package. Every message gets a reference number.</PageIntro>
      <Container className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-6 sm:p-8">
          <ContactForm />
        </div>
        <aside className="glass h-fit rounded-[18px] p-6">
          <h2 className="mb-4 font-display text-2xl">Other ways to reach us</h2>
          {c ? (
            <ul className="space-y-3">
              {c.phone && <li>Call <a className="underline" href={`tel:${c.phone}`}>{c.phone}</a></li>}
              {c.whatsapp && (
                <li>
                  <a className="underline" href={`https://wa.me/${c.whatsapp}`} rel="noopener">Chat on WhatsApp</a>
                  <span className="block text-xs text-muted">Opens WhatsApp. Messages are not stored on this website.</span>
                </li>
              )}
              {c.email && <li>Email <a className="underline" href={`mailto:${c.email}`}>{c.email}</a></li>}
              {c.hours && <li className="text-muted">{c.hours}</li>}
            </ul>
          ) : (
            <p className="text-muted">Phone, email and WhatsApp details will be listed once Oryvia confirms them. Please use the form for now.</p>
          )}
        </aside>
      </Container>
    </>
  );
}
