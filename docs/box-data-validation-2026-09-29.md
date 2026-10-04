# Box data and card-show validation — 2026-09-29

- Refreshed box catalog and quote snapshot from main commit `74c12b8da5464853d46946e21444dc6087b50ada`; both files match main exactly. No pre-existing local edits to either file were overwritten.
- Quote snapshot timestamp: `2026-09-29T05:46:23.434Z`. These are listing quotes, not verified completed sales.
- Scoped tests: `node --test test/card-shows-page.test.mjs test/box-portfolio.test.mjs test/portfolio-model.test.mjs scripts/testPortfolioIsolation.mjs scripts/testPortfolioRoute.mjs` — 34 passed.
- Local browser: both official event images loaded successfully. Desktop thumbnails measured 100 × 112; a 392px iframe viewport rendered 64 × 88 thumbnails, with document scrollWidth and clientWidth both 377px (no horizontal document overflow). This was a DOM/layout check, not a real-device or screenshot review.
- Temporary diagnostic tab and mobile iframe removed; owned preview tab retained and task REPL exited.

## Remaining gates

- Supabase CLI, Docker, psql, project-local Supabase executable and local Supabase config were not found. No installations or database changes performed.
- Real database migration and persistence/isolation tests remain unverified. Mocked route tests do not establish database correctness. Obtain approval for local test tooling or identify an existing non-production test database before proceeding.
- Official poster URLs and sources were verified, but explicit permission to reuse images has not been established. Resolve image reuse before production publication.
- No production database change, main push/merge or deployment in this task.
