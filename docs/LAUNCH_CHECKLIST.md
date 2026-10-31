# Launch checklist

Nothing below is done unless ticked. Production is **not** ready.

## Merchant decisions (see DECISIONS.md M-001…M-012)
- [ ] Package prices and compositions approved
- [ ] Reference/MRP classification for every product
- [ ] Seller entity, GSTIN, HSN, GST rates
- [ ] Delivery rates, serviceable areas, delivery times
- [ ] Privacy, terms, shipping, returns policy text approved and published
- [ ] Return window in days (`returns.policy` setting) and whether a single person may approve refunds (M-013)
- [ ] Verified contact details and social links
- [ ] Razorpay account; test keys for sandbox, then live keys
- [ ] Product facts (net quantity, full ingredients) confirmed from packaging
- [ ] Media rights confirmed

## Engineering
- [ ] Razorpay adapter + signed webhooks + reconciliation
- [ ] Real email provider and verified sender
- [x] Fulfilment, returns, refunds: domain, admin and customer flows (verified locally 2026-10-31)
- [ ] Refund execution through Razorpay (blocked on M-007)
- [ ] Courier/label integration (blocked on M-004 and provider choice)
- [ ] CMS/product editors
- [ ] Playwright + accessibility suite green
- [ ] Production build, containers or process manager for web/API/worker
- [ ] Managed PostgreSQL, backups, tested restore
- [ ] Private object storage + malware scanning for uploads
- [ ] Dependency and secret scan
- [ ] `ALLOW_DEV_MANUAL_PAYMENT=false`, no dev accounts, dev seed never run (it also writes a development `returns.policy`)
- [ ] Owner bootstrapped via `npm run bootstrap:owner -- --email …`, 2FA enabled
- [ ] `ALLOW_INDEXING=true` only on production; redirects tested; sitemap reachable
- [ ] Old WordPress site left intact until authorized cutover; delta export of orders between crawl and cutover
