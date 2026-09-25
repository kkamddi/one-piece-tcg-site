# Android release candidate: 2026-09-07

Status: candidate built and installed, NOT approved for production submission.
No Play Console upload, policy submission, account conversion or website deployment was performed.

Updated 2026-09-08. The artifact table is current; the chronological sections below retain earlier results. See `android-verification-2026-09-08.md` for the latest deletion, policy-surface and device checks and unresolved issues.

## Candidate artifacts

| Artifact | Location | Bytes | SHA-256 |
| --- | --- | --- | --- |
| Signed APK for device testing | android/app/build/outputs/apk/release/app-release.apk | 23269507 | 0B4D0C76170EA7DBE41829F69FFEDEECB9D4EA07D9480EC776C4828810AC6848 |
| Signed AAB for eventual Play upload | android/app/build/outputs/bundle/release/app-release.aab | 22872059 | 847C1C312917C8807EC40D35D222B5079E1E6483D6B62E153EBCB27A4A83E6BD |

Package: `com.optcgkorea.cardpone`, versionName `1.0`, versionCode `1`.
The existing upload key was reused. Rebuilding overwrites these paths and invalidates the recorded hashes.
Version-code availability in Play Console remains unverified.

## Completed checks

- `npm run android:sync`: current web build and native asset sync succeeded.
- `:app:testDebugUnitTest`: existing test task passed; this is not login or end-to-end coverage.
- `:app:lintRelease`: no errors; 15 non-blocking warnings remain (dependency updates, unused/template resources, launcher monochrome and splash resources).
- `:app:assembleDebug :app:assembleRelease :app:bundleRelease`: succeeded.
- Release APK signature verification: passed, APK Signature Scheme v2, existing RSA 4096-bit key.
- AAB `jarsigner -verify`: reported `jar verified`; emitted self-signed certificate, timestamp and ZIP/JarInputStream ordering warnings. This is not a substitute for bundletool/Play validation.
- Google bundletool `validate`: passed using the existing Android Gradle build classpath. Re-run with `gradlew -I ../scripts/validateAndroidBundle.gradle validateReleaseBundle` from `android`.
- Release APK manifest: min API 24, target/compile API 36, camera/autofocus optional, foreground coarse/fine location declared. No background location or broad media/storage permission declared.
- `zipalign -c -P 16 4`: passed for the APK. This checks ZIP alignment only, not every native ELF segment or behavior on a 16 KB device.
- Android NDK `llvm-readelf -lW`: all LOAD segments in the four packaged `libdatastore_shared_counter.so` ABI variants have `0x4000` alignment (16 KB). Runtime testing on a 16 KB device remains pending.
- `npm audit --omit=dev --audit-level=high`: zero known runtime dependency vulnerabilities at check time.
- Signed release APK installed successfully on owner-approved Galaxy S24+ (SM-S926N), preserving existing application data.
- Home rendered with live market index values and banner inquiry; catalog and prices tabs opened with current UI and image content.
- Android system Back returned from prices to the previous catalog screen.

Device screenshots are under `artifacts/android-release-*-20260907.png`. These 1080x2340 diagnostic captures are NOT compliant store screenshots and may contain system status indicators.

### Android inquiry-banner exclusion update

The artifacts above supersede the initial candidate. `RenewHomePromoBanner` and `RenewAdInquiry` now return null when Capacitor reports Android. Website behavior is unchanged. Web build/sync, release lint, signed APK/AAB build and bundletool validation were rerun successfully. The updated release APK was installed with data preserved; home and catalog screenshots confirm banner removal and reclaimed space (`artifacts/android-no-inquiry-*-20260907.png`). Initial screenshots showing banners are historical evidence, not this candidate's UI. Other initial device checks have not all been repeated after this update.

## Additional runtime regression checks

`node --test scripts/testAndroidRuntime.mjs`: 6 tests passed. The script bundles the real `src/lib/native-runtime.js` with local native-bridge doubles and checks web isolation, native API URL routing, fetch Request preservation, idempotent setup, Back/modal handling and notification-tap routing. It makes no production API calls and does not replace device-level authentication, camera or FCM delivery testing.

An existing API 36 AVD had an incompatible development signature; its application was not uninstalled. Isolated temporary AVD attempts did not provide an authorized ADB session, so no emulator screenshot or device-test pass is claimed. Test emulator processes started in this session were stopped.

### Foreground location and resumed physical-device checks

After the owner's continuation, foreground coarse/fine location permissions were added for the existing nearby-shop geolocation flow. Release lint, signed APK/AAB builds, APK signature verification and bundletool validation passed again. The new APK was installed with existing data preserved; the hashes above identify this build.

- Nearby shops: Android location permission prompt appeared; after permission was allowed, nearby sorting and shop distances rendered successfully. Denial and approximate-only cases remain unverified.
- Centering: the camera permission prompt appeared, and a subsequent app screen showed a captured image in the first-step outline editor. This verifies entry into the photo correction flow, not measurement accuracy on a real card or denied-permission recovery.
- Manual phone interaction overlapped test taps, so neither attempted permission-denial check is recorded as passed. Further device control paused for the owner to log in.
- Diagnostic captures may show surroundings or nearby locations; do not use them as public store assets. Files named `android-location-denied.png` and `android-camera-denied.png` do not prove denial; the observed screens instead show successful location sorting and the photo editor.
- Initial captures used the physical display resolution. The extended verification below subsequently captured store-sized images with a temporary resolution override and restored the original display.

