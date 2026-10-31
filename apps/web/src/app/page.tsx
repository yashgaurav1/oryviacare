import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/catalog-listing";
import { ProductCard } from "@/components/product-card";
import { apiOrNull, type ProductCard as Card } from "@/lib/api";
import { formatDate } from "@/lib/format";

// Hero: the brand's own marketing composite from the source site (classified as a composite, not product evidence).
const HERO = "/media/1a09d0ea3b58678271bd03d0c7e0abb0.png";

export default async function Home() {
  const [products, categories, ingredients, packages, articles] = await Promise.all([
    apiOrNull<{ items: Card[] }>("/v1/catalog/products?sort=featured&pageSize=8"),
    apiOrNull<Array<{ slug: string; name: string; productCount: number }>>("/v1/catalog/categories"),
    apiOrNull<Array<{ slug: string; name: string; products: unknown[] }>>("/v1/catalog/ingredients"),
    apiOrNull<Array<{ slug: string; name: string; state: string; components: Array<{ product: string }> }>>("/v1/packages"),
    apiOrNull<Array<{ slug: string; title: string; excerpt: string | null; publishedAt: string }>>("/v1/content/articles"),
  ]);

  return (
    <>
      {/* 1. Hero */}
      <section className="relative -mt-[84px] overflow-hidden pt-[84px]">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-cream via-canvas to-canvas" />
        <Container className="grid items-center gap-10 py-10 lg:grid-cols-[1fr_1.15fr] lg:py-16">
          <div className="rise">
            <p className="eyebrow mb-4">Skincare · Hair care</p>
            <h1 className="font-display text-[2.6rem] leading-[1.05] sm:text-6xl">Everyday care, made simple.</h1>
            <p className="mt-5 max-w-md text-lg text-muted">Face washes, scrubs, facial kits and shampoos for everyday routines, with clear directions on every product page.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="btn btn-primary">Shop products</Link>
              <Link href="/business" className="btn btn-secondary">For business</Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gold-soft/40 blur-3xl" aria-hidden="true" />
            <div className="float-slow overflow-hidden rounded-[28px] shadow-[var(--shadow-overlay)]">
              <Image src={HERO} alt="Oryvia D-Tan pack, Herbal Facial Kit, Scrub, Face Wash, Anti-Dandruff and Anti-Hairfall shampoos arranged on stone" width={1600} height={694} priority sizes="(min-width: 1024px) 55vw, 100vw" className="h-auto w-full" />
            </div>
          </div>
        </Container>
      </section>

      {/* 2. Category entry */}
      {categories && categories.length > 0 && (
        <Container className="mt-10">
          <ul className="grid gap-4 sm:grid-cols-2">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="card lift flex items-center justify-between p-6 sm:p-8">
                  <span>
                    <span className="eyebrow">{c.productCount} products</span>
                    <span className="mt-1 block font-display text-3xl">{c.name}</span>
                  </span>
                  <span aria-hidden="true" className="text-2xl text-teal">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      )}

      {/* 3. Featured products */}
      <Container className="mt-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Featured</p>
            <h2 className="font-display text-3xl sm:text-4xl">The Oryvia range</h2>
          </div>
          <Link href="/shop" className="btn btn-ghost">View all</Link>
        </div>
        {products?.items.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {products.items.map((p) => (
              <li key={p.id}><ProductCard p={p} /></li>
            ))}
          </ul>
        ) : (
          <p className="card p-8 text-muted">Products are being prepared for the new store. Please check back soon.</p>
        )}
      </Container>

      {/* 4. Routine explorer — deterministic, from approved category data */}
      <Container className="mt-20">
        <div className="card grid gap-6 p-6 sm:p-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="eyebrow mb-2">Find your routine</p>
            <h2 className="font-display text-3xl">Start with what you need</h2>
            <p className="mt-3 text-muted">Pick a routine step. We show products in that category — no guesswork, no diagnosis.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {[
              { href: "/search?q=face+wash", t: "Cleanse", d: "Daily face wash" },
              { href: "/search?q=scrub", t: "Exfoliate", d: "Face scrub" },
              { href: "/search?q=facial+kit", t: "Facial ritual", d: "6-step facial kits" },
              { href: "/search?q=pack", t: "Mask", d: "Face pack" },
              { href: "/search?q=dandruff", t: "Scalp care", d: "Anti-dandruff shampoo" },
              { href: "/search?q=hairfall", t: "Hair care", d: "Anti-hairfall shampoo" },
            ].map((s) => (
              <li key={s.t}>
                <Link href={s.href} className="block rounded-xl bg-sunk p-4 hover:bg-cream">
                  <span className="block font-medium">{s.t}</span>
                  <span className="text-sm text-muted">{s.d}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>

      {/* 5. Ingredient preview */}
      {ingredients && ingredients.length > 0 && (
        <Container className="mt-20">
          <p className="eyebrow mb-2">Ingredient transparency</p>
          <h2 className="mb-6 font-display text-3xl sm:text-4xl">Key ingredients, named</h2>
          <ul className="flex flex-wrap gap-2">
            {ingredients.slice(0, 12).map((i) => (
              <li key={i.slug}>
                <Link href={`/ingredients/${i.slug}`} className="inline-block rounded-full bg-surface px-4 py-2 shadow-[var(--shadow-ambient)] hover:text-primary">{i.name}</Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">Featured ingredients are highlights. The full ingredient list is printed on each pack.</p>
        </Container>
      )}

      {/* 6. Professional packages */}
      {packages && packages.length > 0 && (
        <section className="mt-24 bg-primary py-16 text-white">
          <Container className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <p className="eyebrow mb-2 !text-gold-soft">For salons &amp; retailers</p>
              <h2 className="font-display text-3xl sm:text-4xl">Professional packages</h2>
              <p className="mt-4 text-white/80">Assortments across the range for salons and resellers. Current price and exact composition are confirmed on request.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/packages" className="btn bg-white text-primary hover:bg-cream">Compare packages</Link>
                <Link href="/partners/apply" className="btn text-white ring-1 ring-white/50 hover:bg-white/10">Become a partner</Link>
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {packages.map((p) => (
                <li key={p.slug} className="rounded-2xl bg-white/8 p-5 ring-1 ring-white/15">
                  <p className="font-medium">{p.name}</p>
                  <p className="mt-1 text-sm text-white/70">{p.components.length} products · {p.state === "approved" ? "Available" : "Quote on request"}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {/* 9. Journal (8. reviews omitted: no moderated reviews exist yet) */}
      {articles && articles.length > 0 && (
        <Container className="mt-20">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="font-display text-3xl sm:text-4xl">From the journal</h2>
            <Link href="/journal" className="btn btn-ghost">All articles</Link>
          </div>
          <ul className="grid gap-5 md:grid-cols-3">
            {articles.slice(0, 3).map((a) => (
              <li key={a.slug} className="card lift p-6">
                <p className="text-sm text-muted">{formatDate(a.publishedAt)}</p>
                <h3 className="mt-2 font-display text-xl leading-snug"><Link href={`/journal/${a.slug}`}>{a.title}</Link></h3>
                {a.excerpt && <p className="mt-3 line-clamp-3 text-muted">{a.excerpt}</p>}
              </li>
            ))}
          </ul>
        </Container>
      )}

      {/* 10. Contact */}
      <Container className="mt-20">
        <div className="card flex flex-col items-start justify-between gap-4 p-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-2xl">Questions about a product or order?</h2>
            <p className="text-muted">Read the FAQ or send us a message. Every enquiry gets a reference number.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/faq" className="btn btn-secondary">FAQ</Link>
            <Link href="/contact" className="btn btn-primary">Contact us</Link>
          </div>
        </div>
      </Container>
    </>
  );
}
