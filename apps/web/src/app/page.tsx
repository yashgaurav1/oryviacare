import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { formatPaise } from "@oryvia/contracts";
import { Container } from "@/components/catalog-listing";
import { AddToCart } from "@/components/commerce";
import { Kinetic, Marquee, SectionHead } from "@/components/kinetic";
import { CountUp, GoldDust, HorizontalPin, Magnetic, Parallax, Reveal, ScrollVar, Spotlight } from "@/components/motion";
import { Intro } from "@/components/intro";
import { StickyStory } from "@/components/sticky-story";
import { apiOrNull, type ProductCard as Card } from "@/lib/api";
import { formatDate } from "@/lib/format";

// The brand's own marketing composite from the source site (classified as a composite, not product evidence).
const RANGE_IMAGE = "/media/1a09d0ea3b58678271bd03d0c7e0abb0.png";

// Routine steps map to real catalogue searches; no diagnosis, no claims.
const RITUAL = [
  { href: "/search?q=face+wash", t: "Cleanse", d: "Daily face wash" },
  { href: "/search?q=scrub", t: "Exfoliate", d: "Face scrub" },
  { href: "/search?q=pack", t: "Mask", d: "Face pack" },
  { href: "/search?q=facial+kit", t: "Facial ritual", d: "6-step facial kits" },
  { href: "/search?q=dandruff", t: "Scalp care", d: "Anti-dandruff shampoo" },
  { href: "/search?q=hairfall", t: "Hair care", d: "Anti-hairfall shampoo" },
];

const TINT: Record<string, string> = { "skin-care": "bg-blush", "hair-care": "bg-sage" };

