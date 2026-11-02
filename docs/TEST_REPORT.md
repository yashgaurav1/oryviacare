# Test report

Environment: Windows 11, Node 24.22.0, PostgreSQL 18 (embedded-postgres), database `oryvia_app_test`. Date: 2026-10-31.

## Automated

| Command | Result |
| --- | --- |
| `npm run typecheck` (all 5 workspaces) | Pass, 0 errors |
| `npm run test:api` (vitest, real PostgreSQL) | **28 passed, 0 failed, 0 skipped** (13 commerce + 15 operations) |
| `npx next build` (apps/web) | Pass |
| Lint | **Not run**: no linter configured yet |
| Playwright / axe | **Not run**: not set up yet |

### Integration tests (`apps/api/test/commerce.int.test.ts`)
| Brief ID | Test | Result |
| --- | --- | --- |
| C05 | 2 buyers for the last unit → exactly 1 order, other gets `stock_unavailable`; balance 1 on hand / 1 reserved | Pass |
| C05 | 10 concurrent buyers for 3 units → exactly 3 orders | Pass |
| C04 | 3 concurrent requests with one idempotency key → 1 order, 1 payment attempt, 2 reserved; replay returns same order | Pass |
| C04 | Same key, different body → `idempotency_conflict` | Pass |
| C07 | Forged quote hash rejected, no order written | Pass |
| C07 | Unapproved price → `not_purchasable` | Pass |
| - | No delivery rule → checkout refused | Pass |
| - | Cancel releases reservation; confirm commits stock with −2 ledger row; dev order stays unpaid; cancelled order cannot be confirmed | Pass |
| - | Expired reservation → order cancelled, stock released; second run is a no-op | Pass |
| - | Stock ledger UPDATE/DELETE blocked by trigger; negative reserved blocked by CHECK | Pass |
| - | Quarantined and expired batches excluded from available stock | Pass |
| C10 | DB refuses an approved package version without price/approver | Pass |
| C09 | Import run twice into the test DB → identical counts (7 products, 4 package versions, media, observations, exceptions); nothing published | Pass |

### Operations tests (`apps/api/test/operations.int.test.ts`), added 2026-10-31 (session 2)
| Test | Result |
| --- | --- |
| Partial shipment takes the earliest-expiring batch first; over-shipping refused; state goes packing → partially shipped → shipped → delivered; close refused until delivered | Pass |
| Shipment refused for unconfirmed order and for a stale version | Pass |
| 3 concurrent identical shipment requests → exactly 1 shipment | Pass |
| Voiding a packing shipment reopens its units; dispatching a voided shipment is refused | Pass |
| Cancelling a confirmed order restores committed stock; ledger sum equals balances | Pass |
| Cancelling a confirmed order after dispatch is refused | Pass |
| Line cancel cannot exceed open units; cancelled units return to stock | Pass |
| Customer returns closed when no return policy is configured | Pass |
| Return: another customer gets 404; more than delivered refused; 2 concurrent requests → 1 return | Pass |
| Return window closes after the configured days | Pass |
| Received units sit in quarantine and are not available to sell; restock moves them back; second inspection refused | Pass |
| Restock refused for a recalled batch; disposal writes off; ledger sum equals balances | Pass |
| Refund: requester cannot approve; over-refund refused; second person records it; rejected refund frees the balance | Pass |
| 3 concurrent refund requests each over half the payment → exactly 1 accepted | Pass |
| No captured payment → refund refused; real-money approval needs 2FA; with 2FA and no provider → 503, refund stays requested | Pass |

Mutation check: reversing the batch ordering in `unshippedPool` makes the FEFO test fail (then restored).

## Manual verification (HTTP and browser), 2026-10-31

