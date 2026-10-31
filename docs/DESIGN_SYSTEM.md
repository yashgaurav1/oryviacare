# Design system — "Kohl, Kesar & Copper"

Revised 2026-10-31 (session 3, second pass: lighter, flowing, more motion at the merchant's request). The palette is drawn from Oryvia's real packaging: black boxes with gold type (Gold kit, Anti-hairfall), bottle-green bottles with copper pumps (Face Wash, shampoos, Scrub), blush-pink labels and gold-dust artwork. The earlier pale green/ivory system read as generic "clean beauty" and did not match the products.

Tokens: `apps/web/src/app/globals.css` (`:root` + Tailwind `@theme`). Component classes live in `@layer components`, so Tailwind utilities always win over them (an unlayered `.btn { position: relative }` once broke `sr-only`).

## Colour

| Token | Value | Use |
| --- | --- | --- |
| canvas | `#FBF6EE` | Page background (warm ivory) |
| surface | `#FFFFFF` | Cards, forms |
| sunk / cream | `#F3E9DA` / `#F7EDDC` | Sandstone panels, ritual band |
| blush / sage | `#F6E1DA` / `#E6ECE2` | Skin-care / hair-care tints behind product images |
| ink (= primary) | `#1A1411` | Text; primary buttons (kohl) with `#F7E9C6` text |
| ink-muted | `#6A5B52` | Secondary text |
| night / night-2 | `#100B09` / `#1C1410` | Hero, ticker, packages, footer, mobile menu |
| on-night / on-night-muted | `#F5EBDD` / `#B9A898` | Text on night |
| kesar | `#D6A13F` | Saffron gold — decoration, large display type, the gold button fill |
| kesar-light | `#E2B456` | Gold text on night |
| gold-text | `#875A12` | Small gold text (eyebrows) on light |
| copper | `#9A4626` | Links and italic accents on light (legacy `teal` token maps here) |
| copper-bright / bottle / rose | `#C27A4F` / `#1F3B2E` / `#9E3B52` | Ambient light orbs, decoration |
| status colours | unchanged | Always paired with text |

Contrast (WCAG 2.x, computed 2026-10-31): ink/canvas 16.9; muted/canvas 6.0; muted/surface 6.5; muted/sunk 5.4; on-primary/ink 15.1; gold-text/canvas 5.6; copper/canvas 6.0; copper/sunk 5.3; on-night/night 16.6; on-night-muted/night 8.5; kesar-light/night 10.2; ink/kesar 7.8 (gold button); rose/blush 5.2. **kesar/canvas is 2.2 — never use kesar for text on light backgrounds.** These are token-pair calculations, not an accessibility audit.

## Type
- **Fraunces** (variable; `SOFT`, `WONK`, `opsz` axes, roman + italic): display headings, prices, step numbers. Italic + gold gradient for emphasis words.
- **Manrope**: body and UI.
- **Marcellus**: the `ORYVIA` wordmark only, echoing the classic roman capitals printed on the packs. Still typographic: no logo was invented (D-011).

## Shape
Cards 22 px radius; feature tiles 28–36 px; buttons and chips are pills; inputs 14 px.

## Components
`.btn-primary` (kohl, gold sheen sweep on hover), `.btn-kesar` (gold gradient, ink text), `.btn-secondary`, `.btn-ghost`, `.btn-night` (outline on dark), `.input`, `.card`, `.glass`, `.on-night` (dark section with film grain), `.text-gold-gradient` (animated shimmer), `.gold-ring` (rotating conic border), `.link-draw` (underline draws in), `Kinetic`, `Marquee`, `SectionHead`, `Reveal`, `Tilt`, `Magnetic`, `Parallax`, `GoldDust`, `ProductCard`, `Price`, `StockBadge`, `AddToCart`, `OrderTimeline`, `Pending`, `ReasonAction`.

## Motion
| Where | What | How |
| --- | --- | --- |
| Every page | Inertial smooth scrolling | `SmoothScroll` (Lenis 1.3.26, pinned; dialogs opt out with `data-lenis-prevent`). Lenis's required CSS is in `globals.css`; native `scroll-behavior: smooth` is deliberately off. |
| Every page | Gold progress line along the top edge | `.scroll-progress` scaled by `--scroll` |
| Every page | Fade-in on navigation (opacity only: a transform would break `position: fixed` children) | `app/template.tsx` + `.page-enter` |
| Home, first visit per session | Curtain intro: ORYVIA letters rise, gold rule draws, curtain lifts after about 1.5 s; hero headline waits for it | `Intro` (CSS-driven; an inline script hides it before first paint on return visits; a 2.6 s safety net removes it if animations were paused) |
| Home | "Meet the range": section pins, scrolling turns a 3D carousel of real product photos while name, description, ingredients and price change beside it | `StickyStory` (desktop fine pointer; card list on touch, narrow screens and reduced motion) |
| Inner pages | Every page header uses the light mesh, dotted grid and masked headline | `PageIntro` |
| Product page | Gallery with crossfading thumbnails and cursor-following zoom; buy bar slides up once the main buy box scrolls away | `ProductGallery`, `StickyBuyBar` |
| Cart → checkout → result | Progress stepper with a gold fill line | `Stepper` |
| Sign-in pages | Split layout: form card plus a light panel with floating product photos | `AuthShell` |
| Account | Active section shown as an ink pill | `AccountNav` |
| Hero (light) | Ivory hero with a drifting blush/saffron/sage colour mesh and a dotted grid that fades at the edges | `.hero-light`, `.mesh`, `.dot-grid` |
| Hero | Copy lifts and fades, product fan spreads and tilts as you scroll away | `ScrollVar` sets `--p`; `.hero-copy`, `.hero-fan .fan-card` |
| Hero | Headline words slide up out of a mask | `Kinetic` with `.mask-words` |
| Hero, feature grid | Numbers count up on first view | `CountUp` (real counts from the catalogue) |
| Hero | Gold dust drifting upward | `GoldDust` canvas (`tone="light"` on ivory), about 70 particles; pauses off-screen or in hidden tabs |
| Hero | Headline words blur-rise in sequence; "made simple." shimmers gold | `Kinetic`, `.text-gold-gradient` |
| Hero | Three real pack images float at different phases and shift against the cursor; a seal of brand words rotates | `float-slow`, `Parallax` (`data-depth`), SVG `textPath` |
| Hero | Calls to action drift toward the cursor | `Magnetic` |
| Ingredient band | Infinite ticker, pauses on hover/focus | `Marquee` |
| The range | Section pins while vertical scroll moves the products sideways, with a progress rule | `HorizontalPin` (desktop fine pointer only; swipeable snap row on touch, narrow screens and reduced motion) |
| Feature grid | Bento cards with a copper border-light and glow that follow the cursor; animated step and tracking bars | `Spotlight` + `.spot`, `.track-line` |
| Gallery | Two rows of product images drifting in opposite directions | `.marquee` / `.marquee-reverse` |
| Sections | Blur-rise on first view, staggered | `Reveal` (IntersectionObserver) |
| Section heads, ritual line | Gold rule draws as it scrolls in | CSS scroll-driven `animation-timeline: view()`; static where unsupported |
| Editorial band | Image settles from 118% to 100% as it scrolls in | `.parallax-zoom` (scroll-driven) |
| Product cards | 3D tilt toward the pointer, gold light follows the cursor, second image crossfades | `Tilt` + `.sheen` |
| Category tiles, ritual steps | Image collage zooms, arrow spins, card lifts | CSS transitions |
| Header | Transparent over the light home hero, frosted glass with shadow after scroll; links underline-draw; cart badge pops on change | `Header` |
| Mobile menu | Night drawer slides in, links stagger | `drawer-in`, `.rise` |
| Packages | Rotating gold border | `.gold-ring` (`@property --a`) |

Polish pass: reveals 700 ms (was 900), page fade 350 ms, intro lifts at about 1.15 s, headline word stagger 55 ms. Loading skeletons with a shimmer on shop, category, search and product routes (`components/skeletons.tsx`). "Added to cart" toasts with product image and a View cart link (`Toaster`, `toast()`; `aria-live="polite"`). Branded 404 and error pages; the error page shows only a reference digest. Pill buttons use a shape-following focus ring.

Night surfaces now appear only in the footer and the mobile menu; the hero, ticker and packages band are light.

Rules:
- `prefers-reduced-motion: reduce` turns all of it off: CSS durations collapse, `Reveal` shows immediately, smooth scrolling, `GoldDust`, `Tilt`, `Magnetic`, `Parallax`, `ScrollVar`, `CountUp` and the pinned gallery never attach, the progress line hides, and the tickers stop.
- Pointer effects attach only on fine pointers (`hover: hover`).
- Content is never hidden without JavaScript (`@media (scripting: none)`).
- Headline text stays one real string for search engines and screen readers.
- No WebGL, no autoplay video and no before/after sliders, because no authentic assets for them exist.
