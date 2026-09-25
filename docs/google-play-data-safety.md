# Google Play policy worksheet

Prepared 2026-09-07 from the current Android source and initial device checks.
Draft only: no declarations have been submitted or certified.

Updated 2026-09-08: Android excludes Coupang/partner ad components and supplies navigation, uses a non-referral SNKRDUNK URL, and hides public leader text reviews and their entry form. Website behavior is retained. These are release-surface restrictions, not a blanket conclusion that physical-product links are prohibited or that every vendor collects no data. See `android-verification-2026-09-08.md`.

## Data safety evidence

| Surface | Observed evidence | Draft treatment / remaining check |
| --- | --- | --- |
| Account | Public privacy text lists email, user ID, nickname and social profile information | Personal info collected when users choose account features; confirm provider-specific fields |
| Collection and alerts | Public privacy text lists owned cards, wishlist and alert rules | App activity / other user-generated content; confirm exact Console categories and backend retention |
| Community | CommunityPage.jsx implements user-selected image upload, posts and comments | Photos and user-generated content cannot be declared universally on-device; verify reachable Android flow |
| Centering | CenteringLab.jsx analyzes camera images locally | Do not mark centering images as collected solely because CAMERA permission exists; verify no transmission in final app |
| Push | native-runtime.js uses Firebase Cloud Messaging | Device or other identifiers; verify token lifecycle and messaging SDK data processing |
| Nearby shops | RenewApp.jsx stores coordinates in component state for sorting; Android declares foreground coarse/fine location and allowed-permission distance sorting was observed on device | No background-location permission. Current inspected handler does not send coordinates off-device; check the entire flow and SDKs before final location answer. Permission alone does not establish off-device collection |
| Diagnostics/security | Public privacy text lists IP, device/browser information and access records | Confirm actual logs, retention, categories and mandatory/optional handling |
| Advertising | Android excludes AdSense and inquiry banners; website banners remain; terms disclose affiliate links | Inspect remaining affiliate/sponsored content and approve the final Ads answer; removing inquiry banners alone is not a complete ads audit |

Collection and sharing are separate questions. A service-provider transfer can be exempt from the sharing definition but still count as collection. Verify each vendor and purpose instead of answering every sharing question "No".

Source entry points: `src/RenewApp.jsx` privacy sections, `RenewAdInquiry`, and `handleNearbySort`; `src/CommunityPage.jsx`; `src/CenteringLab.jsx`; `src/lib/native-runtime.js`; `index.html` Android AdSense guard. This worksheet is not a backend retention audit.

## Account deletion

- Public resource: https://www.optcgkorea.com/privacy#account-deletion
- Current in-app copy directs signed-in users to My Page; people without app access can email `optkr26@gmail.com`.
- Test deletion with an explicitly approved disposable account. Do not delete the owner's account.
- Completed on 2026-09-08: a seeded disposable account was deleted through the Android UI; auth/state/holding/purchase/push/notification counts were zero afterward. Owner data was preserved. Login with the deleted account failed; stale `/api/me` returned 500 and needs corrected unauthorized handling. Native logout push-unregistration also remains unresolved.
- Verify which records are removed, which must be retained, the retention period and the user-facing explanation before final declarations.

## Owner decisions before submission

- Confirm public developer identity after organization conversion. The Google login email and public support email are different fields.
- Confirm `optkr26@gmail.com` remains the monitored public support/deletion mailbox.
- Confirm intended age groups and whether community user-generated content is available at release; do not copy the previous 13+ proposal as an approved answer.
- Confirm rights to card artwork, trademarks, app screenshots and market-data use. An unofficial-service disclaimer does not grant rights.
- Approve Ads, content rating and Data safety after remaining device tests.
- Supply reviewer credentials privately in Play Console, not in repository files.

## References

- Data safety definitions: https://support.google.com/googleplay/android-developer/answer/10787469
- Account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- App content declarations: https://support.google.com/googleplay/android-developer/answer/9859455
