# Production deployment — 2026-09-26

- Production: https://www.optcgkorea.com
- Release commit: `674ea7b561d4b889327aeb07fa0907ee3b9dbe7b`.
- Merged latest main and verified archive with both parents preserved; no force push.
- Deployment workflow: https://github.com/kkamddi/one-piece-tcg-site/actions/runs/36164901599 — success.
- Secret scan: https://github.com/kkamddi/one-piece-tcg-site/actions/runs/36164901495 — success.
- Cloudflare deployment: https://77f8850e.optcgkorea-static.pages.dev

## Release verification

- Isolated integration checkout: 249 tests passed and actual production build passed.
- Tests requiring a local image fixture used a local-only copy; the fixture was not uploaded.
- Dependency audit: zero known vulnerabilities at verification time.
- Scoped sensitive-pattern check: 90 changed files, zero findings.
- Deployment catalog checks passed for all three locales; revisions unchanged, no database import performed.

## Post-deployment checks

- Homepage, `/portfolio`, `/jp/portfolio`: HTTP 200.
- Both portfolio routes retain noindex and render the appropriate language/login prompt.
- Unknown route: HTTP 404.
- Portfolio API without authentication and with a synthetic invalid token: HTTP 401.
- Fresh shop query reports Yatap in Gyeonggi; Seoul filter excludes it.
- Existing shop query cache still returned the old region. Fresh query confirms deployed correction, but previously cached responses may remain until cache expiration. No cache settings were changed or cache purge performed.
- Production application asset: `/assets/card-pone-app-Dw1KNLuZ.js`.

## Scope and remaining limitations

This records deployment and targeted smoke checks, not certification of every possible behavior. Earlier verification reports remain historical records.

- Previously deferred individual Google account collision remains unresolved; no identity linking/deletion performed.
- Physical-device verification excluded by request; first-time external-provider consent is not certified.
- Signing-key backup remains unverified and requires a separately chosen backup destination.
- Existing bundle-size warnings and previously documented advisory limitations remain.
- Repository visibility unchanged; no paid features enabled.
- Original development branch and local working files preserved. This report is archived separately and does not trigger another main deployment.
