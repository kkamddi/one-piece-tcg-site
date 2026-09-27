# Centering confidence verification — 2026-09-27

## Live evidence

- Restored the designated project browser connection and verified its profile. Installed extension 0.1.18 is enabled.
- The installed extension's login action opened the main homepage. With the approved website test account already signed in, connection verification enabled the scan button; reloading the extension panel restored that state. This does not certify toolbar capture or image matching.
- On the production centering screen, an unsupported SVG produced a file-format error with a retry action. Retrying with a generated plain-white PNG reached both outline and inner-boundary confirmation steps.
- Confirming the default boundaries for this deliberately blank image produced confidence 0% and the expected boundary warning, but also score 99 and directional conclusions. Those claims can mislead despite the warning.

## Minimal correction and verification

- Keep the existing confidence threshold and adjustment flow. Below that threshold, replace the displayed score with an em dash and omit direction conclusions. Preserve editable boundary ratios, confidence, warnings and grader CHECK states.
- `node --test scripts/testCenteringGeometry.mjs`: eight tests passed. Two added tests render the actual JSX fragments with reliable and unreliable states; the six existing geometric/image-analysis checks also pass.
- No dependency installation, full build, authentication or database changes. The fix has not been deployed or verified in the production browser after modification.
- Reviewed archive workflow triggers: no push trigger targets the archive branch. Repository hooks and open archive-branch pull requests were empty at verification time.

## Remaining limits

- The current browser API does not implement viewport resizing. This attempt provides no mobile viewport evidence; earlier mocked runtime checks are not device certification.
- Real calibrated-photo accuracy, physical devices, first-time social-provider consent, actual push delivery, and full extension toolbar capture are not certified by this check. Previously deferred items remain deferred.
- Synthetic test content contains no user photo, credentials or private records. No main push, production deployment or force push was performed.

## Subsequent live Web Push verification

- With the owner's explicit authorization, used the approved signed-in test account and the card-specific price-alert modal. The header bell only opens received notifications; it is not the permission-management entry point.
- Clicked the site's notification-permission action and accepted the browser's native notification prompt through accessibility (no system mouse input). `Notification.permission` became `granted`; the modal then showed push enabled and exposed its administrator test button.
- Clicked that test button exactly once. The UI reported successful sending. The site's service-worker notification list increased from one connection confirmation to two notifications, including the expected test-notification title. This is browser receipt evidence, not proof of an operating-system banner, physical-device delivery or cross-account logout cleanup.
- No price-alert rule was submitted, and no existing account, portfolio or pricing data was intentionally edited. The browser permission and this device's push subscription were enabled as authorized. No credentials, subscription endpoints or key material were read or recorded.
- The measured automation viewport was 1360 by 990, with document width 1360. The alert modal bounds were left 420, right 940, top 115, bottom 875. This confirms desktop containment only; the native window's narrow appearance must not be treated as mobile emulation.
- Actual Web Push receipt is no longer an unverified item for this browser/account. First-time social-provider consent and mobile/device-specific limits above remain unresolved. No application code or production deployment changed in this follow-up.

## Mobile-width browser layout follow-up

- Used a temporary same-origin iframe in an owned task tab to create a genuine child browsing-context viewport, without changing application code or browser settings. This is responsive-layout emulation, not a physical phone or top-level OAuth test.
- At 390 by 844, the live lab displayed its mobile bottom navigation. Navigating to centering, opening the public guide, and returning to the tool succeeded.
- Centering entry-screen checks at widths 320, 390 and 430 found document scroll width equal to client width (305, 375 and 415 respectively, after the desktop scrollbar). Camera/upload buttons stayed within the horizontal bounds; both had height 92 and respective widths 116, 151 and 171.
- The guide also had no horizontal overflow at width 390. The temporary iframe was removed after verification.
- No new layout defect was reproduced in this scoped check. Upload/result editing on mobile widths, touch gestures, device camera and OS-specific behavior are not covered by these observations.
