# Official event images and second reviewed show

- Added Collectible Con Seoul, October 2–3, 2026, Stage X Seongsu Chabot. Organizer homepage and its linked registration page agree on dates/location, free preregistration and ONE PIECE participation: https://collectiblecon.xyz/ and https://luma.com/cc-korea-2026-day-1 . Registration action points to the organizer's date-specific ticket choices, not only day one.
- Opening time conflicts: the actual official image says 10:00; homepage text and registration page say 11:00. The entry explicitly flags this discrepancy instead of silently choosing a time. Both end at 20:00.
- Visually inspected official Seoul Card Festa promotional image and Collectible Con event-information artwork. Both return HTTP 200 with image MIME types. List uses compact uncropped thumbnails; detail preserves aspect ratio and links to the organizer as source. Missing, unsafe, unreviewed or failed images leave no placeholder.
- Images load directly from organizer domains with no referrer. No binary images are committed or rehosted. Public availability/source attribution does not establish a reuse license; explicit reuse permission is not confirmed. Do not claim permission was obtained. Review organizer image terms/permission before later public deployment.
- Automated collector remains review-only; these are manually reviewed additions. A safe ongoing review-to-publication process and more organizer sources remain next steps.
- Page and box tests: 15 pass. Full build and this poster revision's actual browser layout have not yet been verified. No main push, production deployment or DB changes.

## Box work status, separately checked

- Archive contains local box portfolio/gallery/valuation changes and earlier report `box-portfolio-card-shows-2026-09-29.md`; these changes are not present in current production main `74c12b8`.
- Current production-source `box-market-prices.json` is dated `2026-09-29T05:46:23.434Z`; the local feature copy remains `2026-09-08T04:39:39.849Z`. Preserve main's newer data during integration. Do not describe production collection as stale solely from the local feature copy.
- Box holdings database migration is still a draft; no real PostgreSQL/RLS or authenticated persistence validation is recorded. Separate approval is required before database changes. Existing card holdings must remain intact.
- Next: reconcile latest main data with isolated feature changes; verify real box currency/valuation and mock tests; validate a migration in a non-production database and authenticated add/edit/delete/refresh isolation; obtain DB and deployment approval before publishing.