| Check | Evidence | Result |
| --- | --- | --- |
| Anonymous → admin API | 401 `unauthenticated` | Pass |
| Customer → admin API, incl. forged `x-role`/`x-user-id` headers | 403 `forbidden` | Pass (C14 partial) |
| Customer reads another order via account route | 404 | Pass |
| Stale version on order transition | 409 `stale_version` | Pass |
| Razorpay selected without keys | 503 `integration_unavailable` | Pass |
| Browser: product → Buy now → checkout → server validation error → review → **double-click** Place order | One order `ORY-S5RW9-H23BD` in DB | Pass |
| Browser: admin sign-in → order → Confirm with reason | State confirmed, reservation committed, reason on timeline | Pass |
| Worker tick | 6 outbox events → 6 delivery records (dev mail sink) | Pass |
| 52 web routes as signed-in admin | All 200, unknown slugs 404, legacy URLs 308 to new routes | Pass |
| 375 px width: home, product, admin orders | No horizontal overflow | Pass |
| Browser (session 2): customer buys 2 → admin confirms → ships 1 (lot DEV-LOT-1, carrier + tracking) → delivered; Close refused with "undelivered units" | `ORY-LFBDQ-UQVTY` | Pass |
| Browser: customer sees parcel, carrier, tracking and friendly timeline; **double-click** Request return → one return `RET-XVSM3-JRSLY` | DB: 1 return | Pass |
| Browser: admin approves → receives (quarantine) → restocks; ledger: +25 receipt, −2 sale, +1 quarantine, −1 quarantine, +1 sellable; balances 24 = ledger 24 | script output | Pass |
| Browser: admin requests ₹399 refund; self-approval hidden in UI and 403 from API; finance operator approves → `recorded_development` | DB | Pass |
| Finance operator → create shipment API | 403 | Pass |
| Guest tracking after return/refund | No address, no returns list, parcels shown | Pass |
| Signed-out customer return request | 401 | Pass |
| 375 px: admin order detail with fulfilment panel | No horizontal overflow | Pass |
| `next build` after session 2 changes | Pass | Pass |

## Design pass (session 3), 2026-10-31
| Check | Result |
| --- | --- |
| `next build`, web typecheck | Pass |
| No horizontal overflow at 375 px: home, shop, product, login, cart, checkout, partner apply, admin | Pass (DOM measurement) |
| Pinned range showcase at 1440 px: sticks at top, track halfway across at halfway scroll | Pass |
| "Meet the range" story: pins; product name advances through all five as scroll progresses | Pass (scroll events dispatched by script) |
| Intro: plays on a fresh session, hidden on return visits | Pass |
| Product gallery thumbnails switch the main image | Pass |
| Add to cart from a product card shows a toast (name, View cart link) and the badge reads "Cart, 1 item" | Pass (test item removed afterwards) |
| Unknown URL shows the branded 404 page with HTTP status 404 | Pass |
| Sticky buy bar appearing after scrolling past the buy box | **Not verified**: the browser pane was hidden, which suspends IntersectionObserver delivery |
| Visual review of animations | Partial: the pane was minimised for much of the session, so most checks were DOM measurements rather than screenshots |

## Staging deployment on Render, 2026-11-01
| Check | Result |
| --- | --- |
| Both deploys report `live` (commit 776ce5b) | Pass |
| `/api/health/ready` | 200 |
| Website home, shop, register | 200 |
| Unknown page | 404 |
| `/media` images through the website | Pass (PNG 1.5 MB, JPEG 222 KB) |
| `robots.txt` disallows all; pages carry `noindex` | Pass |
| Admin API anonymous | 401 |
| Sign-in with a non-existent account | 401 `INVALID_EMAIL_OR_PASSWORD` |
| Real account registered by the owner reached the live database | Pass |
| Owner role granted once via `bootstrap:owner` | Pass (`owners: 1`) |
| All 7 products published at the owner's request (audit-logged); warehouse MAIN created | Pass |
| Product images: 2 per product, raw and optimised both 200 | Pass |
| Owner sign-in to `/admin` | Reported working by the owner (screens seen); not independently tested |
| Add to cart with real stock, two-factor enrolment on staging | **Not yet verified** (no stock entered) |

### Sleeping API (2026-11-02)

First fix (`e98b348`, server-side retries) passed against a stand-in but failed live: after 17 idle minutes `/shop` waited 165 s and returned 500, and the API log showed no restart. An outside request then woke it in 53 s. The server-side wait was removed.

Replacement, tested in a browser against a stand-in that returns 502 until the browser calls it: "Opening the store" showed, the browser woke it, and the shop opened by itself with the full page. With a healthy API, a failed page still shows the normal error.

Live on Render (`c459866`), browser opening `/shop` after 17 idle minutes: Render's own loading page for about 45 s, then "Opening the store", API restart logged at 06:08:38, shop open by itself by 06:08:53, with products and footer. About 1 min 50 s in total, no error shown. Not tested: a write (add to cart, sign in) from a tab left open while the API fell asleep; expect an error until the page is refreshed.

## Not verified
- C01 URL-state filters exercised only via HTTP status, not browser back/forward.
- C02 cart merge: code path exists, not covered by a test.
- Shipments spanning two warehouses (code creates one shipment per warehouse): not covered by a test; only one sellable warehouse exists in development.
- Dev server note: Turbopack served a stale `order-timeline.tsx` until the dev server was restarted; the production build was clean.
- C03, C06 (real payment provider), C08, C11, C12 end-to-end, C13, C15–C20: not implemented or not tested.
- Accessibility audit, performance (Core Web Vitals), backup/restore, dependency/secret scanning: not run.
