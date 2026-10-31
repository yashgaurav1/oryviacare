# Source audit — oryviacare.in

Crawl run: 2026-10-31 02:23–02:24 UTC. Evidence: `data/source/` (raw snapshots under `raw/`).

## Scope and coverage

Scope: public, unauthenticated pages reachable from `robots.txt` → sitemap index (6 sitemaps) and internal links; plus the public WooCommerce Store API (`/wp-json/wc/store/v1/products`, categories, reviews) and WP REST (`/wp-json/wp/v2/pages`, `posts`). Rate-limited (≥0.9 s/request), approved host only, SSRF-guarded.

Excluded by design: cart, checkout, account and auth routes; `add-to-cart`/wishlist/compare action URLs; faceted filter URLs (robots disallow); author archives (personal data).

| Count | Value |
| --- | ---: |
| URLs discovered (ledger rows) | 111 |
| Fetched | 46 |
| Parsed | 43 |
| Excluded | 65 (56 action URLs, 9 account/auth/cart/checkout/author) |
| Failed | 3 (all 404 on the live site) |
| Duplicates | 0 |
| Unresolved | 0 |
| Store API products | 11 (7 simple, 4 bundles), no pagination beyond page 1 |

Content types: 11 product pages, 3 product categories (Skin Care, Hair Care, Packages), 5 blog posts, 17 WP pages (several are shortcode-only auth pages), shop, home.

## Findings

### Pricing — blocker
- **Strike-through prices exceed printed MRP.** Back-label photo of the Face Scrub shows *M.R.P. ₹399.00 (incl. all taxes)*; the Gold 6 Step Facial Kit box shows *M.R.P. ₹499*. The site shows ₹999 struck through on both. All other products show a similar ~2× "original price". These readings are OCR candidates (`visual-review.json`) and need merchant confirmation, but until then no reference price is displayed.

### Packages — blocker (all four)
| Package | Store API / purchase area | Narrative "Package Price" | Store API "regular" | Narrative "original value" | Widget units | Narrative units |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Starter | ₹11,599 | ₹10,000 | ₹42,361 | ₹15,862 | 39 | 36 + 4 = 40 |
| Professional | ₹23,999 | ₹20,000 | ₹82,726 | ₹31,724 | 74 | 72 + 6 = 78 |
| Premium | ₹37,199 | ₹30,000 | ₹1,22,294 | ₹47,586 | 106 | 92 + 11 = 103 |
| Ultimate | ₹59,999 | ₹50,000 | ₹1,90,332 | ₹79,310 | 168 | 145 + 23 = 168 |

The bundle widget does not mark components as paid or complimentary; narratives say "Herbal Facial Kit" without identifying Gold vs. Haldi Chandan. Note: the homepage crawled today no longer shows the ₹10k–₹50k package section the brief observed; those figures survive only in product narratives.

### Media — high
- Hero and "Herbal Beauty Collection" images are **rendered marketing composites** whose label text contradicts itself and product pages (Face Wash "Vitamin C" vs "Vitamin E"; Anti-Hairfall "Onion Extract, Ceramide NP" vs "Bhringraj, Caffeine, Biotin, Keratin"; Scrub 200 g vs 100 g). Never used as evidence.
- Category "images" are generic line icons.
- 49 originals downloaded (26 MB), 82 derivative sizes recorded but not downloaded, 7 failed (off-host avatars, blocked by allow-list).

### Content and contact — high
- WhatsApp placeholder `wa.me/91XXXXXXXXXX` alongside the real number; social links are template placeholders (`instagram.com/yourhandle` etc.).
- Homepage FAQ answers for returns and payment are unfilled templates (`[Write your actual policy here…]`).
- About page contains bracketed placeholder `[Rampur,UP]`; contact page shows "Your address".
- Links to `/wishlist/`, `/shipping-policy/`, `/refund-policy/` return 404.
- `/10305-2/` (title ".") duplicates the shop and appears as a breadcrumb step; `/erp-subscription/` is empty.

### Catalogue — medium/low
- No SKUs are published; JSON-LD `sku` equals the WordPress post ID.
- Store API omits categories for the 5 skincare products; the page breadcrumbs carry "Skin Care". Normalizer merges both and logs it.
- Full ingredient lists are not published (pages refer to packaging). Only the Face Wash publishes "Key Ingredients Highlighted" and net quantity (200 ml).
- One review ("Priya S.", Face Wash) appears in HTML but not in the Store API reviews endpoint; provenance unknown → not imported as published.

## Registers
- `data/source/migration-exceptions.csv` — 71 rows (blocker/high/medium/low), also in Admin → Migration review.
- `data/source/redirects.csv` — legacy → new mapping; 3 URLs need a merchant decision.
