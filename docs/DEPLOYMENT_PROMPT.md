> **Update 2026-11-01:** the owner chose to host everything on Render (no Vercel). `render.yaml` now defines `oryvia-db`, `oryvia-api` and `oryvia-web`; the website forwards `/api` and `/media` to the API. Read the Vercel steps below as the `oryvia-web` Render service.

# Prompt: push Oryvia Pro to GitHub and deploy a public staging site

Paste everything below the line into a new Claude Code session opened in this repository. Fill in the four values in "Inputs" first.

---

Deploy the Oryvia Pro monorepo in this repository as a **public staging environment**: code on GitHub, the Next.js storefront on Vercel, the NestJS API and worker on a Node host, and PostgreSQL managed. Read `README.md`, `docs/BUILD_STATUS.md`, `docs/DECISIONS.md` and `docs/LAUNCH_CHECKLIST.md` first. Do not change product behaviour beyond what is listed under "Required code changes".

## Inputs (from the repository owner)
- GitHub repository URL (empty, private): `<https://github.com/OWNER/oryvia-pro>`
- Vercel account/team the owner is signed in to: `<team or personal>`
- Backend host the owner has an account with: `<Render | Railway | Fly.io>` (default Render)
- Owner admin email (will become the first owner account): `<owner@example.com>`

The owner signs in to GitHub, Vercel, the backend host and the database provider themselves. Never ask for, type or store their passwords. Use `gh auth login`, `vercel login` and the host's own CLI login flows, which the owner completes in the browser.

## What exists (verified 2026-11-01)
- Branch `build/oryvia-pro-foundation`, commits `b0e61bc` (platform) and `4412a81` (redesign) plus this file. No git remote is configured.
- Workspaces: `apps/web` (Next.js 16), `apps/api` (NestJS 11 API plus a worker at `src/worker.ts`), `packages/db` (Prisma 7, migrations), `packages/contracts`, `scripts/migration`.
- The web app reaches the API **server-side** through `API_INTERNAL_URL`. `next.config.ts` rewrites `/api/*` and `/media/*` to it, so browsers see one origin and auth cookies stay first-party.
- The API serves public media from `storage/public/media`. That folder is git-ignored and is filled by `npm run source:assets`; only a local-disk storage driver exists.
- Payments: Razorpay is **not implemented**. In production `ALLOW_DEV_MANUAL_PAYMENT` must be `false`, and the API refuses to start otherwise. **Checkout therefore cannot complete on staging.** That is expected; do not work around it.
- Indexing is off unless `ALLOW_INDEXING=true`. Keep it off.

## Steps

### 1. GitHub
1. Make sure `.env`, `.data/`, `storage/`, `packages/db/generated/` and `*.tsbuildinfo` are ignored. Scan the tracked files for secrets (the value of `BETTER_AUTH_SECRET` in `.env`, any `postgresql://` URL containing a password, anything in `.data/dev-accounts.json`). Stop if anything is found.
2. Add the remote, push `build/oryvia-pro-foundation`, and open a pull request into `main`. If `main` does not exist, push the branch as `main` only after the owner confirms. Do not force-push.

### 2. Database (Neon or Supabase PostgreSQL 16+, region Mumbai / ap-south-1)
1. The owner creates the project. Take the pooled and direct connection strings from the owner's dashboard, not from chat logs.
2. Run `npx prisma migrate deploy` (in `packages/db`) against the **direct** URL.
3. Run `npm run seed:reference`, then `npm run import:apply` (public catalogue data from `data/source`).
4. **Never run `npm run seed:dev` against this database.** It writes development stock, a development shipping rule, a development return window and development accounts.

