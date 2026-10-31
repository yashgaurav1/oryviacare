import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageIntro } from "@/components/catalog-listing";
import { api, apiOrNull, type Me } from "@/lib/api";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const [cart, methods, me] = await Promise.all([
    api<{ items: unknown[] }>("/v1/carts/current"),
    api<Parameters<typeof CheckoutForm>[0]["methods"]>("/v1/checkout/payment-methods"),
    apiOrNull<Me>("/v1/account/me"),
  ]);
  return (
    <>
      <PageIntro title="Checkout">
        {me ? <>Signed in as {me.email}.</> : <>Checking out as a guest. <Link href="/login?next=/checkout" className="underline">Sign in</Link> to save this order to your account.</>}
      </PageIntro>
      <Container>
        {cart.items.length ? (
          <CheckoutForm methods={methods} email={me?.email ?? null} />
        ) : (
          <div className="card p-10 text-center">
            <p className="mb-6">Your cart is empty.</p>
            <Link href="/shop" className="btn btn-primary">Shop products</Link>
          </div>
        )}
      </Container>
    </>
  );
}
