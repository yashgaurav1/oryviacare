# Oryvia Pro

Storefront and operations platform for Oryvia Care (skincare and hair care). TypeScript monorepo:

| Path | What |
| --- | --- |
| `apps/web` | Next.js 16 storefront, customer account, partner workspace, admin |
| `apps/api` | NestJS 11 API, Better Auth sessions, RBAC, commerce domain, worker (`src/worker.ts`) |
| `packages/db` | Prisma 7 schema, migrations, local PostgreSQL launcher |
| `packages/contracts` | Shared Zod request contracts and money formatting |
| `scripts/migration` | Crawler, normalizer, media downloader, importer for oryviacare.in |
| `data/source` | Crawl evidence, normalized records, exception register |
| `docs` | Living build documents: start with `docs/BUILD_STATUS.md` |

## Local setup (Windows/macOS/Linux, Node 22+; no Docker required)

```bash
npm install
```

```bash
cp .env.example .env
```

Fill `BETTER_AUTH_SECRET` (32+ random characters) and set the same password in `LOCAL_PG_PASSWORD` and `DATABASE_URL`.

```bash
npm run db:start
```

Leave that running, then in a second terminal:

```bash
npm run db:migrate && npm run db:generate && npm run seed:reference && npm run import:apply
```

Development data only (refuses to run in production):

```bash
npm run seed:dev
```

Run the three processes (separate terminals):

```bash
npm run dev:api
```

```bash
npm run dev:worker
```

```bash
npm run dev:web
```

Open http://localhost:3000. Dev sign-in details are in `.data/dev-accounts.json` (owner, finance operator, customer; the second staff account exists because refunds need a different approver). API docs: http://127.0.0.1:4000/api/docs.

## Tested happy path
Shop → product → Buy now → checkout (development payment method) → order placed → sign in as dev admin → Admin → Orders → Confirm → Create shipment → Dispatch → Mark delivered → (as customer) Return items → (as admin) Approve → Record received → Restock → Request refund → (as dev finance) Approve. Verified 2026-10-31; see `docs/TEST_REPORT.md`.

## Tests

```bash
npm run test:api
```

Runs integration tests against the `oryvia_app_test` database (truncated by the tests).

## Refreshing source data

```bash
npm run source:crawl -- --resume && npm run source:normalize && npm run source:assets && npm run import:dry-run
```

## Production owner

Register normally, then run once on the server:

```bash
npm run bootstrap:owner -- --email owner@example.com
```

There is no default administrator password.
