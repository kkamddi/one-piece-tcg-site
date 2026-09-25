# Card Pone Android Release

## Readiness review: 2026-09-07

Release preparation is in progress; this is not a production approval record.

| Item | Observed status | Required next step |
| --- | --- | --- |
| Play developer account | Personal account confirmed; D-U-N-S request submitted on 2026-09-07 | Wait for issuance, then complete organization conversion and Console verification |
| Android project | Application ID, min SDK 24 and target/compile SDK 36 configured | Validate the newly built artifact, not only Gradle source |
| Local build tools | Fresh web build, Capacitor sync, Android unit test task and release lint completed on 2026-09-07 | See android-verification-2026-09-07.md for evidence and remaining gates |
| Firebase and upload signing | Firebase package matches com.optcgkorea.cardpone; config and signing properties are Git-ignored | Verify actual signing and push delivery without exposing credentials |
| Existing APK/AAB | Fresh signed release APK/AAB generated 2026-09-07; APK installed on Galaxy S24+ | Preserve the candidate hashes; do not upload until remaining gates pass |
| Store graphics | Icon 512x512, feature graphic 1024x500; four new 1080x1920 JPEGs in store/android/screenshots-2026-09-07 | Approve content and rights; do not submit the older July screenshots |
| Runtime behavior | Galaxy S24+ basic tabs, offline recovery, camera/location denial, photo-picker cancellation, signed-in restart persistence and real FCM foreground delivery/tap checked; 25 automated tests passed | Individual login providers, FCM background/denial cases, account writes/deletion, controlled card measurement and remaining external links still require checks |
| Policy forms | Listing and Data safety remain drafts | Verify Ads, data types, account deletion and content rights before submitting |

Do not create a new upload key, change the application ID, upload a bundle, or submit policy declarations without owner confirmation. Check existing Console version codes before deciding whether versionCode 1 can be uploaded. D-U-N-S issuance and organization verification are not yet complete.

New app submissions currently require target API 36 from August 31, 2026: https://support.google.com/googleplay/android-developer/answer/11926878

Screenshot dimensions and other asset requirements: https://support.google.com/googleplay/android-developer/answer/9866151

## App identity

- App name: `Card Pone`
- Application ID: `com.optcgkorea.cardpone`
- Version: `1.0` (`versionCode 1`)
- Minimum Android: API 24
- Target/compile Android: API 36
- Production site: `https://www.optcgkorea.com`
- Privacy policy: `https://www.optcgkorea.com/privacy`
- Account deletion: `https://www.optcgkorea.com/privacy#account-deletion`

## Runtime and updates

The Play build contains the tested React UI and uses the production `/api` endpoints for cards, market prices, indexes, schedules, notifications, and account data. Those data changes are visible without an app update. UI or native permission changes are distributed through a new Play bundle. The production build intentionally does not use Capacitor `server.url` because it is a live-reload option rather than a production update mechanism.

## Authentication

- Email/password, Google, and Kakao use the existing Supabase Auth project.
- Supabase OAuth callback: `https://www.optcgkorea.com/`
- Android app callback: `com.optcgkorea.cardpone://auth/callback` (the production callback bridge opens the app)
- Keep `https://www.optcgkorea.com/` as the Supabase web redirect. The custom app scheme is not added to Supabase.
- Google and Kakao provider credentials stay in Supabase. They are not bundled into the app.

## Native push

1. Register Android app `com.optcgkorea.cardpone` in Firebase.
2. Put `google-services.json` at `android/app/google-services.json`.
3. Create a Firebase service account allowed to send FCM messages.
4. Store the full service account JSON in Cloudflare as `FIREBASE_SERVICE_ACCOUNT_JSON`.
5. Rebuild the AAB and use the admin-only test notification button.

The Android app stores its FCM token in the existing `user_push_subscriptions` table with an `fcm:` endpoint prefix. Existing VAPID web subscriptions and price-alert evaluation are unchanged.

## Data safety draft

- Collected: email address, user ID, nickname, collection/wishlist data, alert rules, app interactions, push token, and diagnostic request metadata.
- Purpose: account management, app functionality, personalization, notifications, fraud/security, and diagnostics.
- Processors: Supabase, Cloudflare, Google Identity, Kakao Login, and Firebase Cloud Messaging.
- Camera/photo access: the centering tool processes images locally in the reviewed component. Do not describe this as server collection merely because CAMERA is declared. Separately audit any community photo upload and location-assisted shop lookup before finalizing photo/location answers.
- Data is encrypted in transit.
- Users can delete their account in the app or request deletion through the public deletion URL.
- The Android build does not load the website AdSense script.

Confirm these answers against the final Firebase/analytics configuration before Play submission.

The home and shared advertising inquiry components return no content on Android; the website keeps them. AdSense is also excluded from Android. This does not by itself settle the Play "Contains ads" answer: review remaining sponsored content and affiliate behavior before submission.

The 2026-09-08 candidate additionally excludes Coupang/partner advertising, supplies navigation and public leader review controls on Android, and removes the SNKRDUNK referral URL on Android. Physical-product/source/map links remain. Disposable-account deletion passed on device with database cleanup verified; logout push isolation and stale-session HTTP handling remain unresolved. Latest results and limitations: `android-verification-2026-09-08.md`.

Policy references:

- Data safety and deletion: https://support.google.com/googleplay/android-developer/answer/10144311
- External deletion resource: https://support.google.com/googleplay/android-developer/answer/13327111
- Ads declaration: https://support.google.com/googleplay/android-developer/answer/9859455

## Release checklist

- Use Android Studio's embedded Java 21 (`C:\Program Files\Android\Android Studio\jbr`) for Gradle builds.
- Run a fresh dependency/security review; the earlier audit result is not evidence for the final release.
- `npm run build`
- `npx cap sync android`
- `gradlew testDebugUnitTest lintDebug assembleDebug`
- `gradlew :app:connectedDebugAndroidTest`
- Verify Google/Kakao callback on a physical account
- Verify FCM permission, token registration, foreground/background notification, and notification tap
- Reuse the existing upload keystore; confirm its secure backup outside Git (do not generate a replacement key)
- Build signed AAB with `gradlew bundleRelease`
- Signed bundle output: `android/app/build/outputs/bundle/release/app-release.aab`
- Upload listing icon, feature graphic, and phone screenshots from `store/android`
- Complete App access, Ads, Content rating, Target audience, Data safety, and Account deletion declarations
- For personal developer accounts created after November 13, 2023, run a closed test with at least 12 opted-in testers for 14 continuous days before applying for production access: https://support.google.com/googleplay/android-developer/answer/14151465
- Do not assume a pending organization conversion removes the testing requirement; use the verified account status and production-access prompts in Console.
- Do not mark login, FCM or deletion as passed based only on a successful build or the template ExampleInstrumentedTest.

## Signing backup

`android/keystore.properties` and `android/keystore/*.jks` are ignored by Git. Back up both files together in a secure password manager or encrypted offline storage. Losing the upload key complicates or blocks future updates.
