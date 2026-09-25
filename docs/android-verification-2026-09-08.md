# Android release verification: 2026-09-08

Status: tested candidate, NOT approved for production submission. No Play upload or website deployment was performed. Artifact hashes are in `android-verification-2026-09-07.md` and identify the APK installed at the end of this continuation.

## Android-only presentation changes

- Exclude advertising inquiry, partner advertising and Coupang affiliate components; retain website behavior.
- Remove supplies filter/hub entry and editorial supplies links. A saved or direct `/news/supplies` route renders the existing card-storage guide instead of affiliate products.
- Use `https://snkrdunk.com/en/` without the website referral code. Read-only HTTP check returned 200. A proposed category URL returned 404 and was replaced before the final build.
- Hide leader review entry and public text reviews on Android because reporting/blocking controls are absent. Preserve aggregate leader statistics and deck functionality; no stored reviews were removed.
- Ordinary physical-card/product/source/map links remain. Google Play does not categorically prohibit physical-goods purchase links. Avoid making an affiliate-traffic app the primary purpose.
- Final device screenshots: `artifacts/android-final-home-0908.png`, `artifacts/android-final-info-0908.png`. Information has no supplies tab or affiliate hub item. Review guards and direct-route fallbacks also have AST-based regression coverage; not every guarded screen was re-opened on this final APK.

## Disposable-account deletion

Only a purpose-created temporary account was deleted. The owner/admin account was logged out, not deleted or modified. The phone is left signed out; the owner must log in again.

- Public Auth settings were read first: email autoconfirm was enabled. A unique `example.invalid` address was used without sending mail or changing Auth settings. Credentials stayed in the interactive test process and were not written to files.
- Seeded one owned card, one wishlist entry, one portfolio holding and one purchase through normal authenticated application APIs. Fresh API login returned the same data.
- On the Galaxy S24+, signed in through the existing username/password form, verified My Page password reauthentication, and visually confirmed the exact temporary username/email before any deletion action.
- Entered the required Korean confirmation using the phone keyboard and submitted the in-app account-deletion form. The app returned to the signed-out home screen.
- Read-only database checks afterward returned zero rows for the temporary auth user, collection state, holdings, purchases, push subscriptions and notifications. State/holding/purchase rows had been present before deletion. No separate alert record was seeded, so this does not independently prove deletion of a populated alert rule.
- Fresh login returned 401 and the old token's Auth user lookup returned 403. The old token's `/api/me` request denied data but returned **500**, not the expected 401. Record this as an error-handling issue, not a fully correct stale-session response.
- Evidence: `artifacts/android-disposable-account-0908.json`, `android-test-identity.png`, `android-test-delete-ready.png`, `android-test-deleted-home.png`. The interactive test process exited after cleanup verification.
- This verifies existing password-account login and deletion. It does not establish successful Google/Kakao/Naver OAuth callbacks individually, nor end-user social signup.

## Additional physical-device checks

- Background FCM delivery: passed. Sent the signed-in user's admin test notification, backgrounded the app, and observed a new package notification after background entry. Evidence: `artifacts/android-background-push-evidence.json`.
- Process-dead notification tap: passed. Killed the background process with `am kill`, confirmed no PID, then tapped the already-delivered notification. Card Pone reopened to prices. Evidence: `artifacts/android-push-cold-start-0908.png`. This is not a claim of notification delivery after Android force-stop.
- Approximate-only location: the OS granted coarse access without fine access, but nearby lookup showed location unavailable. Default shops stayed usable. Approximate distance sorting is **not passed**. Fine permission and test-added flags were restored afterward.

## Automated and artifact checks

- Four Node regression scripts: `testAndroidRuntime`, `testAndroidIntegrations`, `testHomeIndexRecovery`, `testAndroidPresentation`: **28 passed, 0 failed**. Mock tests are distinguished from live device/account results above.
- Fresh `npm run android:sync`, release lint, Android unit-test task, signed APK and AAB build, and bundletool validation passed with the existing upload key.
- APK signature v2 verification and `zipalign -c -P 16 4` passed. Final APK installed using `adb install -r` and launched successfully.
- The existing 16 KB ELF static check is recorded in the preceding report; execution on a 16 KB runtime remains pending.

## Unresolved before production approval

1. Logout currently does not deactivate this device's native push subscription. Approval was requested for an auth-related fix; it has not been applied. Verify logout/account-switch notification isolation after fixing.
2. Deleted-user requests to `/api/me` return 500 rather than 401. Approval was requested for the auth error-handling change; it has not been applied or deployed.
3. Approximate-only location sorting, notification denial/recovery, each social-provider callback, controlled real-card centering measurement and final external destinations remain incomplete. Chrome first-run setup previously blocked destination validation; existing browser tabs were not touched.
4. D-U-N-S/organization verification, Console version/certificate checks, bundle acceptance, pre-launch report and reviewer credentials remain pending. No upload was authorized.
5. Owner approval is still needed for artwork/trademark/data-use rights, developer/support identity, retention statements, age/content rating, Ads and Data safety declarations. A non-affiliation disclaimer does not establish artwork permission.

## Official policy references

- Physical goods and payments: https://support.google.com/googleplay/android-developer/answer/9858738
- Affiliate spam: https://support.google.com/googleplay/android-developer/answer/9899034
- User-generated content: https://support.google.com/googleplay/android-developer/answer/9876937
- Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Intellectual property: https://support.google.com/googleplay/android-developer/answer/9888072
