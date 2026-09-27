# Extension membership gate — 0.1.16

Implementation scope: official extension limited to all signed-in non-anonymous Card Pone members. Existing public website routes remain public. No database writes/schema changes, provider changes, environment changes, payments, main push, production deployment or store submission.

## Changes

- New private/no-store membership API validates the current access token with Supabase `auth.getUser`; backend failure denies access.
- Extension-created login tab only; no enumeration of other website tabs. Its ID alone is stored in session memory. Tokens never enter URLs, logs or persistent extension storage; refresh tokens are never exported.
- Panel, capture, recognition and price flows require membership; account switches discard pending results. Panel checks every 30 seconds and on focus. Closing the connection tab requires reconnection.
- Manifest version 0.1.16 adds `storage` solely for the connection-tab ID.
- Privacy policy, store listing and developer guidance describe the authentication flow.

## Verification and release boundary

- Targeted extension tests cover member/nonmember, anonymous users, expired/rejected tokens, backend failure, malformed responses, logout during verification, account-switch price responses, sender restrictions, capture denial and non-cacheable routing, plus existing capture/reference/price/result behavior.
- Extension-only release build passed. Existing OpenCV browser externalization and large-chunk warnings remain; not a full website build or full repository test run.
- No real installed-extension login/capture end-to-end test has been completed for this new flow. That remains required before store submission, after the API is available in a controlled deployment.
- Deploy the new API before distributing 0.1.16. The current production site does not gain this gate merely from an archive push; the new extension will deny access until the endpoint exists.
- Store authentication-data disclosures and private reviewer login instructions must be completed before submission.
- Old/modified extensions and public data APIs cannot be retroactively blocked by this local gate. Developer loopback preview remains available.

References consulted: Supabase getUser documentation and changelog; Chrome scripting documentation. No new packages installed.

## Authorized production follow-up

- User authorized proceeding with API deployment, installed-extension verification and the store update.
- Main fast-forwarded to `17f79f93a0ec0fe0e1b423116d35180a239ce3d6` without rewriting history. Development branch and unrelated working files preserved.
- Production workflow https://github.com/kkamddi/one-piece-tcg-site/actions/runs/36215649411 succeeded; secret scan run 36215649408 succeeded. Deployment URL: https://edfc7c85.optcgkorea-static.pages.dev
- Catalog revisions unchanged; workflow performed no catalog import.
- Production membership API: missing and synthetic invalid tokens both return 401 with `Cache-Control: no-store, private`.
- Homepage, portfolio and updated privacy page return 200; membership notice is present.
- Aside installed extension reloaded to 0.1.16. Its actual panel shows the membership prompt and disables scan without login. Clicking login creates a dedicated website tab; the background membership check denies access while that tab is logged out.
- This uses the installed extension panel opened as a browser tab, not a completed toolbar/side-panel capture test.
- Clean submission ZIP prepared locally: `artifacts/card-pone-scan-0.1.16-store.zip`, 86,855,154 bytes, 5,460 entries, one root manifest, no detected environment files, source maps, node_modules or signing-key files.
- Blocked on user login to the dedicated website tab for the positive membership/logout tests and to the existing publisher account for the store update. No store draft changes, prior-review withdrawal, submission or publication performed.
- Code and this status are archived; reproducible ZIP/build directories remain local only. Signing-key backup remains unverified.

## Installed membership verification and store draft replacement

- Existing approved website test account successfully signed in: production membership API returned 200 and the installed 0.1.16 panel enabled Scan. Website logout then caused the background membership check to deny access and the reloaded panel disabled Scan. No account credentials or identifiers are recorded here.
- With explicit user approval, cancelled the pending 0.1.15 review. Portal confirmed cancellation and draft status.
- Uploaded the prepared 0.1.16 ZIP to the existing item `bmallhfmgjlccnegdjjlmhobcgocphlc`; portal confirmed package version 0.1.16 with storage permission. No duplicate item created.
- Saved member-only store description, scripting/storage/host permission explanations, authentication-information disclosure and updated login-required test steps.
- The portal requests test credentials for complete evaluation. Requested approval for a separate ordinary reviewer account; administrator and personal credentials were not shared with reviewers.
- Current state: 0.1.16 draft, not submitted or published. Re-submission awaits reviewer account authorization/preparation. Automatic publication has not been enabled.

## Reviewer account and completed resubmission

- With user authorization, created one dedicated ordinary reviewer account. Public signup/provider configuration and database schema were not changed. Administrator/personal credentials were not supplied to reviewers.
- Verified the new account through the production username/password login endpoint (200), then the production membership endpoint (200, matching member identity).
- Saved the new credentials only in the Chrome Web Store confidential test-instructions form. Credential values were not printed or stored in source, reports or local credential files; the temporary in-memory handoff completed and closed.
- Submitted package 0.1.16 for the existing item on 2026-09-26. The portal confirmed successful submission and staging for later publication. Automatic publication was explicitly unchecked before confirmation; approval will require manual publication (portal warns of a 30-day staging expiry).
- This follow-up changes release-status documentation only, with no website deployment or main push. Earlier installed-panel membership/logout verification and the uncompleted toolbar/side-panel capture test remain as recorded above.
- Credentials remain in the private store console, not a separate backup. Signing-key backup remains unverified. Reproducible local ZIP/build artifacts are not committed.
