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

- Save/reload/cleanup and two-account read isolation have since been checked; see the
  follow-up below. Live cross-account write attacks against existing data were not performed.
- User-assisted Google/Kakao/Naver provider consent and callback flows. Password login
  does not validate these providers, and account linking is not part of this audit.
- Explicit scope for one administrator test notification and confirmation on receiving devices.
- Physical Android/mobile camera, permission/offline recovery and initial-load performance.
  Deferred by the user. No Android device was connected; the current browser tool lacks
  viewport emulation. Deferred does not mean passed.
- Calibrated real-card photo accuracy and manual boundary adjustment on an actual device.
- Production re-verification requires a separately authorized main release; archived fixes
  do not change the currently deployed service.

## Follow-up: controlled persistence and account isolation

- With explicit approval, added one previously unowned test holding with one manual
  purchase, reloaded the home document and reopened the portfolio. The quantity,
  purchase date and original KRW amount persisted. Deleted only that test holding;
  after another document reload both its holding and purchase were absent. Existing
  visible holding rows matched the pre-test snapshot. This was a reload test, not a
  save-then-password-relogin test. The temporary test data is no longer present.
- Both approved existing accounts successfully logged in. The second account was
  not newly created, and its existing holdings were not edited.
- Live authenticated portfolio GET responses were 200 for both accounts. Their
  authenticated user IDs differed, and their holding and purchase ID sets were
  disjoint, including holdings with the same card code. IDs and sessions were used
  only in memory and are not included in this report.
- In both directions, a read request containing the other account's user ID and
  holding ID still returned exactly the current account's holdings. This verifies
  these GET parameters cannot switch the authenticated owner; it is not proof of
  every database policy or write path.
- The accounts had different notification lists. After switching from the
  administrator to the second account, a notification GET with a forged administrator
  user ID still returned the second account's empty list. The ordinary account menu
  did not expose administrator statistics. No push notification was sent.
- Final logout removed portfolio data from the UI. Unauthenticated portfolio and
  notification requests both returned 401. The dedicated test tab was left logged out.
- Added six isolated regression tests in `scripts/testPortfolioIsolation.mjs` using
  the real API handler with an in-memory database. They cover forged-owner reads,
  foreign holding/purchase deletes, spoofed-owner inserts, foreign purchase updates,
  and an owner's own update/delete. All pass. These are not live Supabase RLS tests.
  Current PATCH semantics insert a caller-owned purchase when the supplied purchase
  ID is not found for that caller; the other account's purchase remains unchanged.
- Reran the original 68 targeted checks together with these six tests: 74 passed.
  The two follow-up files passed the scoped secret-pattern scan; no account names,
  credentials, personal holding details, or local machine paths were added to them.
- Found a currency-display discrepancy (subsequently fixed locally below): a synthetic KRW 1,000 purchase
  remains KRW 1,000 in the editor but displays KRW 996 in the asset list after
  integer-JPY conversion and reconversion. Original data is preserved. No database
  change was made.
- Remaining external evidence: user-assisted social-provider authentication, a
  real-card photo with a measured reference, and any separately approved push/device
  test. These checks must not be reported as fully verified.

## Follow-up: original-currency calculation and Google entry

- With approval to continue the fixes, portfolio display calculations now derive
  costs from the stored original currency and amount, using the same existing
  conversion rates as the UI. Intermediate values are not rounded to whole yen.
  The home summary, asset list, purchase rows and profit calculations share these
  costs. Original database records and API serialization are unchanged; records
  without usable original-currency information fall back to their stored JPY cost.
- Five added regression tests cover KRW round trips, small amounts, mixed USD/JPY
  purchases, invalid/legacy inputs, and rendering the actual dashboard component.
  The rendered synthetic purchase shows KRW 1,000, not KRW 996, with consistent
  cost and profit. This is local component rendering, not a production deployment.
- All 79 targeted tests passed. No full build, new dependency or DB migration ran.
- The production Google login button reached Google's account chooser. Account
  selection, provider consent and return to the site require the user and remain
  unverified. The dedicated test tab is left on that chooser for user assistance;
  no provider identity was selected and no account linking was performed.
- Kakao/Naver provider completion, measured real-photo accuracy, and deferred
  physical-device/push-delivery checks remain outstanding. Archived fixes require
  a separately authorized release before production re-verification.

## Follow-up: social-provider return and session lifecycle

- The earlier Google chooser-only result is superseded by a controlled return
  attempt: one approved test identity failed with `Multiple accounts with the
  same email`, corroborated by the Auth callback log. A read-only aggregate found
  no additional active non-SSO email-collision groups at inspection time. This
  does not establish that no other accounts have ever experienced login errors.
  The owner deferred this identity issue; no accounts were linked, merged or
  deleted, and no authentication configuration was changed.
- Naver and Kakao each returned successfully to the production site using an
  existing provider session. Session metadata identified `custom:naver` and
  `kakao`, respectively. For each, authenticated portfolio and notification GETs
  returned 200, and a homepage reload preserved the logged-in session.
- Logout removed each site's stored session and unauthenticated portfolio GETs
  returned 401. After the final Kakao logout, the notification GET also returned
  401. The dedicated test tab was left logged out of the site. Provider-wide
  logout, fresh provider-password entry and first-time consent were not tested.
- No holdings, account links or auth settings were explicitly changed in these
  social-login checks. Account identifiers and credentials are omitted here.
- Naver/Kakao completion is no longer pending for the tested existing sessions.
  Measured real-card-photo accuracy, deferred physical-device/push checks, and
  production re-verification after a separately authorized release remain open.
  This follow-up changes documentation only; the prior 79 targeted test results
  are unchanged, not a claim of a new test run.

## Follow-up: public search and market navigation

- On the logged-out production site, a card-code search returned eight matches.
  The Korean and Japanese filters showed three and five matches respectively.
  Opening a Korean catalog detail loaded its card image; the detail back button
  restored the search term and Korean filter.
- A Japanese result opened market variant selection. Selecting a parallel
  variant opened its price detail. The 7D view explained the absence of recent
  trades; switching to 1M rendered a chart. Switching Single to PSA10 changed
  the grade label, prices and chart data. This checks UI behavior, not independent
  accuracy of upstream market prices.
- Reloading the market URL restored the selected card variant. Reloading the
  search URL restored its query and results. Lowercase card codes with surrounding
  spaces resolved to the same eight-match result; an unmatched term displayed
  the no-results message and recovery links. A whitespace-only submission did
  not replace the preceding results (no new search was submitted).
- No new blocking defect was reproduced in this sampled flow. The previously
  archived chart currency-accessibility fix is still awaiting authorized release;
  this check does not imply all catalog entries, filters or routes were tested.
- The owner also deferred measured real-photo verification. No implementation,
  account settings, main branch or deployment changed in this follow-up.

## References

- Supabase Auth error codes: https://supabase.com/docs/guides/auth/debugging/error-codes
- Cloudflare Pages routing/404 behavior: https://developers.cloudflare.com/pages/configuration/serving-pages/
