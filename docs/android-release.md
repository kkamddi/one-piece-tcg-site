# Card Pone Android Release

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
- Not collected by the Android app: precise location, contacts, photos, audio, payment card information, or health data.
- Data is encrypted in transit.
- Users can delete their account in the app or request deletion through the public deletion URL.
- The Android build does not load the website AdSense script.

Confirm these answers against the final Firebase/analytics configuration before Play submission.

## Release checklist

- Use Android Studio's embedded Java 21 (`C:\Program Files\Android\Android Studio\jbr`) for Gradle builds.
- `npm audit`: 0 vulnerabilities
- `npm run build`
- `npx cap sync android`
- `gradlew testDebugUnitTest lintDebug assembleDebug`
- `gradlew :app:connectedDebugAndroidTest`
- Verify Google/Kakao callback on a physical account
- Verify FCM permission, token registration, foreground/background notification, and notification tap
- Generate and back up the upload keystore outside Git
- Build signed AAB with `gradlew bundleRelease`
- Signed bundle output: `android/app/build/outputs/bundle/release/app-release.aab`
- Upload listing icon, feature graphic, and phone screenshots from `store/android`
- Complete App access, Ads, Content rating, Target audience, Data safety, and Account deletion declarations
- For personal developer accounts created after November 13, 2023, run a closed test with at least 12 opted-in testers for 14 continuous days before applying for production access: https://support.google.com/googleplay/android-developer/answer/14151465

## Signing backup

`android/keystore.properties` and `android/keystore/*.jks` are ignored by Git. Back up both files together in a secure password manager or encrypted offline storage. Losing the upload key complicates or blocks future updates.
