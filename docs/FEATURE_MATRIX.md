# Feature matrix

Labels: **Verified** = implemented and verified; **Implemented** = code exists, partially tested; **Provider setup required**; **Blocked by business decision**; **Not implemented**.

| Area | Feature | Status | Evidence |
| --- | --- | --- | --- |
| Migration | Crawl + URL ledger, Store API + WP REST capture | Verified | `data/source/url-ledger.jsonl`, `crawl-summary.json` |
| Migration | Normalization with per-field observations, conflict detection | Verified | `products.normalized.json`, `packages.observations.json` |
| Migration | Media download (SSRF guard, magic-byte sniffing, size cap) | Verified | `assets.manifest.json` |
| Migration | Idempotent import, merchant-edit protection, dry run | Verified | C09 test |
| Migration | Admin migration review (coverage, runs, exceptions, resolve) | Implemented | `/admin/migration` |
| Catalogue | Published products, categories, search, sort, in-stock filter, pagination | Verified | `/shop`, HTTP |
| Catalogue | Product detail with featured vs. full ingredients distinction, JSON-LD matching page | Implemented | `/products/[slug]` |
| Catalogue | Ingredient library (mapping only; no invented explanations) | Implemented | `/ingredients` |
| Catalogue | Compare | Not implemented | No compare control is shown |
| Catalogue | Reviews: display of published, moderated reviews | Implemented (none published) | — |
| Catalogue | Review submission / moderation UI | Not implemented | — |
| Cart | Server cart, guest token cookie, quantity, remove, undo | Verified (browser) | `/cart` |
| Cart | Guest→user merge on sign-in | Implemented, untested | `POST /v1/carts/merge` |
| Checkout | Server quote, PIN/phone validation, delivery rule, repricing on change | Verified | C07, browser |
| Checkout | Idempotent order placement, atomic FEFO reservation | Verified | C04, C05 |
| Payments | Razorpay | Provider setup required + Not implemented | M-007 |
| Payments | Development manual method (labelled, unpaid) | Verified | D-013 |
| Tax | GST computation / invoices | Blocked by business decision | M-003 |
| Orders | State machine (placed/confirmed/cancelled/closed), audit, outbox | Verified | tests, browser |
| Orders | Reservation expiry job | Verified | test |
| Orders | Guest tracking by high-entropy token (no address) | Verified | `/track-order` |
| Fulfilment | Shipments from committed stock (batch assigned earliest-expiry first), partial shipments, dispatch with carrier/tracking, delivered, void packing shipment | Verified | operations tests, browser |
| Fulfilment | Line-level cancellation (restocks same batch); whole-order cancel after confirm restocks; refused once dispatched; close only when fully delivered | Verified | operations tests, browser (close refusal) |
| Fulfilment | Carrier/shipping-label integration, pick lists, courier tracking sync | Not implemented / provider setup required | — |
| Returns | Customer self-service request (owner only, delivered units, window from setting, idempotent) | Verified (development return window) | tests, browser (double-click → 1 return) |
| Returns | Staff approve/reject → receive into quarantine (by shipped batch) → inspect: restock or dispose | Verified | tests, browser, ledger check |
| Returns | Return shipping labels, photo evidence uploads | Not implemented | — |
| Refunds | Request/approve with second approver, refundable-balance ledger, development recording | Verified | tests, browser (self-approval 403) |
| Refunds | Money movement through Razorpay | Provider setup required + Not implemented | M-007; approval returns 503 and nothing is sent |
| Inventory | Balances, batches, receipts, immutable ledger, quarantine/expiry exclusion | Verified (receipt UI implemented) | tests, `/admin/inventory` |
| Packages | Evidence review, approval with explicit paid/free split + 2FA | Implemented | `/admin/packages` |
| Packages | Quote requests | Verified (HTTP) | `POST /v1/quotes` |
| Packages | Package checkout | Blocked by business decision | M-001 |
| Account | Sign up/in/out, reset, verify email (via outbox), 2FA enrolment | Implemented | `/login`, `/account/settings` |
| Account | Orders list/detail with parcels, carrier/tracking, customer-safe timeline, returns | Verified (browser) | `/account/orders/[id]` |
| Account | Wishlist, addresses, rewards, subscriptions, profile edit, privacy requests | Not implemented | honest pages |
| Partner | Application save/submit, admin decision state machine, account creation on approval | Implemented | `/partners/apply`, `/admin/applications` |
| Partner | Document upload/KYC | Not implemented | — |
| Partner | Workspace overview (session-scoped) | Implemented | `/partner` |
| Partner | Wholesale ordering, quotes→orders, stock, team, resources, training, commissions, settlements | Not implemented | honest pages |
| CRM | Contact enquiries with reference, follow-up task, consent event | Verified (HTTP) | `/contact` |
| CRM | Newsletter with consent + dedupe | Implemented | footer |
| Content | Articles/policies/pages render only when published; pending states otherwise | Implemented | `/journal`, `/policies/*` |
| Content | CMS editor, versions, publish UI | Not implemented | — |
| Admin | Overview with defined metrics, alerts, queues, date range (IST) | Implemented | `/admin` |
| Admin | Product publish/unpublish (with price approval) | Implemented | `/admin/products` |
| Admin | Delivery rule settings (versioned) | Implemented | `/admin/settings` |
| Admin | Team/roles UI, audit viewer, exports, analytics charts, global search | Not implemented | — |
| Platform | RBAC permission bundles, owner bootstrap CLI, dev seed refuses production | Implemented | `seed-reference.ts`, `bootstrap-owner.ts` |
| Platform | Outbox + worker + dev mail sink | Verified | worker tick |
| Platform | Real email provider, WhatsApp API, analytics provider | Provider setup required | INTEGRATIONS |
| SEO | Legacy redirects, sitemap, robots (noindex unless ALLOW_INDEXING), canonical, private routes noindex | Implemented | `next.config.ts` |