export default async function Home() {
  const [products, categories, ingredients, packages, articles] = await Promise.all([
    apiOrNull<{ items: Card[]; total: number }>("/v1/catalog/products?sort=featured&pageSize=12"),
    apiOrNull<Array<{ slug: string; name: string; productCount: number }>>("/v1/catalog/categories"),
    apiOrNull<Array<{ slug: string; name: string; products: unknown[] }>>("/v1/catalog/ingredients"),
    apiOrNull<Array<{ slug: string; name: string; state: string; components: Array<{ product: string }> }>>("/v1/packages"),
    apiOrNull<Array<{ slug: string; title: string; excerpt: string | null; publishedAt: string }>>("/v1/content/articles"),
  ]);
  const items = products?.items ?? [];
  const prefer = ["gold-6-step", "anti-hairfall", "d-tan"];
  const fan = [...prefer.map((k) => items.find((p) => p.slug.includes(k))), ...items].filter((p, i, a): p is Card => !!p?.images[0] && a.indexOf(p) === i).slice(0, 3);
  const byCategory = (slug: string) => items.filter((p) => p.categories.some((c) => c.slug === slug) && p.images[0]).slice(0, 3);
  const gallery = items.flatMap((p) => p.images.slice(0, 2).map((img) => ({ ...img, slug: p.slug, name: p.name })));
  const story = items
    .filter((p) => p.images[0])
    .slice(0, 5)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.categories[0]?.name ?? null, description: p.shortDescription, ingredients: p.featuredIngredients.slice(0, 4), pricePaise: p.pricePaise, image: p.images[0] }));
  const facts = [
    products && { n: products.total, l: "products" },
    categories && { n: categories.length, l: "ranges" },
    ingredients && { n: ingredients.length, l: "named key ingredients" },
  ].filter(Boolean) as Array<{ n: number; l: string }>;

  return (
    <>
      <Intro />
      {/* 1. Hero — light, colour mesh, dotted grid, gold dust; reacts to the cursor and to scroll */}
      <ScrollVar className="hero-light -mt-[84px] overflow-hidden pt-[84px]">
        <div className="mesh" aria-hidden="true">
          <span className="left-[52%] top-[-6%] h-[34rem] w-[34rem] bg-[#f3d49a]" />
          <span className="left-[-6%] top-[30%] h-[30rem] w-[30rem] bg-[#f4cdc2]" style={{ animationDelay: "-8s" }} />
          <span className="right-[-4%] top-[46%] h-[26rem] w-[26rem] bg-[#cfe0cc]" style={{ animationDelay: "-15s" }} />
        </div>
        <div className="dot-grid" aria-hidden="true" />
        <GoldDust className="absolute inset-0 -z-[1] h-full w-full" tone="light" />
        <Container className="relative grid min-h-[min(94vh,900px)] items-center gap-12 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="hero-copy">
            <p className="rise">
              <Link href="/business" className="pill-badge gold-ring transition-transform hover:-translate-y-0.5">
                <span className="whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-on-primary">Oryvia Pro</span>
                <span className="whitespace-nowrap">Packages for salons<span className="hidden sm:inline"> &amp; retailers</span></span> <span aria-hidden="true">→</span>
              </Link>
            </p>
            <h1 className="mt-7 font-display text-[clamp(3.1rem,7.4vw,6.8rem)] leading-[0.94] tracking-[-0.035em]">
              <Kinetic text="Everyday care," className="mask-words" />
              <br />
              <Kinetic text="made simple." base={200} className="mask-words italic" wordClass="text-gold-deep pr-[0.06em]" />
            </h1>
            <p className="rise mt-7 max-w-md text-lg leading-relaxed text-muted" style={{ animationDelay: "500ms" }}>
              Face washes, scrubs, facial kits and shampoos for everyday routines, with clear directions on every product page.
            </p>
            <div className="rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: "650ms" }}>
              <Magnetic>
                <Link href="/shop" className="btn btn-primary h-13 px-7 text-base">
                  Shop the range <span aria-hidden="true">→</span>
                </Link>
              </Magnetic>
              <Magnetic>
                <Link href="#ritual" className="btn btn-secondary h-13 px-7 text-base">Find your routine</Link>
              </Magnetic>
            </div>
            {facts.length > 0 && (
              <dl className="rise mt-12 flex flex-wrap gap-x-10 gap-y-4" style={{ animationDelay: "800ms" }}>
                {facts.map((f) => (
                  <div key={f.l} className="border-l border-ink/15 pl-4">
                    <dt className="sr-only">{f.l}</dt>
                    <dd>
                      <CountUp value={f.n} className="block font-display text-4xl" />
                      <span className="text-sm text-muted">{f.l}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {fan.length > 0 && (
            <Parallax className="hero-fan relative mx-auto aspect-square w-full max-w-[580px]">
              <svg viewBox="0 0 200 200" className="absolute inset-[4%] h-[92%] w-[92%] text-copper/45 [animation:spin-slow_50s_linear_infinite]" aria-hidden="true" data-depth="8">
                <defs>
                  <path id="seal" d="M100,100 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0" />
                </defs>
                <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="0.35" strokeDasharray="1 2.4" />
                <text fill="currentColor" fontSize="7.4" letterSpacing="5.2" style={{ fontFamily: "var(--font-marcellus)" }}>
                  <textPath href="#seal">ORYVIA CARE · SKINCARE · HAIR CARE · ORYVIA CARE · SKINCARE · HAIR CARE ·</textPath>
                </text>
              </svg>
              {fan.map((p, i) => {
                const pos = ["left-[29%] top-[12%] w-[46%] z-20", "left-[3%] top-[34%] w-[38%] z-10", "right-[1%] top-[38%] w-[38%] z-10"][i];
                const spread = [0, -1, 1][i];
                return (
                  <div key={p.id} data-depth={[26, 14, 18][i]} className={`fan-card absolute ${pos}`} style={{ "--spread": spread, "--lift": [-80, 40, 60][i], "--spin": [0, -10, 10][i] } as CSSProperties}>
                    <Link
                      href={`/products/${p.slug}`}
                      className="float-slow group block overflow-hidden rounded-[28px] bg-surface p-2 shadow-[0_40px_80px_-30px_rgb(26_20_17/0.45)] ring-1 ring-ink/5 transition-shadow duration-500 hover:shadow-[0_50px_90px_-30px_rgb(154_70_38/0.55)]"
                      style={{ "--r": `${[-2, -9, 8][i]}deg`, animationDelay: `${i * -2.6}s` } as CSSProperties}
                    >
                      <span className="relative block aspect-square overflow-hidden rounded-[22px]">
                        <Image src={p.images[0].src} alt={p.images[0].alt} fill priority sizes="(min-width: 1024px) 22vw, 40vw" className="object-cover transition-transform duration-700 group-hover:scale-110" />
                      </span>
                      <span className="flex items-center justify-between gap-2 px-2 pb-1 pt-2.5 text-xs">
                        <span className="truncate font-semibold">{p.name.replace(/^ORYVIA\s+/i, "").split(/ with | for /i)[0]}</span>
                        {p.pricePaise !== null && <span className="tabular shrink-0 font-display text-sm">{formatPaise(p.pricePaise)}</span>}
                      </span>
                    </Link>
                  </div>
                );
              })}
            </Parallax>
          )}
        </Container>
      </ScrollVar>

      {/* 2. Ingredient ticker */}
      {ingredients && ingredients.length > 0 && (
        <section aria-label="Key ingredients" className="border-y border-divider bg-surface/60 py-5">
          <Marquee className="font-display text-2xl italic sm:text-3xl" items={ingredients.map((i) => ({ label: i.name, href: `/ingredients/${i.slug}` }))} speed={45} />
        </section>
      )}

      {/* 3. Pinned horizontal showcase — vertical scroll drives the range sideways */}
      {items.length > 0 && (
        <section className="mt-24" aria-labelledby="range-h">
          <HorizontalPin
            header={
              <Container>
                <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
                  <Reveal className="max-w-2xl">
                    <p className="eyebrow mb-3 flex items-center gap-3">
                      <span className="inline-block h-px w-10 bg-kesar" aria-hidden="true" />
                      The range
                    </p>
                    <h2 id="range-h" className="font-display text-4xl leading-[1.02] tracking-[-0.02em] sm:text-6xl">
                      <Kinetic text="Every product," className="mask-words" />{" "}
                      <Kinetic text="one scroll away." base={160} className="mask-words italic text-copper" />
                    </h2>
                  </Reveal>
                  <Link href="/shop" className="btn btn-secondary">View all products <span aria-hidden="true">→</span></Link>
                </div>
              </Container>
            }
          >
            {items.map((p, i) => (
              <article key={p.id} className="group relative flex w-[78vw] shrink-0 flex-col overflow-hidden rounded-[32px] bg-surface shadow-[var(--shadow-ambient)] ring-1 ring-divider sm:w-[46vw] lg:w-[min(30vw,420px)]">
                <Link href={`/products/${p.slug}`} className={`relative block aspect-[4/5] overflow-hidden ${TINT[p.categories[0]?.slug ?? ""] ?? "bg-cream"}`} aria-label={p.name}>
                  {p.images[0] && <Image src={p.images[0].src} alt={p.images[0].alt} fill sizes="(min-width: 1024px) 30vw, 78vw" className="object-cover transition-transform duration-[1200ms] [transition-timing-function:var(--ease-out)] group-hover:scale-[1.07]" />}
                  <span className="tabular absolute left-4 top-4 rounded-full bg-surface/85 px-3 py-1 font-display text-sm backdrop-blur">{String(i + 1).padStart(2, "0")}</span>
                </Link>
                <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
                  {p.categories[0] && <p className="eyebrow">{p.categories[0].name}</p>}
                  <h3 className="font-display text-xl leading-snug">
                    <Link href={`/products/${p.slug}`} className="link-draw">{p.name}</Link>
                  </h3>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                    {p.pricePaise !== null ? <span className="tabular font-display text-2xl">{formatPaise(p.pricePaise)}</span> : <span className="text-sm text-muted">Price not available</span>}
                    <div className="w-40">
                      <AddToCart variantId={p.variantId} available={p.availability === "in_stock"} maxQuantity={p.availableQuantity} compact name={p.name} image={p.images[0]?.src} />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </HorizontalPin>
        </section>
      )}

      {/* 4. Categories */}
      {categories && categories.length > 0 && (
        <Container className="mt-28">
          <SectionHead eyebrow="Two ranges" title={<>Choose your <em className="text-copper">ritual</em></>} />
          <ul className="grid gap-5 md:grid-cols-2">
            {categories.map((c, ci) => {
              const imgs = byCategory(c.slug);
              return (
                <Reveal as="li" key={c.slug} delay={ci * 120}>
                  <Link href={`/category/${c.slug}`} className={`group relative block overflow-hidden rounded-[32px] ${TINT[c.slug] ?? "bg-sunk"} p-8 sm:p-10`}>
                    <div className="relative z-10 flex items-start justify-between">
                      <div>
                        <p className="eyebrow">{c.productCount} products</p>
                        <h3 className="mt-2 font-display text-5xl leading-none sm:text-6xl">{c.name}</h3>
                      </div>
                      <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-ink text-xl text-on-primary transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:-rotate-45 group-hover:scale-110">→</span>
                    </div>
                    <div className="relative mt-10 flex h-56 items-end justify-center sm:h-72">
                      {imgs.map((p, i) => (
                        <span
                          key={p.id}
                          className="absolute bottom-0 aspect-square w-[44%] overflow-hidden rounded-[22px] shadow-[var(--shadow-lift)] ring-1 ring-ink/5 transition-transform duration-700 [transition-timing-function:var(--ease-out)]"
                          style={{
                            left: `${(imgs.length === 2 ? [40, 16] : [28, 4, 52])[i]}%`,
                            zIndex: i === 0 ? 3 : 1,
                            transform: `rotate(${[0, -8, 8][i]}deg) translateY(${i === 0 ? 0 : 18}px)`,
                          }}
                        >
                          <span className="absolute inset-0 transition-transform duration-700 group-hover:scale-110">
                            <Image src={p.images[0].src} alt="" fill sizes="(min-width: 768px) 20vw, 40vw" className="object-cover" />
                          </span>
                        </span>
                      ))}
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        </Container>
      )}

      {/* 4b. Scroll-driven product story */}
      {story.length > 2 && (
        <section className="mt-28" aria-labelledby="story-h">
          <Container>
            <SectionHead eyebrow="Up close" title={<span id="story-h">Meet the range, <em className="text-copper">one by one</em></span>}>
              Keep scrolling. Each product turns to face you with what is in it and what it costs.
            </SectionHead>
            <StickyStory items={story} />
          </Container>
        </section>
      )}

      {/* 5. Feature grid — real capabilities of this store, cursor spotlight on each card */}
      <Container className="mt-28">
        <SectionHead eyebrow="Designed to be clear" title={<>Everything you need, <em className="text-copper">nothing you don&apos;t</em></>} />
        <Spotlight className="grid gap-4 md:grid-cols-6">
          <Reveal className="spot p-7 md:col-span-4 md:row-span-2 sm:p-9">
            <p className="eyebrow">Clear directions</p>
            <h3 className="mt-3 max-w-md font-display text-3xl leading-tight sm:text-4xl">Every product page tells you how to use it, step by step.</h3>
            <ol className="mt-8 grid gap-3 sm:grid-cols-3">
              {["Cleanse", "Apply", "Rinse"].map((s, i) => (
                <li key={s} className="rounded-[20px] bg-canvas p-4 ring-1 ring-divider">
                  <span className="grid size-9 place-items-center rounded-full bg-ink font-display text-xs text-kesar-light">{String(i + 1).padStart(2, "0")}</span>
                  <span className="mt-3 block font-medium">{s}</span>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sunk">
                    <span className="track-line block h-full rounded-full bg-gradient-to-r from-kesar to-copper-bright" style={{ animationDelay: `${i * 400}ms` }} />
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-muted">Illustration. Actual steps differ by product and are shown on each product page.</p>
          </Reveal>
          {ingredients && ingredients.length > 0 && (
            <Reveal delay={100} className="spot p-7 md:col-span-2">
              <p className="eyebrow">Ingredients, named</p>
              <h3 className="mt-3 font-display text-2xl leading-tight">
                <CountUp value={ingredients.length} /> key ingredients, each with its own page.
              </h3>
              <ul className="mt-5 flex flex-wrap gap-1.5">
                {ingredients.slice(0, 6).map((i) => (
                  <li key={i.slug}>
                    <Link href={`/ingredients/${i.slug}`} className="inline-block rounded-full border border-divider px-3 py-1 text-xs transition-colors hover:border-ink">{i.name}</Link>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
          <Reveal delay={180} className="spot p-7 md:col-span-2">
            <p className="eyebrow">Order tracking</p>
            <h3 className="mt-3 font-display text-2xl leading-tight">Follow your order with a private link. No sign-in needed.</h3>
            <div className="mt-6 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wider text-muted" aria-hidden="true">
              {["Placed", "Confirmed", "Shipped", "Delivered"].map((s, i) => (
                <span key={s} className="flex flex-1 flex-col gap-1.5">
                  <span className="h-1 overflow-hidden rounded-full bg-sunk">
                    <span className="track-line block h-full bg-ink" style={{ animationDelay: `${i * 500}ms` }} />
                  </span>
                  {s}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={100} className="spot p-7 md:col-span-3">
            <p className="eyebrow">Your account</p>
            <h3 className="mt-3 font-display text-2xl leading-tight">Orders, parcels and tracking references in one place.</h3>
            <Link href="/account" className="mt-5 inline-flex text-sm font-semibold text-copper link-draw">Go to your account →</Link>
          </Reveal>
          <Reveal delay={180} className="spot p-7 md:col-span-3">
            <p className="eyebrow">For salons &amp; retailers</p>
            <h3 className="mt-3 font-display text-2xl leading-tight">Professional packages, with price and composition confirmed on request.</h3>
            <Link href="/packages" className="mt-5 inline-flex text-sm font-semibold text-copper link-draw">Compare packages →</Link>
          </Reveal>
        </Spotlight>
      </Container>

      {/* 6. Ritual */}
      <section id="ritual" className="mt-28 scroll-mt-24 bg-cream py-24">
        <Container>
          <SectionHead eyebrow="Find your routine" title={<>Start with <em className="text-copper">what you need</em></>}>
            Pick a step. We show the products in that category — no guesswork, no diagnosis.
          </SectionHead>
          <div className="relative">
            <span aria-hidden="true" className="draw-on-scroll absolute left-0 right-0 top-[2.1rem] hidden h-px bg-gradient-to-r from-kesar via-copper-bright to-kesar lg:block" />
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {RITUAL.map((s, i) => (
                <Reveal as="li" key={s.t} delay={i * 80}>
                  <Link href={s.href} className="group relative block h-full rounded-[24px] bg-surface p-5 pt-4 shadow-[var(--shadow-ambient)] transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]">
                    <span className="relative z-10 mb-6 grid size-11 place-items-center rounded-full bg-ink font-display text-sm text-kesar-light ring-4 ring-cream transition-colors duration-500 group-hover:bg-kesar group-hover:text-ink">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="block font-display text-2xl">{s.t}</span>
                    <span className="mt-1 block text-sm text-muted">{s.d}</span>
                    <span aria-hidden="true" className="mt-4 block text-copper transition-transform duration-500 group-hover:translate-x-1.5">→</span>
                  </Link>
                </Reveal>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* 7. Two image rows drifting in opposite directions */}
      {gallery.length > 3 && (
        <section aria-label="Product gallery" className="mt-24 space-y-4 overflow-hidden">
          {[gallery, [...gallery].reverse()].map((row, ri) => (
            <div key={ri} className="marquee-wrap marquee-mask overflow-hidden">
              <div className={`marquee ${ri ? "marquee-reverse" : ""}`} style={{ "--speed": "70s" } as CSSProperties}>
                {[0, 1].map((copy) => (
                  <ul key={copy} className="flex shrink-0 gap-4 pr-4" aria-hidden={copy === 1 || undefined}>
                    {row.map((g, gi) => (
                      <li key={`${g.src}-${gi}`} className="relative h-44 w-44 shrink-0 overflow-hidden rounded-[24px] sm:h-56 sm:w-56">
                        {copy === 0 ? (
                          <Link href={`/products/${g.slug}`} className="group block h-full w-full" aria-label={g.name}>
                            <Image src={g.src} alt="" fill sizes="224px" className="object-cover transition-transform duration-700 group-hover:scale-110" />
                          </Link>
                        ) : (
                          <Image src={g.src} alt="" fill sizes="224px" className="object-cover" />
                        )}
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 8. Editorial band */}
      <Container className="mt-24">
        <Reveal>
          <figure className="relative overflow-hidden rounded-[36px] bg-sunk">
            <div className="parallax-zoom relative aspect-[16/10] sm:aspect-[16/7]">
              <Image src={RANGE_IMAGE} alt="Oryvia D-Tan pack, Herbal Facial Kit, Scrub, Face Wash, Anti-Dandruff and Anti-Hairfall shampoos arranged on stone" fill sizes="(min-width: 1400px) 1340px, 100vw" className="object-cover" />
            </div>
            <figcaption className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-4 rounded-[26px] bg-surface/80 p-5 backdrop-blur-xl sm:bottom-8 sm:left-8 sm:right-auto sm:max-w-lg sm:p-7">
              <span>
                <span className="eyebrow">The full range</span>
                <span className="mt-2 block font-display text-2xl leading-tight sm:text-3xl">Skin care and hair care, made for every day.</span>
              </span>
              <Link href="/shop" className="btn btn-primary">Explore the range</Link>
            </figcaption>
          </figure>
        </Reveal>
      </Container>

      {/* 9. Professional packages — light band with travelling gold edges */}
      {packages && packages.length > 0 && (
        <section className="relative mt-28 overflow-hidden bg-gradient-to-br from-cream via-canvas to-blush py-24">
          <span aria-hidden="true" className="orb -right-40 top-0 h-[30rem] w-[30rem] bg-kesar/30" />
          <Container className="relative grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <SectionHead eyebrow="For salons & retailers" title={<>Professional <span className="text-gold-deep italic">packages</span></>}>
                Assortments across the range for salons and resellers. Current price and exact composition are confirmed on request.
              </SectionHead>
              <div className="flex flex-wrap gap-3">
                <Link href="/packages" className="btn btn-primary">Compare packages</Link>
                <Link href="/partners/apply" className="btn btn-secondary">Become a partner</Link>
              </div>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {packages.map((p, i) => (
                <Reveal as="li" key={p.slug} delay={i * 100}>
                  <Link href={`/packages/${p.slug}`} className="gold-ring group block h-full rounded-[24px] bg-surface/90 p-6 shadow-[var(--shadow-ambient)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]" style={{ "--a": `${i * 90}deg` } as CSSProperties}>
                    <p className="font-display text-xl leading-snug">{p.name}</p>
                    <p className="mt-3 text-sm text-muted">{p.components.length} products · {p.state === "approved" ? "Available" : "Quote on request"}</p>
                    <span aria-hidden="true" className="mt-5 block text-copper transition-transform duration-500 group-hover:translate-x-1.5">→</span>
                  </Link>
                </Reveal>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {/* 10. Journal (reviews omitted: no moderated reviews exist yet) */}
      {articles && articles.length > 0 && (
        <Container className="mt-28">
          <SectionHead eyebrow="Journal" title="From the journal" action={<Link href="/journal" className="btn btn-secondary">All articles</Link>} />
          <ul className="grid gap-5 md:grid-cols-3">
            {articles.slice(0, 3).map((a, i) => (
              <Reveal as="li" key={a.slug} delay={i * 100} className="card lift p-7">
                <p className="text-sm text-muted">{formatDate(a.publishedAt)}</p>
                <h3 className="mt-2 font-display text-2xl leading-snug"><Link href={`/journal/${a.slug}`} className="link-draw">{a.title}</Link></h3>
                {a.excerpt && <p className="mt-3 line-clamp-3 text-muted">{a.excerpt}</p>}
              </Reveal>
            ))}
          </ul>
        </Container>
      )}

      {/* 11. Contact */}
      <Container className="mt-28">
        <Reveal className="relative overflow-hidden rounded-[32px] bg-blush p-8 sm:p-12">
          <span aria-hidden="true" className="orb -right-24 -top-24 h-72 w-72 bg-kesar/40" />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl">Questions about a product or order?</h2>
              <p className="mt-2 text-muted">Read the FAQ or send us a message. Every enquiry gets a reference number.</p>
            </div>
            <div className="flex gap-3">
              <Link href="/faq" className="btn btn-secondary">FAQ</Link>
              <Link href="/contact" className="btn btn-primary">Contact us</Link>
            </div>
          </div>
        </Reveal>
      </Container>
    </>
  );
}
