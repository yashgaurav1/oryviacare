import type { Metadata } from "next";
import { Container, PageIntro } from "@/components/catalog-listing";
import { Stepper } from "@/components/stepper";
import { api } from "@/lib/api";
import { CartViewClient, type CartView } from "./cart-view";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default async function CartPage() {
  const cart = await api<CartView>("/v1/carts/current");
  return (
    <>
      <PageIntro title="Your cart" />
      <Container>
        <Stepper current={0} />
        <CartViewClient initial={cart} />
      </Container>
    </>
  );
}
