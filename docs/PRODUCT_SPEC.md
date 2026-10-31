# Product spec (summary)

The full brief is `ORYVIA_PRO_Master_Build_Prompt.md` (kept outside the repo by the requester). This file records how it is being interpreted.

- **Customer brand:** ORYVIA / Oryvia Care. **Business workspace:** Oryvia Pro.
- **Audiences:** guests and customers (retail purchase), applicants and approved partners (salon, retailer, distributor), staff (role-based admin).
- **Truth rules:** no invented products, prices, reviews, metrics, certifications, efficacy claims, ingredients or policy terms. Unknown facts are hidden or shown as pending, never filled.
- **Authority:** the API and database decide prices, stock, permissions and state. The browser never sends prices, roles or account ids that are trusted.
- **Imported data** is evidence, not approval: everything lands `needs_review`; packages with conflicting evidence cannot be bought.
- **Delivery labels** used in all reporting: Implemented and verified / Implemented, provider setup required / Blocked by business decision / Not implemented.

Status of each requirement: see `FEATURE_MATRIX.md`. Order of remaining work: `BUILD_STATUS.md`.
