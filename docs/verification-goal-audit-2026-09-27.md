# Verification goal audit — 2026-09-27

This is a scoped continuation, not a complete certification. No production deployment, main update, credentials, database writes or new dependency installation occurred in this audit.

## Fresh local evidence

- `node --test scripts/testCenteringGeometry.mjs scripts/testAndroidRuntime.mjs scripts/testAndroidPresentation.mjs`: 18 passed, zero failed/skipped.
- Compared `src/CenteringLab.jsx`, `src/lib/native-runtime.js` and those three test files with deployed commit `05edde16fc3021d0292d385cb0f4e523b830a96b`; all match after line-ending normalization.
- Centering checks exercise known border ratios, tilted-frame worst-edge reporting, crossed/tiny outline rejection, equal-contrast edge handling, synthetic asymmetric capture and blank/missing-edge confidence. They do not establish measured real-photo accuracy.
- Native-runtime checks replace native bridges with test doubles. They cover API request preservation, idempotent initialization, Back handling and notification-tap routing, not physical-device behavior or actual notification delivery.
- No new defect was reproduced; application code was not changed.

## Requirement status

| Requirement | Evidence and remaining limit |
| --- | --- |
| Login and account-specific storage | Prior controlled two-account login, portfolio save/reload/cleanup and read-isolation checks are recorded in `site-verification-2026-09-26.md`. They were not rerun with live accounts in this audit. |
| Logout and notification isolation | Prior live logout/read isolation plus mocked regression evidence exists. Real push delivery and receipt are not certified. |
| Social login | Prior Naver/Kakao existing-session returns passed. A Google identity collision was deferred by the owner. First-time provider consent remains unverified. |
| Photo centering | Fresh synthetic checks pass. Calibrated real-photo/device measurements were deferred by the owner, not passed. |
| Mobile | Fresh mocked native runtime/presentation checks pass. Physical devices remain excluded/deferred by the owner. |
| Code preservation | Previous fixes and deployment evidence are on the existing archive branch. This audit adds documentation only; unrelated working changes are preserved. |

## Earlier live-verification blocker (resolved)

The designated Aside CLI session reported that its task browser window was no longer available in the original browser mode and requested reopening the task in the intended window. No other browser/profile was used to bypass this condition. The 0.1.18 package exists locally and was submitted for review, but installation in the user's visible Card Pone profile and live toolbar capture remain unconfirmed. Browser attachment must be restored in the designated profile before claiming those checks complete.

The browser attachment was subsequently restored in the designated profile. Installed extension 0.1.18 and its member connection were verified; full toolbar capture remains separate and unverified. This earlier attachment failure is no longer a blocker.

## Updated evidence after the initial audit

- `centering-confidence-verification-2026-09-27.md` records actual Web Push browser receipt, mobile-width upload/outline/result/re-entry flows, and current 20-test centering/native regression results. These supersede the initial missing-receipt and entry-only mobile evidence, but do not certify OS banners, touch input or physical devices.
- `web-push-logout-verification-2026-09-27.md` records delivered-notification cleanup and 27 passing mocked logout/integration/isolation tests. The fix is preserved in archive commit `d74f330`; it is not deployed.
- The low-confidence centering display correction is likewise archived, not deployed. Production behavior must not be described as fixed yet.
- Remaining verification gaps include first-time social-provider consent (no fresh provider identity designated), actual mobile pointer/touch adjustment, and live post-deployment checks of archived fixes. Calibrated-photo accuracy and physical devices remain owner-deferred/excluded; the known Google identity collision was deferred rather than resolved.

The goal remains open pending applicable remaining checks. Signing-key backup remains a separate unverified task. User photos and reproducible build packages remain local-only. No main update or production deployment is authorized by this audit.
