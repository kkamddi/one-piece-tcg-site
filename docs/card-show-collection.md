# Domestic card-show collection

## Current status

Collector implemented and tested locally on 2026-09-29. Not activated on GitHub and not connected to automatic public publication. The existing curated calendar is unchanged.

Live run: Seoul Card Festa and Collectible Con each returned one structured domestic event. SEOUL TCG CON and KCCF returned no structured events and were marked `needs_review`; they are not considered successfully covered.

## Run

```sh
node --test test/card-show-collector.test.mjs
node scripts/collectCardShows.mjs --write-report
```

The report goes to ignored `artifacts/card-show-collection/latest.json`. It contains selected public event facts, source URLs, checks, separate admission/vendor offers and review reasons. No source HTML, images, login data, contact emails or remote executable code are stored. No published records are replaced or deleted, including on network failure or when a source no longer lists an event.

## Schedule and activation gate

`.github/workflows/card-show-collector.yml` requests one run daily at 09:43 KST (00:43 UTC), plus manual dispatch. GitHub may delay scheduled jobs. It uses standard Ubuntu, Node only, no installed packages, no AI API, no DB, no secrets and no repository write permission. Review artifacts expire after seven days.

The workflow requires BOTH the `main` ref and repository variable `CARD_SHOW_COLLECTOR_ENABLED=true`. Neither main integration nor setting the variable has been done. Archive pushes do not start it. Default-branch integration and activation require separate approval because the existing main-push workflow deploys production. Do not claim continuous collection is running before a real scheduled run succeeds.

GitHub schedule requirements: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule

## Coverage and safety

- Fixed organizer allowlist: https://seoulcardfesta.com/, https://collectiblecon.xyz/, https://seoultcgcon.com/, https://www.kccf.net/global/application.php.
- Two sequential GETs per source (robots and the configured announcement), 15-second timeout per request, 1 MiB response limit. No recursive crawl, redirects, login, cookie access or access-control bypass.
- Robots failures are fail-closed, except an explicit 404. A matching disallow blocks fetching the announcement. Public facts only; robots access is not a license to republish artwork or full announcements.
- JSON-LD Event/ExhibitionEvent/SocialEvent records must have a verified KR country field, name, valid dates and venue. Missing years/timezones are not guessed. Datetimes are converted to KST dates.
- Cancellation/rescheduling, conflicting records and malformed data require review. Every candidate remains review-only; JSON-LD can be stale or contradict the visible notice. Admission and vendor booth prices are not collapsed into one ticket price.
- Sources without structured records need a separately tested site-specific adapter. This is not exhaustive discovery of every Korean card show or automatic monitoring of Instagram/cafes.
- Before connecting public updates: add durable reviewed-event identity/change tracking, visible-announcement validation, freshness and cancellation handling, and a dedicated event page. Do not feed this candidate report directly to `confirmedCardShows`.

## Verification

Ten isolated tests passed: domestic fields, offer separation, graph/list parsing, duplicates/conflicts, dates/timezones, cancellation, missing data, robots, fetch failure isolation, response size, and workflow guardrails. Live checks returned two candidates and two explicit coverage gaps. No full build, production writes, deployment or scheduled cloud execution performed.
