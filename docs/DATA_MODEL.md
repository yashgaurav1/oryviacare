# Data model

Source of truth: `packages/db/prisma/schema.prisma` (83 models) and migrations in `packages/db/prisma/migrations/`.

## Conventions
- Money: integer paise (`Int`). Currency fixed to INR by CHECK.
- Time: stored UTC; business dates computed in Asia/Kolkata with inclusive start / exclusive end.
- Optimistic concurrency: `version` on orders, products, carts, business accounts, applications, coupons, settings.
- Review lifecycle for imported data: `observed → needs_review → approved → published`.

## Invariants enforced by the database (`*_constraints`, `*_package_component_observed_qty` migrations)
- `stock_balances`: `onHand ≥ 0`, `reserved ≥ 0`, `reserved ≤ onHand`; one unbatched row per variant/warehouse.
- `stock_movements`, `loyalty_ledger`, `audit_events`: append-only (UPDATE/DELETE raise).
- `commission_ledger`: amounts immutable; settlement link may be set once.
- Orders: non-negative amounts; `total = subtotal − discount + shipping (+ tax if exclusive)`.
- Order lines: quantities positive, cancelled ≤ quantity.
- Package versions: `approved` requires price > 0 and an approver.
- Cart items reference exactly one of variant / package version; quantity 1–999.
- Unique `(provider, externalId)` payment attempts and `(provider, externalEventId)` provider events.
- Fulfilment lines and return lines: quantity > 0; fulfilment status ∈ packing/shipped/delivered/cancelled; return-line disposition ∈ pending/quarantine/restocked/disposed/not_received; refund amount > 0; warehouse kind ∈ sellable/quarantine (`*_fulfilment_returns` migration).
- Available-to-sell counts only active **sellable** warehouses.

## Transaction boundaries
| Operation | Boundary |
| --- | --- |
| Place order | One transaction: re-quote → order + line snapshots → `SELECT … FOR UPDATE` balance rows (FEFO) → reservations → payment attempt → order event → cart converted → outbox. Provider calls happen after commit. |
| Confirm | Transaction: version check → commit reservations (onHand−, reserved−, ledger row) → state + outbox + audit. |
| Cancel / expiry | Transaction: release active reservations (idempotent per row) → state. |
| Stock receipt | Transaction: batch upsert → balance increment → ledger row. |
| Package approval | Transaction: component split → supersede previous approved → approve → publish → review decision → audit. |
| Create shipment | Transaction: lock order row → version check → line progress → draw batches from the order's committed pool (ledger `order:<id>` minus active shipment lines), earliest expiry first → one fulfilment per warehouse → event, audit → derived `fulfilmentState`. |
| Line cancel / cancel confirmed order | Transaction under order lock: open-quantity check → `cancelledQty` → restock to the same batch (ledger `order_line_cancelled` / `order_cancelled_restock`); whole-order cancel refused if anything shipped. |
| Return receive / inspect | Transaction under order lock: units into `RETURNS-QUARANTINE` by shipped batch (+ledger); inspection moves quarantine → sellable (batch must be available and unexpired) or writes off. |
| Refund request / decision | Transaction under order lock: refundable = payment amount − live refunds; approver ≠ requester. |
| Application approval | Transaction: create business account + owner membership → state → review row → audit → outbox. |
| Idempotency | Key row created before work; response stored after; scoped by operation + principal; mismatched body rejected. |

## Ownership boundaries
- Customer data: `orders.customerId` from the verified session only.
- Partner data: `memberships(accountId, userId)` resolved server-side; the browser never sends an account id.
- Guest tracking: `trackingTokenHash` (SHA-256 of 32 random bytes); the token itself is never stored except inside the 24 h idempotency replay record, which the worker purges.

ER diagram: not yet generated (planned: `prisma-erd` or Mermaid export).
