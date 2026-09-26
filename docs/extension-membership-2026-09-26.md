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
