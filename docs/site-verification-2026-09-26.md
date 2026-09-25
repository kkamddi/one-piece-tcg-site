# Site verification — 2026-09-26

## Scope

Targeted review of login, notification isolation, portfolio entry/authentication,
centering photo analysis and chart accessibility. This is not an exhaustive audit.
No production deployment, schema change, dependency installation, account deletion,
or credential/configuration change was performed.

## Fixes verified locally

- Portfolio API: rejected/expired credentials use the existing shared 401 classifier;
  genuine backend failures remain server errors. Invalid credentials do not access user data.
- Notifications: clear the list on account change and discard responses from a previous
  session, unmounted component, or superseded request, including late failures.
- Centering: use detected border positions rather than fixed symmetric starting values.
  Center equal-contrast edge plateaus and limit confidence by the weakest detected edge.
  A blank/missing-edge image cannot receive high confidence from perspective alone.
- Chart accessibility: use the visible primary currency for accessible point labels.
- Portfolio direct entry: generate the missing `/portfolio` and `/jp/portfolio` static
  HTML shells with noindex metadata. Keep unknown paths as 404s.

## Evidence

- 68 targeted tests passed across authentication, social callbacks, notifications,
  Android mocks, centering, portfolio calculations/routes, chart currency and home recovery.
- Syntax checks passed for the modified API, middleware and static-page generator.
- Production login with the authorized existing account succeeded. Existing portfolio
  and notification lists loaded; login persisted after returning home from a reload.
  Existing holdings were not edited and no test notification was sent.
  Logout on the current browser completed and the header returned to the login state;
  this does not establish delivery isolation on a second account/device.
- Production `/portfolio` reload returned the static 404 page. Root cause: the page
  was omitted from the generated static routes; a top-level 404 disables the default
  SPA fallback. The regression checks cover required routes and generated SEO content.
- Production `/api/portfolio` with a synthetic invalid token returned 500 before the fix.
  No-token portfolio, invalid/no-token push subscriptions and Naver userinfo returned 401.
- Local browser photo flow completed with an in-memory synthetic PNG: input, outline,
  border confirmation and result. The same approximately 60:40 image changed from the
  old fixed 50:50 result to 62.9:37.1. Automatic outline selection still introduces error;
  this is not a claim of calibrated photographic accuracy. Known-border unit fixtures
  recover the expected asymmetric ratio. No personal photo was used.
- The modified frontend rendered in the local development server. No production build
  or deployment was run, and development API proxy results are not local-backend validation.
- The 11 changed/new source, test and report files passed the existing secret-pattern
  scanner. Only counts/locations were reported; credential values and fingerprints were not logged.

## Outstanding verification

- Controlled save/reload/cleanup on an approved disposable holding; preserve existing data.
- A second approved account for live cross-account isolation (mock coverage passes).
- User-assisted Google/Kakao/Naver provider consent and callback flows. Password login
  does not validate these providers, and account linking is not part of this audit.
- Explicit scope for one administrator test notification and confirmation on receiving devices.
- Physical Android/mobile camera, permission/offline recovery and initial-load performance.
  No Android device was connected; the current browser tool lacks viewport emulation.
- Calibrated real-card photo accuracy and manual boundary adjustment on an actual device.
- Production re-verification requires a separately authorized main release; archived fixes
  do not change the currently deployed service.

## References

- Supabase Auth error codes: https://supabase.com/docs/guides/auth/debugging/error-codes
- Cloudflare Pages routing/404 behavior: https://developers.cloudflare.com/pages/configuration/serving-pages/
