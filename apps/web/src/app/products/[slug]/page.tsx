import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/catalog-listing";
import { AddToCart, Price, StockBadge } from "@/components/commerce";
import { ProductCard } from "@/components/product-card";
import { apiOrNull, type ProductCard as Card } from "@/lib/api";

interface Detail extends Card {
  descriptionSections: Array<{ heading: string | null; paragraphs: string[]; items: string[] }>;
  keyFeatures: string[];
  directions: string[];
  precautions: string[];
  details: Record<string, string>;
  fullIngredientList: string | null;
  seo: { title: string | null; description: string | null };
  reviews: Array<{ id: string; rating: number; body: string; author: string; verifiedPurchase: boolean; date: string }>;
  rating: { average: number; count: number } | null;
  related: Card[];
}

const load = (slug: string) => apiOrNull<Detail>(`/v1/catalog/products/${encodeURIComponent(slug)}`);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  if (!p) return { title: "Product not found" };
  return {
    title: p.name,
    description: p.seo.description ?? undefined,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title: p.name, description: p.seo.description ?? undefined, images: p.images[0] ? [p.images[0].src] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await load((await params).slug);
  if (!p) notFound();
  const intro = p.descriptionSections.find((s) => !s.heading)?.paragraphs ?? [];
  // Structured data mirrors exactly what the page renders. No rating unless genuine published reviews exist.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: p.images.map((i) => i.src),
    description: p.shortDescription ?? undefined,
    brand: { "@type": "Brand", name: "Oryvia" },
    ...(p.pricePaise !== null
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: (p.pricePaise / 100).toFixed(2),
            availability: p.availability === "in_stock" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: `/products/${p.slug}`,
          },
        }
      : {}),
    ...(p.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating.average.toFixed(1), reviewCount: p.rating.count } } : {}),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Container className="pt-6">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
          <ol className="flex flex-wrap gap-2">
            <li><Link href="/">Home</Link> /</li>
            <li><Link href="/shop">Shop</Link> /</li>
            {p.categories[0] && (
              <li><Link href={`/category/${p.categories[0].slug}`}>{p.categories[0].name}</Link> /</li>
            )}
            <li aria-current="page" className="text-ink">{p.name}</li>
          </ol>
        </nav>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <section aria-label="Product images">
            {p.images.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {p.images.map((img, i) => (
                  <li key={img.src} className={`relative overflow-hidden rounded-[18px] bg-cream ${i === 0 ? "aspect-[4/3] sm:col-span-2" : "aspect-square"}`}>
                    <Image src={img.src} alt={img.alt} fill priority={i === 0} sizes={i === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"} className="object-contain" />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid aspect-square place-items-center rounded-[18px] bg-cream text-muted">Image pending</div>
            )}
          </section>
          <section aria-labelledby="pname" className="lg:sticky lg:top-28 lg:self-start">
            {p.categories[0] && <p className="eyebrow mb-3">{p.categories[0].name}</p>}
            <h1 id="pname" className="font-display text-3xl leading-tight sm:text-4xl">{p.name}</h1>
            {p.packSize && <p className="mt-2 text-muted">Net quantity: {p.packSize}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Price pricePaise={p.pricePaise} referencePaise={p.referencePaise} referenceLabel={p.referenceLabel} size="lg" />
              <StockBadge availability={p.availability} quantity={p.availableQuantity} />
            </div>
            <p className="mt-1 text-xs text-muted">Price as published by Oryvia. A tax breakdown will appear on orders once tax settings are confirmed.</p>
            {p.shortDescription && <p className="mt-5 text-lg leading-relaxed">{p.shortDescription}</p>}
            <div className="mt-6">
              <AddToCart variantId={p.variantId} available={p.availability === "in_stock"} maxQuantity={p.availableQuantity} />
            </div>
            {p.featuredIngredients.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-2 text-sm font-medium">Featured ingredients</h2>
                <ul className="flex flex-wrap gap-2">
                  {p.featuredIngredients.map((i) => (
                    <li key={i.slug}>
                      <Link href={`/ingredients/${i.slug}`} className="inline-block rounded-full bg-sunk px-3 py-1.5 text-sm hover:bg-cream">{i.name}</Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">
                  These are highlighted ingredients, not the full formulation.{p.fullIngredientList ? " " : " The complete ingredient list is printed on the pack. "}
                  <Link href="/contact" className="underline">Ask about ingredients</Link>
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-10">
          {intro.length > 0 && (
            <section className="prose-oryvia">
              <h2>About this product</h2>
              {intro.map((t) => <p key={t}>{t}</p>)}
            </section>
          )}
          {p.keyFeatures.length > 0 && (
            <section className="prose-oryvia">
              <h2>Key features</h2>
              <ul>{p.keyFeatures.map((t) => <li key={t}>{t}</li>)}</ul>
            </section>
          )}
          {p.directions.length > 0 && (
            <section className="prose-oryvia">
              <h2>How to use</h2>
              <ol className="list-decimal pl-5">{p.directions.map((t) => <li key={t}>{t}</li>)}</ol>
            </section>
          )}
          {p.precautions.length > 0 && (
            <section className="rounded-2xl bg-warning-bg p-6">
              <h2 className="mb-2 font-display text-xl text-warning">Precautions</h2>
              {p.precautions.map((t) => <p key={t} className="mb-2 last:mb-0">{t}</p>)}
            </section>
          )}
          {Object.keys(p.details).length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-2xl">Product details</h2>
              <dl className="card divide-y divide-divider">
                {Object.entries(p.details).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[minmax(7rem,10rem)_1fr] gap-4 px-5 py-3">
                    <dt className="text-muted">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <section>
            <h2 className="mb-3 font-display text-2xl">Delivery &amp; returns</h2>
            <p className="text-muted">
              See our <Link href="/policies/shipping" className="underline">shipping policy</Link> and <Link href="/policies/returns" className="underline">returns policy</Link> for current terms.
            </p>
          </section>
          {p.reviews.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-2xl">Reviews</h2>
              <ul className="space-y-4">
                {p.reviews.map((r) => (
                  <li key={r.id} className="card p-5">
                    <p aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}</p>
                    <p className="mt-2">{r.body}</p>
                    <p className="mt-2 text-sm text-muted">{r.author}{r.verifiedPurchase ? " · Verified purchase" : ""}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {p.related.length > 0 && (
          <section className="mt-20">
            <h2 className="mb-6 font-display text-3xl">You may also like</h2>
            <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {p.related.map((r) => <li key={r.id}><ProductCard p={r} /></li>)}
            </ul>
          </section>
        )}
      </Container>
    </>
  );
}
