# Control inventory (shipped pages)

| Page | Control | Action / endpoint | Permission | Persistence | Errors | Verified |
| --- | --- | --- | --- | --- | --- | --- |
| Header | Search (`/`, Ctrl+K) | `GET /v1/catalog/products?q=` | public | — | inline message | manual |
| Header | Cart badge | Updates from cart responses | — | server cart | — | browser |
| Header | Mobile menu | Drawer with focus on close | — | — | — | manual |
| Footer | Newsletter subscribe | `POST /v1/newsletter` (consent required) | public | `newsletter_subscriptions`, `consent_events` | field error | HTTP |
| Shop/category/search | Filter form (q, sort, in-stock), pagination links | GET with URL params | public | URL | retry link | HTTP |
| Product card / detail | Add to cart, Buy now, quantity stepper | `POST /v1/carts/current/items` | public | `cart_items` | inline | browser |
| Cart | Quantity ±, Remove, Undo | `PATCH`/`DELETE`/`POST …/restore` | cart owner | `cart_items` | banner | manual |
| Checkout | Continue to review | `POST /v1/checkout/quote` | cart owner | — | field errors | browser |
| Checkout | Place order | `POST /v1/checkout/orders` + Idempotency-Key | cart owner | orders, reservations | banner; reprice notice | browser (double-click) |
| Track order | Token link | `GET /v1/track?token=` | token holder | — | invalid-link message | HTTP |
| Contact | Send enquiry | `POST /v1/contact` | public | enquiry, task, consent, outbox | field errors | HTTP |
| Package detail | Request a quote | `POST /v1/quotes` | public | quote, task, outbox | field errors | — |
| Auth pages | Sign in/up, reset, sign out | `/api/auth/*` | public | Better Auth tables | generic (no enumeration) | browser (sign-in) |
| Account settings | Two-factor enable/verify | `/api/auth/two-factor/*` | self | `two_factors` | banner | — |
| Partner apply | Save draft / Submit | `POST /v1/partner/applications[?submit=1]` | signed in | application, consent, outbox | field errors | — |
| Admin overview | Date range | GET params → query | orders.read | — | — | manual |
| Admin orders | Filters, pagination | GET params | orders.read | — | empty state | manual |
| Admin order | Confirm / Cancel / Close (reason, version) | `POST /v1/admin/orders/:id/transition` | orders.transition | order, events, audit, stock | 409 stale | browser |
| Admin order | Create shipment (units per line) | `POST /v1/admin/orders/:id/shipments` | orders.fulfil | fulfilments, lines (batch), events, audit | 409 stale / over-quantity | browser + tests |
| Admin order | Dispatch (carrier, tracking) / Mark delivered / Void shipment | `POST /v1/admin/shipments/:id/{dispatch,deliver,cancel}` | orders.fulfil | fulfilment, events, audit, outbox | 409 wrong state | browser + tests |
| Admin order | Cancel unshipped units (reason) | `POST /v1/admin/orders/:id/cancel-lines` | orders.transition | order line, balance, ledger, audit | 409 | tests |
| Admin order | Open a return for the customer | `POST /v1/admin/orders/:id/returns` | returns.manage | return, lines, events, audit | 409 over-quantity | tests |
| Admin order | Request refund (₹, reason, optional return) | `POST /v1/admin/orders/:id/refunds` | finance.refunds | refunds, events, audit | 409 over balance | browser + tests |
| Admin order / Refunds | Approve / Reject refund (note) | `POST /v1/admin/refunds/:id/decide` | finance.refunds; not the requester; 2FA for real money | refund, events, audit, outbox | 403 self-approval, 503 no provider | browser + tests |
| Admin returns | Status filter, pagination | GET params | orders.read | — | empty state | manual |
| Admin return | Approve / Reject (note) | `POST /v1/admin/returns/:id/decide` | returns.manage | return, events, audit, outbox | 409 stale | browser + tests |
| Admin return | Record items received | `POST /v1/admin/returns/:id/receive` | returns.manage + inventory.write | return lines (batch), quarantine balance, ledger, audit | 409 | browser + tests |
| Admin return | Restock / Dispose per line (note) | `POST /v1/admin/return-lines/:id/inspect` | returns.manage + inventory.write | balances, ledger, audit | 409 batch unavailable | browser + tests |
| Account order | Return items (quantities, reason) | `POST /v1/account/orders/:id/returns` + Idempotency-Key | order owner | return, lines, events, outbox | field errors; window closed | browser (double-click) |
| Admin products | Publish / Unpublish (reason, version) | `POST /v1/admin/products/:id/(un)publish` | products.publish | product, price, decision, audit | 409 stale | — |
| Admin packages | Approve version | `POST /v1/admin/packages/approve` | packages.approve + 2FA | version, components, audit | field errors | — |
| Admin migration | Filter; Mark resolved | `POST /v1/admin/migration/exceptions/:id/resolve` | migration.resolve | exception, audit | — | — |
| Admin inventory | Record receipt | `POST /v1/admin/inventory/receipts` | inventory.write | batch, balance, ledger, audit | field errors | — |
| Admin enquiries | Start handling / Mark resolved | `POST /v1/admin/enquiries/:id/status` | support.write | enquiry, task, note, audit | — | — |
| Admin applications | Review / Request info / Approve / Reject / Suspend | `POST /v1/admin/applications/:id/decision` | partners.applications.decide | application, review, account, audit | 409 stale | — |
| Admin settings | Save delivery rule | `POST /v1/admin/settings/shipping` | settings.write | store_settings (versioned), audit | 409 stale | — |

"—" in Verified means the control is implemented but not yet exercised by an automated or recorded manual test.
