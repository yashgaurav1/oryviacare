# Decision register

Technical decisions (made, reversible) and commercial decisions (blocked on the merchant).

## Technical decisions

| ID | Decision | Why | Reversal |
| --- | --- | --- | --- |
| D-001 | npm workspaces (not pnpm) | pnpm not installed; npm 11 lockfile is reproducible. | Swap package manager; no code changes. |
| D-002 | Local PostgreSQL via `embedded-postgres` (real PG 18 binaries) | Docker is not installed on the dev machine. It is real PostgreSQL, not an emulation. | Point `DATABASE_URL` at any PostgreSQL 16+; nothing else changes. |
| D-003 | Databases created explicitly UTF-8 (`oryvia_app`, `oryvia_app_test`) | The cluster inherited Windows WIN1252, which cannot store `₹`. | — |
| D-004 | Durable jobs polled from PostgreSQL (`outbox_events`, `FOR UPDATE SKIP LOCKED`) instead of Redis/BullMQ | Redis not available; PostgreSQL already gives transactional enqueue with the order. One fewer service. | Introduce BullMQ behind `runJobsOnce` if throughput requires. |
| D-005 | NestJS 11 (legacy line, maintained) rather than 12 | Nest 12 is very new; 11 has well-understood decorator/DI behaviour. Run via SWC (`@swc-node/register`) so decorator metadata works in ESM. | Upgrade when 12 stabilises. |
| D-006 | Prisma 7.10 (stable) not 8.0 | npm `latest` tag points at `8.0.0-rc.29`, a release candidate. | — |
| D-007 | TypeScript 5.9 (not 7.0) | TS 7 (native) is new; NestJS decorator metadata relies on `emitDecoratorMetadata` behaviour verified on 5.x. | — |
| D-008 | Better Auth 1.7 mounted inside the API at `/api/auth/*` | One maintained self-hosted library, DB sessions via its Prisma adapter, official Node handler. The API resolves sessions itself; Next.js never validates them. Telemetry disabled. 2FA plugin enabled. | — |
| D-009 | Single origin: Next.js rewrites `/api/*` and `/media/*` to the API | Same-site cookies, no CORS surface. | — |
| D-010 | Worker is an entrypoint of the API package (`src/worker.ts`), not `apps/worker` | Shares domain code without a second package boundary. Still a separate process. | Extract when domain code moves to a shared package. |
| D-011 | Brand mark is a typographic "ORYVIA" wordmark | The source site configures no image logo (`data-logo=""`); header renders the text "Oryvia". No logo was invented. | Replace when the merchant supplies a logo file. |
| D-012 | Unverified "original price" values are never shown as strike-through | Packaging photos show printed MRP ₹399 / ₹499 while the site shows ₹999 struck through (see SOURCE_AUDIT). | Merchant classifies reference prices. |
| D-013 | `dev_manual` payment method, enabled only by `ALLOW_DEV_MANUAL_PAYMENT=true` and refused in production | Lets the full order path be exercised without a payment provider; orders are flagged `isDevelopmentOrder`, payment stays unpaid. | Remove when Razorpay sandbox is wired. |
| D-014 | Tax not computed (`taxPaise = 0`, inclusive mode, explicit note) | HSN/GST rates and seller GSTIN are not supplied; inventing a rate is prohibited. Orders snapshot the "not computed" state. | Merchant tax configuration. |
| D-015 | Checkout blocked until a delivery rule exists | No delivery charge or serviceability evidence exists. Dev seed creates a rule labelled as development. | Merchant sets rule in Admin → Store settings. |
| D-016 | Stock leaves sellable balances at **confirmation**; shipments only record which committed batch units left | Keeps one decrement point (already tested for races). Ledger rows tagged `order:<id>` are the order's pool, so shipments, line cancels and order cancels are derived from the ledger, not a second counter. | Move the decrement to dispatch if the merchant wants confirmed-but-unshipped stock counted as on hand. |
| D-017 | Returned goods go to a `RETURNS-QUARANTINE` location (`warehouses.kind = 'quarantine'`, excluded from available-to-sell) and leave it only by an inspection decision | Cosmetics must not be resold without inspection; batch identity is kept for recalls. | — |
| D-018 | Customer self-service returns are off until a `returns.policy` setting (window in days) exists; staff can open returns any time | No approved returns policy exists (M-005). Dev seed writes a 7-day **development** window, labelled as such on the page. | Merchant sets the window (M-013). |
| D-019 | Refunds need a second person (requester ≠ approver); approving a real-money refund also needs 2FA | Money control. Dev seed adds a `finance_operator` account so the flow can be exercised. | If Oryvia runs with one operator, add an explicit owner override setting (not built). |
| D-020 | Refund approval never pretends to move money: development orders are recorded as `recorded_development`; provider payments get 503 until the Razorpay refund adapter exists | Honest status labels. | Razorpay refund adapter (M-007). |
| D-021 | Customer order timeline shows an allow-list of events; staff reasons stay internal except a return-rejection note written for the customer | Previously staff transition reasons were visible to customers. | — |
| D-022 | Visual system "Kohl, Kesar & Copper": night sections, saffron gold, copper links; Fraunces, Manrope, Marcellus; CSS and canvas motion, plus Lenis for smooth scrolling (pinned 1.3.26, the newest release older than two weeks) | Matches the real packaging (black and gold boxes, green bottles with copper pumps, gold dust). CSS, IntersectionObserver and one small canvas keep pages server-rendered and the bundle small. | Tokens in `globals.css`; motion primitives in `components/motion.tsx` and `kinetic.tsx`. |

## Commercial decisions blocked on the merchant

| ID | Needed from Oryvia | Blocks |
| --- | --- | --- |
| M-001 | Approved price, paid/complimentary split and component SKUs for each of the 4 packages | Package sale (quote requests work) |
| M-002 | Classification of every "original price" (MRP vs. promotional reference) | Showing discounts |
| M-003 | Legal entity name, address, GSTIN, HSN codes, GST rates | Tax calculation, invoices |
| M-004 | Delivery charges, serviceable areas, delivery times | Real shipping rule, shipping policy |
| M-005 | Approved privacy, terms, shipping and returns policy text | Publishing policies (all show "awaiting approval") |
| M-006 | Verified phone, email, WhatsApp, social handles | Public contact details (currently hidden) |
| M-007 | Razorpay account and **test** keys; enabled methods (UPI/cards/COD?) | Online payment |
| M-008 | Partner programme terms: price lists, MOQ, credit, commission (if any) | Partner ordering, commissions |
| M-009 | Confirmation of full ingredient lists, net quantities and label facts (OCR candidates in `data/source/visual-review.json`) | Complete product facts |
| M-010 | Whether the single HTML-only review on Face Wash is genuine and consented | Showing reviews |
| M-011 | Rights confirmation for source imagery; real category imagery | Media publication beyond development |
| M-012 | Authorized WooCommerce export (customers/orders) if historic data should migrate | Private data migration |
| M-013 | Return window (days), which items are returnable (opened cosmetics?), and whether one person may approve refunds | Customer self-service returns in production; single-operator refunds |
