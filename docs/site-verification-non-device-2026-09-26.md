# Non-device verification status — 2026-09-26

Status: not yet a complete release sign-off. Physical devices and calibrated
real-photo measurements are excluded at the owner's request. Production release,
account linking, authentication configuration changes and paid features remain
unauthorized. Earlier evidence is in `site-verification-2026-09-26.md`.

## Completed in this pass

| Area | Evidence | Boundary |
| --- | --- | --- |
| Automated suites | 249 tests passed, zero failed/skipped | All `scripts/test*.mjs` and files in `test`; local/mocked tests are not live-service certification |
| Production frontend build | Vite production build passed after the fix | Separate temporary output; no deployment or overwrite of existing repository build/sitemaps |
| Sitemap and static generation | Existing generators produced 154 primary URLs, 99 Japanese URLs and 828 HTML pages | Generator writes redirected into the isolated build |
| Route artifacts | 257 unique sitemap/required paths checked for HTML, title, canonical markup and referenced assets | Portfolio pages also checked for noindex; this is not every interactive flow |
| Runtime dependencies | `npm audit --omit=dev`: zero reported vulnerabilities | Point-in-time advisory result, not a guarantee of absence |
| Build tools | Full `npm audit`: seven high and one moderate finding | Security update awaiting permission; no packages installed/updated |
| Supabase advisor | Read-only security check completed | Info notices and a leaked-password-protection warning; no policy/config changes |
| Built UI | Pack simulation rendered ten cards; profit calculation/reset matched expected values | Prices unavailable in isolated preview are not treated as verified |
| Guest deck | Leader selection, local persistence across reload, four-card maximum and fifth-card rejection checked | No signed-in deck writes or production ranking submissions |

The complete test invocation requires `--experimental-vm-modules` for the existing
market-history budget suite. An initial run without it failed eight tests before
their assertions; the corrected run passed all suites. The secret-scanner test
creates and removes only its validated temporary fixture directory.

## Fixes and reusable checks

- `src/api/cards.js`: fallback card listing previously ignored `q`. With the card
  API unavailable, a deck search returned the unfiltered first 48 cards. Apply the
  existing fallback search logic before metadata filters and pagination. The
  rebuilt browser returned only the two artwork variants of the requested code.
- `scripts/testCardFallback.mjs`: three isolated tests cover offline code search,
  filtering before pagination, name/no-result/blank queries after malformed JSON,
  and preservation of a successful API response.
- `scripts/verifyBuiltRoutes.mjs`: exercises the real sitemap/SEO generators against
  an external build directory and checks generated route assets without changing
  tracked sitemap files. Run with `node --experimental-vm-modules` and a fresh
  isolated Vite output directory as the argument.
- Secret-scanner subprocesses and their regression fixture now use `windowsHide`
  so background verification does not open console windows on Windows.
- Deck rule availability: missing reference data previously displayed a passing
  banned/restricted rule check. It now shows that rules cannot be checked until
  an environment and rule list are available. Region changes clear the old
  reference while loading; two regression tests cover unavailable and loaded
  rules without changing DB, authentication or actual legality rules.

## Findings still requiring action or separate scope

1. Full dependency audit reports `@xmldom/xmldom`, `brace-expansion`, `browserslist`,
   `nanoid`, `postcss`, `sharp` and `tar` at high severity, and
   `baseline-browser-mapping` at moderate severity. All are in the development
   dependency graph for this audit. Review compatible updates, then repeat the
   entire test/build check after approval. No `npm audit fix` was run.
2. The build warns about large chunks and OpenCV's browser-externalized `fs` and
   `crypto` imports. Successful bundling does not establish acceptable cold-load
   performance or all OpenCV worker paths. Do not suppress warnings as a fix.
3. Supabase reports RLS-enabled tables without policies (informational, not proof
   of data exposure). The disabled leaked-password protection is an additional
   hardening warning. Supabase documents this feature as Pro-plan-and-above;
   free-only constraints remain in place. See
   https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
   and https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.
4. The previously reproduced single Google identity collision remains deferred.
   First-time external-provider consent is not established by an existing-session
   login. Archived fixes still require an explicitly authorized release before
   production re-verification. No main push, merge, deployment or force push ran.

No credentials, account identifiers, private user records or local machine paths
are included in this report. Temporary build outputs are reproducible and are not
code-backup artifacts. Signing-key backup remains a separate unverified task.
