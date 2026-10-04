# Domestic card-show collector activation — 2026-09-29

The user approved selective main integration, the resulting production deployment and collector activation. This supersedes the inactive status in `card-show-collection.md`.

- Main commit: `620667a2e38878013b9db4c0e24d55b29650a6d1`, parent `e6bff5fb8bbcb4a809a680f35bc4dec4e6d4b952`.
- Exactly four archived collector files were added: collector, its tests, guarded workflow, and documentation. No box/portfolio code, database draft, or unrelated local changes were included.
- The existing development branch, normal index, working files and prior history were preserved. Non-force push only.
- Repository variable `CARD_SHOW_COLLECTOR_ENABLED=true` was set and read back.
- Daily schedule: 00:43 UTC / 09:43 KST. The first manual cloud run succeeded; the next scheduled invocation has not yet been observed. GitHub may delay scheduled jobs.
- Collector run: https://github.com/kkamddi/one-piece-tcg-site/actions/runs/36505295987
- Cloud tests passed. Downloaded the generated review artifact and verified two candidates: Seoul Card Festa and Collectible Con. SEOUL TCG CON and KCCF remain `needs_review` with no structured events.
- Secret scan run `36505284691` succeeded.
- Existing synchronized-main production workflow succeeded: https://github.com/kkamddi/one-piece-tcg-site/actions/runs/36505284650
- Cloudflare deployment: https://9b9bc26e.optcgkorea-static.pages.dev
- Post-deploy HTTP checks: homepage and `/prices` both returned 200 HTML.
- No direct local/feature-branch Cloudflare deployment was used. No authentication, billing, visibility or DNS settings were changed.

## Remaining work

The collector saves review artifacts for seven days; it does not update public event records. Dedicated event UI, durable approved-event/change tracking and adapters for the remaining two sources still need implementation. No claim of complete nationwide event coverage or successful future scheduled execution is made.

Previous box/portfolio work and the schema draft remain archived but were not released in this integration. Live-run diagnostic downloads and local integration helpers are excluded from Git; reproducible code and this activation record are archived.