### 3. Required code changes (small, commit each on the branch)
1. `apps/api/src/main.ts`: listen on `process.env.PORT ?? env.API_PORT` and host `0.0.0.0` instead of `127.0.0.1`.
2. Add a health check path for the host: the API already has `/api/health/live` and `/api/health/ready`.
3. If the host's disk is ephemeral (Render free, Railway, Fly without a volume), either attach a persistent volume at `storage/` or run `npm run source:assets` in the build step. Document which one you chose in `docs/INTEGRATIONS.md`. Object storage (S3/R2) is **not implemented**. Do not claim it is.
4. Confirm `apps/web` builds on Vercel with the monorepo: Root Directory `apps/web`, install from the repo root (npm workspaces). If `@oryvia/contracts` fails to compile, add `transpilePackages: ["@oryvia/contracts"]` to `next.config.ts`.

### 4. API and worker on the backend host
- Build command (repo root): `npm ci && npm run db:generate`
- API start: `npm run start -w @oryvia/api`. Check that the script runs compiled or SWC-registered code with `NODE_ENV=production`; add a production start script if needed.
- Worker: a second service (background worker) running `npm run worker -w @oryvia/api` with the same environment.
- Environment variables (set in the host dashboard, never in git):
  - `NODE_ENV=production`
  - `DATABASE_URL=<pooled connection string>`
  - `BETTER_AUTH_SECRET=<new 32+ byte random value, generated for this environment>`
  - `PUBLIC_ORIGIN=<the Vercel URL, e.g. https://oryvia-pro.vercel.app>`
  - `STORAGE_DRIVER=local`
  - `ALLOW_DEV_MANUAL_PAYMENT=false`
  - `RAZORPAY_*` left empty
- Verify: `curl https://<api-host>/api/health/ready` returns 200.

### 5. Storefront on Vercel
- Import the GitHub repo. Framework Next.js; Root Directory `apps/web`.
- Environment variables:
  - `API_INTERNAL_URL=https://<api-host>`
  - `PUBLIC_ORIGIN=https://<vercel-domain>`
  - `ALLOW_INDEXING=false`
- Deploy. Then set `PUBLIC_ORIGIN` on the API to the final Vercel domain and redeploy the API, so Better Auth accepts the origin.
- Do **not** attach `oryviacare.in` or any Oryvia domain. Moving the live domain is a cutover that needs the merchant's explicit written approval (master brief). The old WordPress site must stay untouched.

### 6. Admin (backend) access for the owner
1. The owner registers at `https://<vercel-domain>/register` with their email and their own password.
2. Run once, against production: `npm run bootstrap:owner -- --email <owner email>`. There is no default admin password and none may be created.
3. The owner signs in, opens `/account/settings` and turns on two-factor authentication. Price, package and real-money refund approvals require it.
4. Further staff are added by the owner. The Admin → Team UI is not built yet; record that as a gap rather than inventing a workaround.

### 7. Verify and report
Check each against the deployed URLs and record the results in `docs/TEST_REPORT.md` under "Staging deployment":
- [ ] Home, shop, a product, cart, login and the 404 page load over HTTPS; images under `/media` load.
- [ ] `robots.txt` disallows everything; pages send `noindex`.
- [ ] Register, sign in and sign out work (the cookie is set on the Vercel domain).
- [ ] The owner reaches `/admin`; a normal customer gets "no access".
- [ ] Checkout shows Razorpay as "not set up" and no development payment option.
- [ ] The worker logs outbox processing.
- [ ] No secrets appear in client bundles (search the built `.next/static` for `BETTER_AUTH_SECRET` and the database host).

Update `docs/BUILD_STATUS.md` with the URLs, hosts and what is not done. Final message to the owner:
- the public staging URL and the admin URL;
- what works and what does not: no payments, no tax, policies pending, staging not indexed;
- exactly which values the owner holds (database, auth secret) and where they are stored;
- the merchant decisions still blocking a real launch (`docs/DECISIONS.md` M-001…M-013).

## Do not
- Do not deploy with `ALLOW_DEV_MANUAL_PAYMENT=true`, run the dev seed, or copy `.data/dev-accounts.json` anywhere.
- Do not paste secrets into chat, commits, PR descriptions or logs.
- Do not enable indexing, connect real payment keys, send emails to real customers, or point Oryvia's domain at the new site.
- Do not say a step works unless it was checked on the deployed URL.
