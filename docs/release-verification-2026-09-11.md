# Release Verification - 2026-09-11

## Changes

- `/api/me` and push-subscription authentication reject invalid, expired, and deleted-user tokens with 401. Backend outages and rate-limit failures are not misclassified as invalid credentials. User-state responses are private and uncached.
- Logout deactivates the current device's push endpoint before local session signout. Native cleanup unregisters the FCM token and removes delivered notifications. In-flight registration saves finish before deactivation; older queued registrations are cancelled. Failed cleanup does not report successful logout.
- Android nearby sorting accepts an existing coarse-location grant for the app origin, without asking the user to upgrade to precise location. Other origins cannot receive this shortcut. Existing camera/file-picker handling remains inherited from Capacitor.
- Centering edge detection uses the midpoint of a contiguous equal-contrast plateau rather than its first pixel, removing directional bias from that comparison window.
- Secret scanning excludes only structurally validated binary ORB descriptors, while retaining checks on metadata and malformed files.
- Preserved the previously prepared Android location declarations, optional camera hardware declarations, and Android-specific camera-denial guidance.

## Automated and Build Verification

- All 133 discovered Node tests passed in the final working tree.
- Added coverage for token rejection versus backend failures, native/web push cleanup, late registration saves, logout failure UI, centering ratios/invalid outlines/edge plateaus, and secret-scan false positives.
- Vite production compilation passed. Existing large-chunk and OpenCV browser-externalization warnings remain; this is not a mobile performance certification.
- Signed release APK/AAB, release lint, and Android unit-test tasks passed using the existing upload key.
- Final AAB passed bundletool validation. Final APK passed signature v2 verification and 16 KB zip alignment checks.
- Final APK installed successfully using `adb install -r`; no application data was cleared. No Play Console upload or submission was performed.

Final SHA256:

```text
APK 62A9BD63C4DCF79D845AF46097B4AF2903292793C1F46CB282EE2AFCA39A53BA
AAB 2FF0072CE1F3CEDA19BC088A7C4BF3E5DE3D65BE6C6B624951309F64518B3774
```

## Physical Device

- Galaxy S24+ was connected and authorized. Updated home displayed integrated search; native navigation and the login-dialog Back action worked.
- Nearby sorting passed with precise location. The coarse-only failure and repeated precise-location prompt were reproduced, then coarse-only sorting passed after the native fix. Permission state was checked to confirm fine=false/coarse=true during the successful test. The original fine permission was restored afterward.
- Android photo picker, local image decoding, outline confirmation, print-boundary dragging, and result rendering were exercised using a synthetic calibration image. A screenshot of the test UI was initially selected and replaced with the intended fixture; no unrelated user photo was selected.
- The synthetic 60:40 fixture exposed the equal-contrast edge-selection bias. Regression coverage verifies the correction; this record does not claim exact physical-card measurement accuracy from the initial result.
- Evidence is local under `artifacts/android-0911-*`; screenshots and calibration files are not release source.

## Explicit Limits

- No account was created or deleted, and no owned-card, wishlist, portfolio, or alert-rule data was changed during this continuation.
- Social-provider login was requested from the owner but not completed during the recorded checks. Actual OAuth callbacks, live logout/push isolation, real notification delivery, and fresh cross-device account persistence remain pending; mock tests are not substitutes.
- Real-card camera capture/calibration remains pending. Synthetic-image interaction is not a test of lighting, glare, card variants, or camera optics.
- Full physical-device offline recovery, notification denial/recovery, live D1/R2 usage, and real mobile load-performance measurement remain outside the completed checks.
- A website deployment does not update installed Android UI code. Distribute the newly built app separately after the remaining Play release gates are satisfied.

Supabase error classification reference: https://supabase.com/docs/guides/auth/debugging/error-codes
