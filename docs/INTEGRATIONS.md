# Integrations

Health states: `not_configured`, `configured_unverified`, `sandbox_verified`, `live_verified`, `degraded`. Rows exist in the `integration_status` table (seeded `not_configured`); an admin status screen is not built yet.

| Capability | Current state | Working local path | Needed for production |
| --- | --- | --- | --- |
| Database | sandbox_verified (local) | embedded PostgreSQL 18, migrations applied | Managed PostgreSQL, backups, pooled connections |
| Sessions/auth | configured_unverified for prod | Better Auth, DB sessions, 2FA plugin | TLS domain, real mail delivery for verify/reset, owner bootstrap |
| Files | public media only | `storage/public/media` served at `/media` | S3-compatible bucket; private bucket for KYC/returns; malware scanning |
| Email | not_configured | Dev mail sink (writes to worker log + `notification_deliveries` as `captured_dev`) | Provider + verified sender domain |
| Payments | not_configured | Development manual method only | Razorpay account, **test** keys for sandbox, webhook secret |
| Shipping | development rule | Flat rule in `store_settings` (labelled development) | Merchant rates; optional carrier API |
| WhatsApp link | hidden | Number observed but unverified; shown only after verification | Merchant verification |
| WhatsApp Business API | not_configured | None. A click-to-chat link is **not** messaging history or broadcasts. | Approved provider, templates, consent |
| Search | sandbox_verified | PostgreSQL `ILIKE` + trigram index | Optional hosted engine |
| AI assistance | not_configured | None | Optional |
| Analytics | first-party only | `analytics_events` written server-side for `order_placed` | Optional provider + consent |
| Recurring billing | not_configured | — | Mandate-capable provider |
| Payouts | not_configured | — | — |

Secrets live only in `.env` (git-ignored). `.env.example` documents every variable.
