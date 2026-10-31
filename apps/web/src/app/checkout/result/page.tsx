import type { Metadata } from "next";
import { Container, PageIntro } from "@/components/catalog-listing";
import { Stepper } from "@/components/stepper";
import { ResultView } from "./result-view";

export const metadata: Metadata = { title: "Order placed", robots: { index: false } };

export default async function ResultPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return (
    <>
      <PageIntro title="Thank you" />
      <Container className="max-w-3xl">
        <Stepper current={3} />
        {ref ? <ResultView reference={ref} /> : <p>No order reference was provided.</p>}</Container>
    </>
  );
}
