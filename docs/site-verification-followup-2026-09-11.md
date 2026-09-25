# Verification Follow-up - 2026-09-11

## Scope and Safety

- Continued the remaining verification after production release `1464166`.
- Used a separate Codex Debug browser session and the existing local dev server.
- Local APIs proxy to production. No account was created, changed, or deleted; no real notification was sent.
- No deployment, dependency installation, full build, or production configuration change was performed.

## Verified

- Android integration/runtime/presentation and home recovery scripts: 28 tests passed. These use mocks, not live OAuth or a physical device.
- Deck builder: loaded the Sabo preset with 50 cards, reduced OP12-086 from 4 to 3, observed 49/50 and the incomplete-deck warning, reloaded the page and recovered the same 49-card deck. Restored 4 copies and 50/50. An additional increment did not exceed four copies.
- Deck persistence is browser-local; this does not establish cross-device account persistence.
- Login dialog exposes Google, Kakao, Naver, and password login. No credentials or provider flow were submitted.
- No errors or warnings were observed in the inspected local browser log.
- Latest sampled GitHub runs for market collection, trading history, catalog sync, market index, PSA10 index, official topics, and operations report succeeded. Workflow success does not verify every quote or live storage usage.
- Production `/api/me`: no token returns 401; a synthetic invalid token returns 500. No real account token was used.

## Fixed Locally

The production Secret scan run `34592887093` failed on Google-key-like substrings inside binary image descriptors in:

- `public/card-scan/EN/ST14-010.json`
- `public/card-scan/JP/OP09-084.json`

Both matches were within canonical Base64 ORB descriptors, each 5,760 decoded bytes for 180 points, rather than credential fields.

- `scripts/scan-tracked-secrets.mjs` now masks only canonical descriptors with the expected byte-to-point ratio in version-3 card-scan JSON paths. Metadata, malformed descriptors, other schemas, and other paths remain scanned. Original line positions are preserved.
- `scripts/testSecretScan.mjs` verifies valid binary data, metadata key detection, invalid lengths, invalid point types, older schemas, other paths, and redacted output.
- The regression test passed, and the tracked-file scan passed for 5,865 files. `git diff --check` passed.
- The correction has not been committed or deployed; the existing remote failed run is unchanged.

## Open Issues and Remaining Checks

1. `src/RenewApp.jsx` logout still signs out without removing this device's push subscription. Account-switch notification isolation needs a fix and live verification.
2. `api/me.js` throws Auth lookup errors into its generic 500 response. Invalid/deleted credentials must be distinguished from genuine backend outages. Authentication changes were requested for approval and have not been applied.
3. ADB detected no connected Android device. Physical-device permissions, offline recovery, notification delivery/tap, approximate location, and native Back remain pending.
4. Actual social-provider callbacks and account persistence require a controlled login. The previous disposable-account deletion results from September 8 are historical evidence, not a fresh test of this release.
5. Centering photo input, calibration, and controlled measurement remain pending. Only the entry screen was inspected in this continuation.
6. Live D1/R2 usage, exact per-variant price correctness, and real mobile initial-load performance remain unverified.

References: `docs/site-audit-2026-09-11.md` and `docs/android-verification-2026-09-08.md`.