## Extended verification and fixes

The owner requested comprehensive verification. Two reproducible issues were fixed with scoped changes:

1. `src/RenewApp.jsx`, `RenewHomeMarketIndex`: an offline cold start left the market index absent after connectivity returned. It now reloads on the online event, ignores stale responses and removes its listener on unmount. Device evidence: `artifacts/android-network-recovery-fixed.png` shows the indexes restored without navigation after Wi-Fi/mobile data were re-enabled.
2. `src/CenteringLab.jsx`: camera denial incorrectly directed Android users to browser settings. Android-specific KR/EN/JP text now points to application permissions. The KR error screen was rechecked in the final APK: `artifacts/android-camera-denial-fixed.png`.

Final web build/Capacitor sync, release lint, Android unit test task, signed APK/AAB build, bundletool validation, APK signature and ZIP alignment checks passed. The final APK was installed with existing application data preserved. The artifact hashes above supersede all earlier candidates.

### Automated checks

`node --test scripts/testAndroidRuntime.mjs scripts/testAndroidIntegrations.mjs scripts/testHomeIndexRecovery.mjs`: **23 passed, 0 failed**.

- Six native runtime regression tests cover routing, fetch preservation, modal Back and notification navigation.
- Fourteen isolated integration tests exercise the real auth/push/account client modules with mock services: provider launch, code/token callbacks, cancellation/errors, permission denial, registration failure/timeout, cleanup, API/network errors and account deletion session gating. No real account was deleted or created; no test FCM notification was sent.
- Three tests extract the real home-index component via Babel AST and verify reconnect retry, stale-response protection and cleanup. This does not replace the accompanying device reconnect check.
- Runtime dependency audit: 0 known vulnerabilities at check time.
- APK inspection: packaged web index exists, native HTTP enabled, no remote development server URL, no source maps or keystore files. Scanned public JS/JSON/HTML had no private-key, service-account JSON or `sb_secret_` patterns. This is a bounded pattern scan, not a proof that every possible secret is absent.
- Read-only production API probes: one-card list 200; exact `EB01-001` search 200 with three results including a matching number; sample card image 200; shop regions 200; unauthenticated push status 401. `/privacy` and `/native-auth-start` returned HTML 200. Static privacy HTML did not itself establish the rendered deletion-anchor behavior.
- Available app exit history contained package updates, user/system termination and normal exits, not crash/ANR reasons. Current-process filtered logs at check time had no fatal exception or uncaught JavaScript error. This is not full long-duration stability coverage.

### Physical-device matrix

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| Home, catalog, prices, laboratory, information, shops | Passed basic rendering/navigation | Actual cards and prices displayed; inquiry components absent on Android |
| Login modal and Android Back | Passed | Modal closes without leaving underlying screen; empty login form is disabled |
| Cold restart | Passed | App starts with UI and live index data |
| Offline cold start | Passed basic startup | Packaged UI renders; network-only data may be absent; cached data may remain |
| Network restoration | Passed after fix | Same home screen reloads indexes after connectivity returns |
| Camera permission denial | Passed after copy fix | Non-crashing error screen with Android permission-setting guidance |
| Camera allowed, preview, cancel | Passed basic flow | Live preview observed, cancel returns to entry; earlier capture reached outline editor |
| Image picker and cancel | Passed | Android Photo Picker activity opened and returned to entry; no personal photo selected or inspected |
| Real-card centering accuracy / photo-selection-to-result | Not verified | No controlled card image was supplied for a full measurement |
| Foreground location allowed | Passed | Nearby sorting and distances displayed |
| Location denied | Passed | Permission error and default shop list remain usable |
| Approximate-only location | Not verified | Exact and coarse permissions restored to original granted state |
| External product link | Partial | Handoff to Chrome observed; Chrome FirstRunActivity blocked final page display; browser setup was not changed |
| Signed-in state and session persistence | Passed after owner login | Admin menu present; force-stop/restart and final APK replacement preserve the session; provider used by owner was not observed |
| Email/Google/Kakao provider flows individually | Not device-verified | Existing authenticated session is not evidence that every provider callback works |
| FCM allow, registration, delivery and tap | Passed on physical device | OS permission allowed, app reports enabled, real admin-test notification appears in Android notification records; tapping it opens the app prices screen |
| FCM denial, background delivery and killed-app tap | Not fully device-verified | Isolated regression tests pass; foreground delivery/tap does not establish all lifecycle cases |
| Existing portfolio and notification reads | Passed | Portfolio values load after restart; existing account notification inbox loads |
| Collection/wishlist writes and account deletion | Not device-verified | Existing account data was preserved; destructive deletion requires a disposable account |

