# Build status

Last updated: 2026-10-31 (Asia/Kolkata). Session 2: fulfilment, returns and refunds added.

## Staging deployment (2026-11-01)

| Piece | Where |
| --- | --- |
| Website | https://oryviacare-web.onrender.com (Render service `oryviacare-web`, free, Oregon) |
| API | https://oryviacare.onrender.com (Render service `oryviacare`, free, Oregon; job loop runs in-process) |
| Database | Render Postgres `oryvia-db` (PostgreSQL 18, free: **expires 30 days after creation**) |
| Code | https://github.com/yashgaurav1/oryviacare, branch `main`, auto-deploys on push |

The services were created by hand and through the Render API, not from the blueprint, so their names differ from `render.yaml` (`oryvia-api`, `oryvia-web`). Search engines are blocked (`ALLOW_INDEXING=false`). All 7 products are published at the owner's request at old-site prices (merchant price confirmation still open, M-002). Warehouse `MAIN` exists; stock quantities and the delivery rule are not entered, so products show out of stock. No payments, tax or email provider yet. Free services sleep after 15 minutes idle. Requests from the website's server do not wake the API (seen live: 502 for over 2 minutes, while an outside request woke it in 53 s), so when a page fails with the API down, the visitor's browser wakes it through `NEXT_PUBLIC_API_URL` and reloads (`apps/web/src/components/api-wake-gate.tsx`). The first visit after a quiet spell takes a minute or two; a paid plan removes this.

## Where the build stands

| Phase (brief §22) | State |
| --- | --- |
| A: Ground the business and data | **Done for the public surface.** Crawl, ledger, normalization, media download, visual review, idempotent import, exception register. |
| B: Running foundation | **Done.** Monorepo, real PostgreSQL, Prisma migrations with DB-level invariants, Better Auth sessions, RBAC, outbox + worker, env validation. Object storage = local filesystem adapter (public media only); private uploads not built. |
| C: One complete commerce path | **Done and verified** with a labelled development payment method. Razorpay adapter **not implemented** (no test keys). |
| D: Full design and consumer experience | **Partly done.** Home, shop/category/search, product, ingredients, packages, business, journal, policies, about/contact/FAQ/careers, cart, checkout, tracking, auth, account (overview/orders/settings + 2FA). Wishlist, addresses, rewards, subscriptions, compare, reviews submission: **not implemented** (honest pages). |
| E: Operational platform | **Partly done.** Admin overview (incl. ship/return/refund queues), orders (list/filter/detail/transitions), **fulfilment** (shipments from committed batches, partial shipments, dispatch, delivered, void, line cancellation), **returns** (approve/reject, receive into quarantine, restock/dispose), **refunds** (two-person approval, refundable-balance ledger; money movement needs Razorpay), products (publish/unpublish), packages (evidence + approval), migration review, inventory, enquiries/quotes, partner applications, delivery settings. Not built: product editor, CMS editor, courier/label integration, CRM, analytics charts, exports, team/roles UI, audit viewer, job monitor. |
| F: Professional operations | **Started.** Application wizard (save/submit), admin decisions with state machine, approval creates business account + owner membership, partner workspace overview. Not built: wholesale ordering, partner price lists, quotes→orders, stock requests, team invitations, resources/training, commissions/settlements UI. |
| G: Integrations and hardening | **Not started** beyond the dev mail sink. |
| H: Release and handoff | **Not started.** |

## Exact commands to resume

```bash
npm install
npm run db:start              # terminal 1: keeps running (embedded PostgreSQL on :54329)
npm run db:migrate
npm run seed:reference
npm run import:apply          # loads data/source into the DB (idempotent)
npm run seed:dev              # DEVELOPMENT ONLY: dev-publishes products, DEV stock, dev shipping rule, dev accounts
npm run dev:api               # terminal 2: http://127.0.0.1:4000/api (docs at /api/docs)
npm run dev:worker            # terminal 3
npm run dev:web               # terminal 4: http://localhost:3000
npm run test:api              # integration tests against oryvia_app_test
```

Dev account credentials are generated randomly into `.data/dev-accounts.json` (git-ignored).

## Next steps, in order

1. Razorpay adapter (order create, checkout handoff, signed webhook with raw body, replay dedupe, late-payment handling, **refund execution** for approved refunds): needs merchant **test** keys.
2. Product/CMS editors (draft → review → publish, versions) so merchant edits stop depending on import.
3. Wishlist, saved addresses, customer cart-merge UI report.
4. Partner wholesale ordering + partner price lists + quote → order conversion.
5. Playwright browser suite + axe accessibility checks; deployment runbook.
6. Courier/label integration once the merchant picks a carrier (M-004).

Done in session 2 (was steps 2–3): fulfilment and returns/refunds. See TEST_REPORT "Operations tests" and DECISIONS D-016…D-021.

## Known issues

- On phones the admin sidebar is stacked above the content, so each admin page opens on the menu (no overflow, but slow to reach content). A collapsible menu is not built yet.
- Next dev (Turbopack) once kept serving a stale shared component until restarted; restart `npm run dev:web` if a change does not appear.
- Shipments that span two sellable warehouses are supported in code (one shipment per warehouse) but not covered by a test.

- Legacy redirects take two hops (`/product/x/` → `/product/x` → `/products/x`) because Next strips the trailing slash first. Functionally correct; one-hop is preferable for SEO.
- Old WIN1252 databases `oryvia` and `oryvia_test` remain in the local cluster (unused). Drop them manually if wanted; the agent did not drop databases.
- `next build` and `next dev` share `.next/`; stop the dev server before building.
- Rate limiting for Better Auth uses in-memory storage (single process only).
