# Site Audit - 2026-09-11

## Scope

- Production: read-only HTTP checks against `https://www.optcgkorea.com`.
- Local: representative public workflows on `http://127.0.0.1:4182`, desktop and 390 x 844 mobile viewport.
- Code: search input/loading, card API fallback, portfolio calculation and quote lifecycle, shop filters, route entry points, collection layout, existing regression tests.
- This is a representative regression review, not a certification of every card, route, device, or authenticated operation.
- No deployment, account changes, database writes, collector runs, dependency upgrades, or production configuration changes were performed.

## Fixed Locally

| Priority | Finding | Fix |
| --- | --- | --- |
| P1 | Selecting another portfolio card retained the previous quote while loading. Old valuation remained visible and the detail button stayed enabled; signed-in save could combine the new card with the old quote. | Clear the quote immediately on selection and when a new load starts. Ignore prices during loading and disable detail access. Regression tests cover pending, failed, and out-of-order responses and mocked save payloads. |
| P2 | The search suggestion keyboard handler treated IME confirmation Enter as ordinary navigation/submission. | Ignore composing key events, including keyCode 229, and prevent confirmation Enter from submitting. Normal Enter remains supported. |
| P3 | A mobile collection heading split the final Korean word into a lone character. | Wrap collection headings at word boundaries, with emergency wrapping for oversized tokens. |
| P3 | Three shop select controls had no accessible names. | Add localized names for shop type, region, and district without changing the layout. |

Changed application files: `src/PortfolioCalculator.jsx`, `src/SiteSearch.jsx`, `src/RenewApp.jsx`, `src/renew.css`.
Added regression coverage: `scripts/testSiteAudit.mjs`.

## Verification

- All 114 discovered tests passed, including the 4 new regression tests.
- Runner: `node --experimental-vm-modules --test` with explicit paths from `test/*.test.js` and `scripts/test*.mjs`.
- Production-mode Vite compilation passed after all edits. Output: `artifacts/site-audit-build-20260911`.
- Existing `dist` and sitemap files were not regenerated. This was not the sitemap/static SEO generation pipeline or an Android package build.
- `git diff --check` passed; existing unrelated worktree changes were preserved.
- No console errors were observed in the final local browser session.

| Workflow | Result |
| --- | --- |
| Home search for `op17` | 169 cards and the OP17 series guide returned; guide-to-catalog navigation worked. |
| Mobile home search for `망가` | Collection guide and related content returned; ordinary Enter submitted successfully. |
| Catalog | JP OP17 catalog loaded, SEC filter worked, OP17-118 detail opened and linked to its price page. |
| Price detail | Single data and the 1M chart rendered with 16 recorded days; mobile layout had no page-level horizontal overflow. |
| Login-required action | Price alert opened the login dialog; background scrolling was locked and the close control worked. No login was submitted. |
| Portfolio calculator | Search and selection worked. Reproduced old-price persistence before the fix, then verified blank valuations and disabled details during the next quote load. |
| Shops | Selecting Seoul returned 25 rows with Seoul addresses; controls exposed distinct accessible names and map links were present. No location permission was requested. |
| News / Amazon invitations | Three product links were present, OP13 box image loaded, no observed broken images or mobile overflow. No purchase links were submitted. |
| Collection guides | Standalone article and manga/promo navigation worked. Manga page had 41 images and promo page 108 including shared images; no completed failed images or page-level mobile overflow were observed. Lazy off-screen images were not all forced to load. |
| Pack simulator | One PRB02 pack produced 10 cards and the back button returned to the lab. Real pack odds and complete price coverage were not audited. |
| Deck builder | Leader/preset selection screen loaded without broken completed images or mobile overflow. Deck editing/saving was not exercised. |
| Centering | Initial measurement screen and controls rendered. Photo upload, calibration, and camera capture were not exercised. |

All 17 production read-only requests returned HTTP 200:

`/`, `/cards`, `/prices`, `/news`, `/lab`, `/shops`, `/search?q=op17`, `/guides/series/jpop17`, `/guide/collection/start`, `/guide/collection/manga`, `/guide/collection/promo`, `/about`, `/data-policy`, `/terms`, `/privacy`, `/ads.txt`, `/robots.txt`.

The HTML titles matched those page types. Search correctly returned `noindex,follow`; the sampled content routes returned indexable robots metadata. HTTP success does not establish search-engine indexing or AdSense approval.

## Remaining Work / Limits

- Bundle warning remains: main JavaScript is about 1.42 MB minified / 368 KB gzip; CSS is about 461 KB / 71 KB gzip. Additional large data and image-worker chunks exist, but their emitted size is not proof that every visitor downloads them. Measure real loading before planning code splitting.
- OpenCV emits browser-externalization warnings for `fs` and `crypto`. Compilation succeeds; camera/worker runtime was not validated here.
- Actual OAuth providers, authenticated portfolio persistence, account deletion, push delivery, payments, Android installation, and camera permissions require separate controlled end-to-end testing. Existing tests for those integrations use mocks.
- Collector freshness, exact market-price correctness for every variant, live D1/R2 quota, and database security were not certified by this review.
- Production still needs a separate authorized release of these fixes.
