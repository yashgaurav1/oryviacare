# Routes and flows

## Web (apps/web): all routes render; "pending" means an honest not-yet-available state
| Route | State |
| --- | --- |
| `/`, `/shop`, `/category/[slug]`, `/search`, `/products/[slug]` | Live data |
| `/ingredients`, `/ingredients/[slug]` | Live mapping; explanations pending editorial review |
| `/journal`, `/journal/[slug]` | Live; articles appear once published |
| `/packages`, `/packages/[slug]` | Live; quote form works; prices hidden until approved |
| `/business`, `/partners/apply` | Live |
| `/about` | Pending (source has placeholder text) |
| `/contact` | Live form; direct contact hidden until verified |
| `/faq`, `/careers` | Live (careers: honest no-openings) |
| `/policies/{privacy,terms,shipping,returns}` | Pending approval |
| `/cart`, `/checkout`, `/checkout/result`, `/track-order` | Live |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Live |
| `/account`, `/account/orders`, `/account/orders/[id]`, `/account/settings` | Live |
| `/account/{wishlist,addresses,rewards,subscriptions}` | Pending (not implemented) |
| `/partner` | Live for approved partners |
| `/partner/{orders,stock,quotes,commissions,settlements,resources,training,team,settings}` | Pending (not implemented) |
| `/admin`, `/admin/{orders,orders/[id],products,packages,migration,inventory,returns,returns/[id],refunds,enquiries,applications,settings}` | Live |

Legacy WordPress URLs redirect (308) per `apps/web/src/lib/legacy-redirects.json`.

## API (apps/api): OpenAPI at `/api/docs`, JSON at `/api/openapi.json`
`/api/auth/*` (Better Auth) · `/api/health/{live,ready}` · `/api/v1/catalog/*` · `/api/v1/packages` · `/api/v1/{contact,quotes,newsletter}` · `/api/v1/content/*` · `/api/v1/carts/*` · `/api/v1/checkout/{payment-methods,quote,orders}` · `/api/v1/track` · `/api/v1/account/{me,orders,orders/:id/returns}` · `/api/v1/partner/*` · `/api/v1/admin/*` (incl. `orders/:id/{operations,shipments,cancel-lines,returns,refunds}`, `shipments/:id/{dispatch,deliver,cancel}`, `returns[/:id[/decide|/receive]]`, `return-lines/:id/inspect`, `refunds[/:id/decide]`)

## Purchase flow
Product → Add to cart (server cart, guest cookie) → Checkout details → `POST /checkout/quote` (server prices, delivery rule, hash) → Place order with `Idempotency-Key` → server re-quotes; if the hash changed, the UI shows the new total → order + reservation (30 min) → result page reads the order from the server by tracking token → admin confirms (requires captured payment, or a development order) → stock committed.

## Fulfilment, returns and refunds
Confirmed order → **Create shipment** (choose units per line; batches taken from the order's committed stock, earliest expiry first; one shipment per warehouse) → *packing* → **Dispatch** (carrier, optional tracking) → *shipped* → **Mark delivered** → *delivered*. A packing shipment can be voided. Unshipped units can be cancelled per line (stock goes back to the same batch). Cancelling a confirmed order restocks everything unshipped and is refused once anything is dispatched. **Close** is allowed only when every live unit is delivered.

Delivered units → customer **Return items** (needs a `returns.policy` setting with a window; staff can open a return any time) → *submitted* → staff **Approve/Reject** → **Record items received**: units enter the `RETURNS-QUARANTINE` location (excluded from available-to-sell) under the batch they shipped from → per line **Restock** (refused if the batch is expired, recalled or on hold) or **Dispose** → *inspected*.

Refund: finance **Request refund** (≤ refundable balance, optionally linked to a return) → a *different* finance user **Approves** (development orders: recorded, no money moves; real payments: 2FA required, then refused with 503 until the Razorpay refund adapter exists) or **Rejects**.
