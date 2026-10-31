import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageIntro } from "@/components/catalog-listing";

export const metadata: Metadata = { title: "FAQ", alternates: { canonical: "/faq" } };

// Answers describe only what the platform actually does. Delivery times, return windows and payment methods
// are merchant decisions not yet confirmed, so those answers point to the policy pages instead of inventing terms.
const FAQ = [
  {
    q: "How do I track my order?",
    a: (
      <>
        Use the private tracking link shown after checkout, or sign in and open <Link href="/account/orders" className="underline">your orders</Link>. Orders cannot be looked up by order number alone, to protect your privacy.
      </>
    ),
  },
  {
    q: "Are the ingredients listed on the website complete?",
    a: (
      <>
        Product pages list featured ingredients. The full ingredient list is printed on each pack. <Link href="/contact" className="underline">Ask us</Link> if you have a question.
      </>
    ),
  },
  {
    q: "What is your return and refund policy?",
    a: (
      <>
        See the <Link href="/policies/returns" className="underline">returns policy</Link>. If it is still awaiting approval, contact us for the terms that apply to your order.
      </>
    ),
  },
  {
    q: "How long does delivery take, and how can I pay?",
    a: (
      <>
        Delivery terms are in the <Link href="/policies/shipping" className="underline">shipping policy</Link>. Checkout only offers payment methods that are actually set up.
      </>
    ),
  },
  {
    q: "Do you supply salons and retailers?",
    a: (
      <>
        Yes. See <Link href="/business" className="underline">For Business</Link> to compare packages, request a quote or apply as a partner.
      </>
    ),
  },
];

export default function Faq() {
  return (
    <>
      <PageIntro eyebrow="Help" title="Questions, answered" />
      <Container className="max-w-3xl">
        <ul className="space-y-3">
          {FAQ.map((f) => (
            <li key={f.q}>
              <details className="card group p-5">
                <summary className="cursor-pointer list-none font-medium">
                  {f.q}
                  <span aria-hidden="true" className="float-right transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-muted">{f.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
