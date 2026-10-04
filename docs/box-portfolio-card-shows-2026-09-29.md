# Box portfolio and card-show calendar — local implementation

Status: locally implemented and unit/component tested; not deployed. No production database changes.

## Changes

- Portfolio holdings distinguish cards and sealed booster boxes. Existing card records default to card.
- Only catalog-confirmed booster boxes can be added; packs, decks, collections and individual DON cards cannot be saved as boxes.
- Box purchases support manual cost or cost later, not PSA10 or historical card-price estimates.
- Portfolio valuation separates card trade quotes from box listing snapshots. Box amounts require an explicit currency and conversion rate. Missing, future-dated or over-seven-day-old snapshots are excluded from value/returns, while purchase cost remains intact.
- Box market has OP/EB/PRB/other filters, series codes, snapshot dates and per-box portfolio actions. The existing price snapshot is dated September 8 and is not treated as a current portfolio quote.
- Calendar has a card-show filter, organizer links and next-show navigation. Events are curated, not automatically scraped. Cancelled/unverified/invalid-date records are excluded.
- The initial event is Seoul Card Festa, November 14, 2026, KINTEX Hall 6 A. Source: https://seoulcardfesta.com/ (checked September 29). Attendance of specific ONE PIECE vendors is not assumed.

## Verification

`node --test test/box-portfolio.test.mjs test/portfolio-model.test.mjs scripts/testPortfolioIsolation.mjs scripts/testPortfolioRoute.mjs`

25 tests passed, covering real API handlers with mocked database owners, currencies/freshness, type isolation, gallery filter/add handlers, server-rendered portfolio labels, JSX compilation and existing portfolio routes. No full build or full test suite was run.

## Release gates still open

- `portfolio-box-schema-draft.sql` is a review-only draft, deliberately outside migration discovery. Supabase CLI was not installed locally; no package was installed. Generate a migration using the CLI, apply/test on a local database first, then obtain approval for production application.
- The draft preserves ownership RLS and purchase foreign keys, adds a default card type and prevents changing an existing holding's type. SQL syntax/trigger/RLS behavior has NOT been executed against PostgreSQL yet.
- Database migration must precede enabling box writes in production. Existing schema cannot save box holdings.
- Real authenticated persistence, browser visual/mobile/dark-mode checks and refreshed box pricing remain unverified.
- The seven-day listing freshness threshold is an explicit conservative display rule, not a guarantee of price accuracy. Listings are asking prices, not executed trades.
- Existing main has advanced independently. This work must be reconciled with current main before any later production release; no main merge or history rewriting was performed here.
