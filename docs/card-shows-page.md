# Card-show page — local implementation

Entry: Information → 카드쇼·행사 (`/news?section=cardshows`). Uses the existing news route and navigation without adding a deployment route or changing infrastructure.

- Upcoming/finished tabs and all/capital/other-region filters use URL parameters, preserved through event detail, links and browser back navigation.
- Information-first responsive rows contain dates, time, venue, fee and status. No poster placeholder or decorative labels.
- Detail has one back link, event facts, optional reviewed programs, map/source and optional registration links. Registration is hidden for cancelled, postponed or ended shows.
- Only reviewed KR records enter the page. Collector candidates with `reviewRequired` never enter, even if accidentally assigned a confirmed status. Unknown fees and ONE PIECE participation remain explicitly unknown; neither is inferred from a collector offer or generic card-show branding.
- Existing curated event data is shared with the calendar. The current initial record remains Seoul Card Festa; only its known metropolitan region classification was added. No new event prices/programs were guessed or published.
- The automatic collector and production site were not changed or deployed in this task. This page does not consume its review artifacts automatically.

Verification: `node --test test/card-shows-page.test.mjs test/card-show-collector.test.mjs test/box-portfolio.test.mjs` — 23 passing tests. Includes KST boundary, multi-day events, sort/filter, pending exclusion, cancellation, unknown detail, SSR escaping/link safety, actual click handlers, localized navigation query preservation, and JSX compilation. Full build and actual browser visual checks have not been run. Responsive/dark styles are implemented but not visually verified.

Remaining: browser layout review, public-release approval/integration, and a reviewed collector-to-public-data process. Query-based detail pages reuse the existing news SEO metadata; dedicated per-event SEO is not implemented.