Wi-Fi and mobile data were restored to their original enabled states. Camera, coarse and fine location grants were restored, including clearing only the test-added permanent-denial flag. Physical size was confirmed as 1080x2340 with no override. The signed-in continuation below enabled notifications and registered this device; no collection/account records were deleted.

### Signed-in continuation and final presentation fixes

- Owner completed login. Admin account menu, existing notification inbox, and existing portfolio values were observed. Force-stop/restart and installing the final APK with `-r` preserved authentication. Evidence: `android-session-persisted.png`, `android-final-session.png` under `artifacts/`.
- My Page correctly displayed a current-password reauthentication gate. No password was collected or bypassed; protected account editing/deletion was not tested.
- Native notification permission was allowed and registration succeeded. The admin test button reported success; Android recorded `card-pone-push-connected` and `card-pone-admin-test-*` notifications for this package. Expanding the notification group and tapping the test notification brought Card Pone to the foreground on its prices screen. Evidence: `android-push-registration.png`, `android-test-push-result.png`, `android-push-tap-open.png`.
- An EB04-007 rule registration confirmation was visible during device interaction, but the agent did not submit that rule; it was preserved. This observation is not counted as an independently controlled create/delete test.
- `src/RenewApp.jsx`: Android push-denial guidance now points to Android app notification settings; web guidance remains unchanged. This copy change has automated coverage but the final denial screen was not re-exercised on device.
- `src/RenewApp.jsx`: supplies partner iframes displayed `Access Denied` in the WebView. Android now uses the existing text-preview fallback and unchanged product links/disclosure; web iframe previews remain unchanged. Final-device evidence: `artifacts/android-supplies-fixed.png`. External product destination remains blocked by Chrome first-run setup.
- All four scripts (`testAndroidRuntime`, `testAndroidIntegrations`, `testHomeIndexRecovery`, `testAndroidPresentation`, each `.mjs` under `scripts/`) passed: **25 tests, 0 failures**. Presentation coverage evaluates the real AST-extracted JSX and denial message for Android/web.
- Final web build/sync, release lint, unit task, signed APK/AAB, bundletool validation, APK signature v2 and 16 KB ZIP alignment checks passed again. The hashes at the top identify this final build. Supplied screenshots precede these small presentation changes; no new public account screenshots were generated.
- Final installed process logs had 0 matching fatal exceptions/uncaught JS errors in the bounded current-process sample. No assertion of complete long-duration stability is made.

### Store screenshots

Four real-device JPEG captures are in `store/android/screenshots-2026-09-07/`: home, catalog, card prices and laboratory. Each is 1080x1920, without alpha, and passed a nonblank-pixel check and visual inspection. Catalog and prices were recaptured with actual card content visible. A failed black external-browser capture was replaced and is not among the final four. The temporary display size was restored after each capture. These are asset candidates; final content/rights approval remains required. Earlier 1080x2340 diagnostic captures must not be submitted.

## Minimal code fix

`android/app/src/main/AndroidManifest.xml`: explicitly mark camera and autofocus hardware optional. Camera access remains available for the centering tool; non-camera devices are not excluded merely by the camera permission.

The same manifest declares foreground coarse/fine location for nearby-shop sorting. No background-location access was added.

## Required before upload/submission

- [ ] D-U-N-S issued, organization conversion completed and Play Console verification/production access checked.
- [ ] Confirm versionCode against existing uploads and compare upload certificate with Console.
- [x] Validate the final AAB with bundletool and inspect native ELF 16 KB alignment.
- [ ] Check Play bundle acceptance and pre-launch report; test on a 16 KB runtime.
- [x] Capture four current phone screenshots at 1080x1920 JPEG without alpha and check for blank images.
- [ ] Approve screenshot content, artwork rights and final store selection.
- [ ] Verify email, Google and Kakao login/callback on device using an approved test account. Do not record credentials in Git.
- [ ] Verify sign-out and collection/wishlist persistence, then account deletion using a disposable account only.
- [x] Verify Android notification permission allow, token registration, actual foreground test delivery and notification tap.
- [ ] Verify notification permission denial/recovery, background delivery and killed-app notification tap on device.
- [x] Verify camera permission deny/allow, preview and cancel, and image-picker open/cancel.
- [ ] Verify a controlled real-card image through the full centering measurement and selected-photo flow.
- [x] Verify nearby-shop lookup after foreground location permission is allowed.
- [x] Verify nearby-shop permission denial preserves the default list.
- [ ] Verify approximate-only permission and unavailable-location recovery.
- [x] Verify system Back, cold restart and Wi-Fi/mobile-data offline startup/recovery.
- [ ] Complete external store/map/email destination checks after Chrome setup; airplane mode itself was not toggled.
- [ ] Confirm developer/support identity, privacy retention/deletion details, content rights, target audience, Ads, App access, Data safety and content-rating answers.
- [ ] Create reviewer access instructions in Console, with a dedicated account and no expiring verification requirement.
- [ ] Confirm secure backup of the existing upload key and credentials.

## Official references checked

- Target API: https://support.google.com/googleplay/android-developer/answer/11926878
- Store assets: https://support.google.com/googleplay/android-developer/answer/9866151
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
