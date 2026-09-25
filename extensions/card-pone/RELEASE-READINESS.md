# Card Pone Scan - Submitted for Review

Updated: 2026-09-25. Version 0.1.15 submitted; Chrome Web Store status is pending review. Not published.

## Current submission: 0.1.15

- Submitted through Aside MCP using publisher `optkr26@gmail.com`, with the user's explicit submission authorization.
- Store item: `bmallhfmgjlccnegdjjlmhobcgocphlc`. Portal confirmed successful submission and pending review.
- Automatic publication was unchecked before submission. After approval, manual publication is required; the portal warns that staged items expire after 30 days.
- ZIP: `artifacts/card-pone-scan-0.1.15-store.zip` (86,853,694 bytes, 5,460 entries, exactly one root manifest).
- SHA256: `1E944DADD178DFFEDC9FE3F5237A3C7C8B2F08E5D212B34B69C5C09481D6DE47`.
- Clean build: `artifacts/card-pone-store-1790321779986/`. No environment files, source maps, node_modules, nested manifest or promo HTML in the ZIP.
- Portal package version 0.1.15 was verified after processing. Existing listing, privacy declarations, free/public distribution and valid start-screen asset were retained. Reviewer instructions were saved (no login/payment, scan, candidate confirmation, prices and links).
- Installed Aside extension was reloaded and showed 0.1.15. User-confirmed capture/recognition/prices were on 0.1.14; 0.1.15 has the focused and image regression evidence below, not a newly completed installed-side-panel capture test.
- Submission evidence: `artifacts/card-pone-store-assets/0.1.15-review-pending.png`.
- Earlier release gates and draft-package details below are historical unless explicitly repeated here. No website production deployment was performed for this submission.

## Local 0.1.15 cross-card match fix

- Reviewed the extra candidates: Sabo EN-198553 incorrectly matched Zoro EN-200263 / EN-197796 with 10-11 inliers and no upper-central artwork support. Luffy JP-94909 uses the catalog alias OPC-P-001 for P-001; it remains an ambiguous language/printing candidate, not a different card number.
- Weak matches now require at least three upper-central artwork inliers. Glare/foil matches without those points must instead have at least 25 inliers, 75% inlier ratio and 15% reference coverage. Existing minimum geometry checks remain.
- No per-product blacklist or forced OCR-number filtering was added. Test code normalizes the narrow OPC-P-NNN alias for auditing only.
- Final 56-condition image-only rerun: 56 retrieved, 56 expected top-one, zero cross-number cases, zero incorrect automatic prices; 29 legitimate ambiguous cases still require confirmation.
- Yamato JP-328527 and Robin JP-822582 real-photo regressions each retain their sole correct match (16 and 30 inliers).
- 54 focused tests passed, including a new weak-frame/watermark regression. Local 0.1.15 build succeeded at `artifacts/card-pone-extension/`.
- Changed files: `src/lib/card-image-features.js`, `scripts/testCardImageMatch.mjs`, `scripts/verifyCardImageSamples.mjs`, extension manifest, and this report. Subsequent reload and store submission are recorded above.
- Metrics are limited-fixture evidence, not all-card accuracy. Earlier trial thresholds regressed valid glare/foil matches and were not shipped; only the final rerun above describes 0.1.15.

## Historical image-only validation (0.1.14)

- User confirmed Aside capture, recognition and won price display work after the 0.1.14 reference fallback fix. This confirms that reported case, not every card.
- Command: `node scripts/verifyCardImageSamples.mjs --image-only --glare`.
- 28 cached JP/EN reference thumbnails, two synthetic conditions each: perspective/darkness and perspective/darkness plus translucent glare. Both locales' full indices supply the shortlist; the correct card number is not supplied.
- 56/56 retrieved, 56/56 expected printing ranked first; 29 ambiguous cases, zero incorrect automatic price displays. Local processing 1.735-3.147 seconds per fixture, excluding browser OCR/network/capture.
- Report: `artifacts/card-image-validation/image-only-report.json`.
- Three conditions also verified candidates with other card numbers: EN-198553 perspective includes EN-200263 and EN-197796; EN-200267 both conditions include JP-94909. Confirmation prevents automatic prices, but these cross-number matches need artwork/geometry review before release. Do not count top-one success as exact-candidate precision.
- Real supplied photos were rechecked independently: Yamato JP-328527 / OP04-112 (16 inliers), Robin JP-822582 / OP14-084 (30 inliers); each was the sole verified image match.
- The initial synthetic glare run is invalid: OpenCV's `clone()` shared the Mat storage and altered the source image. The harness now uses `copyTo()`; only the rerun metrics above are valid.
- Production and extension implementation unchanged during this validation. Release remains paused; these limited fixtures do not establish all-card accuracy.

## Local 0.1.13 accuracy revision

### Local 0.1.14 reference recovery

- A successful remote catalog load no longer disables packaged fallback for later index/file failures. After the first remote read failure, this scan uses validated packaged references; cancellation still aborts.
- Fixed injected-reader precedence so the extension fallback reader is actually used.
- Incomplete analysis no longer displays the definitive no-matching-card message.
- 23 focused tests passed and local extension build completed.
- Supplied Aside Robin screenshot (image region x=0, y=165, w=560, h=773) identified only JP-822582 / OP14-084 in the CLI JP/EN image-only test, with 30 inliers. This is not an installed-extension end-to-end pass.
- Screenshot proves reference comparison failed, but does not identify its exact exception. Production catalog download was slow and hash-valid; no conclusive installed-runtime network error was available.

- User requested accuracy improvements before submission. The 0.1.12 store draft below is superseded for release; do not submit it.
- Added three holder-interior crop hypotheses and region-balanced image candidate retrieval (maximum 64 card codes per locale).
- Full-image search now cross-checks OCR candidates even when OCR-restricted matching succeeds. Geometric match thresholds and ambiguous-price confirmation remain unchanged.
- Supplied reflective Yamato slab photo: image-only retrieval across JP/EN finds only JP-328527 / OP04-112, with 16 geometric inliers. Previously the correct reference ranked 588th in the slab crop and was excluded from retrieval.
- 50 focused tests passed. Existing 28 transformed thumbnail fixtures remain 28/28 top-one, with 14 ambiguous cases and zero wrong automatic prices. These are limited fixtures, not a universal recognition guarantee.
- Read-only production API check for 328527 returned both Single and PSA10 dated trade prices.
- Local output: `artifacts/card-pone-extension/`. Chrome installed-extension capture/permissions still need verification; these checks do not establish store release readiness.
- Local browser upload of the full supplied photo returned one OP04-112 / JP candidate, the correct image, catalog `/cards/jp/OP04-112-p3`, and market product 328527. HTTP preview price fetch failed; production API was checked separately, not through installed Chrome.
- Changed implementation: `src/lib/card-image-features.js`, `card-image-match.js`, `card-image-worker.js`, `card-recognition-lab.js`; extension manifest version; focused image tests and `scripts/diagnoseCardPhoto.mjs`.

## Submission files

- ZIP: `artifacts/card-pone-scan-0.1.12-store-r1.zip`
- Unpacked: `artifacts/card-pone-store-1790308775232/`
- Size: 86,908,562 bytes
- SHA256: `1C194B890863DDFFF70994816F1B1C8D6EBC36FE5572D6ADAF55ADB982E40696`
- Listing, permissions and reviewer instructions: `extensions/card-pone/STORE-LISTING.md`
- Privacy: https://www.optcgkorea.com/card-pone-scan-privacy.html
- Icon: `artifacts/card-pone-store-assets/icon128.png`
- Small promo: `artifacts/card-pone-store-assets/promo-440x280.png` (440 x 280, RGB PNG)
- Start-screen screenshot: `artifacts/card-pone-store-assets/02-scan-start-1280x800.png` (1280 x 800, RGB PNG)
- Candidate screenshot `01-candidate-confirmation-1280x800.png` is QA evidence only: actual dimensions are 1265 x 712, not a store upload. Replace with an actual Chrome side-panel screenshot before submission.

Historical 0.1.12 draft: the original ZIP was rejected by CWS because the reference-data manifest was mistaken for a second extension manifest. The r1 build omits that unused local file; remote reference updates are unchanged. ZIP inspection confirms exactly one manifest.json. Promo HTML and draft privacy documents are not included in the clean package.

## Completed checks

- 48 focused tests passed after the final changes.
- Clean build passed; r1 ZIP has a single root manifest version 0.1.12.
- No source maps, environment files, node_modules, draft privacy pages or promo source files found in ZIP.
- Packaged OCR, image worker, sandbox and card indices included. No remote executable code required.
- Local browser UI correctly identified JP-94915 as OP01-001 / JP after fixing transparent-image background normalization.
- Local browser UI put EN-197796 first and required confirmation for multiple similar JP/EN candidates. No automatic ambiguous price was shown.
- Engine warnings now remain visible even when no candidate is returned.
- Existing CLI image validation: 28/28 samples ranked their expected card first, 13 ambiguous cases, zero wrong automatic prices. This is a limited fixture set, not universal accuracy proof.
- Public price API returned HTTP 200 for product 94915 with trade-median basis and dated Single/PSA10 values.
- Privacy page is deployed and publicly accessible.

## Remaining release gates

1. Developer registration/payment completed; non-trader status saved with owner confirmation. CWS accepted r1 and created draft `bmallhfmgjlccnegdjjlmhobcgocphlc`. Korean listing, Shopping category, homepage, icon, start screenshot and promo tile saved. Single purpose, permission explanations, no-remote-code selection and privacy URL saved. Owner approved the three policy certifications; saved. Contact email optkr26@gmail.com verified. Data categories saved conservatively: website content (local screenshot), web history (current URL validation only), location (IP handled by servers/CDNs), personally identifiable information and personal communications (optional user-sent support email). This does not mean screenshots or visited URLs are uploaded. No review submission or publication occurred.
2. Install the final unpacked 0.1.12 folder in actual Chrome. Test toolbar permission, Naver cafe region capture, cancellation, repeated scans, JP/EN ambiguity and prices. The in-app HTTP preview does not test Chrome extension permissions or service-worker lifecycle. Its price fetch is cross-origin blocked; the production API itself responded successfully. Do not mark the installed extension price path verified based only on that API response.
3. Capture final Chrome side-panel screenshot and replace the QA-only candidate image. No fabricated price or screenshot has been used.
4. Confirm rights to distribute/display card artwork and relevant trademarks. Technical access is not permission.
5. Contact-mail deletion within 90 days remains an operational obligation, not an automated process. The owner completed developer registration/payment and approved the policy certifications.
6. Review the draft listing, then explicitly approve submission/publication. Keep automatic publication disabled until the owner chooses otherwise.

### Chrome automation blocker (2026-09-25)

The owner allowed testing in a separate Codex Debug Chrome context. Browser runtime returned `Browser is not available: chrome`. Elevated official diagnostics confirmed the automation extension is installed/enabled, but the native-host manifest is missing an expected extension origin. No native-host configuration was modified and no existing Chrome tabs were inspected. Reinstall Browser via Codex plugin UI, reconnect and retry; do not substitute ordinary web-preview tests for extension tests.

## Changes in this candidate

- `extensions/card-pone/panel.jsx`: flatten transparent upload pixels to white before OCR/CV; show warnings even for zero results.
- `extensions/card-pone/manifest.json`: version 0.1.12.
- `scripts/testCardPoneExtension.mjs`: regression guard for background normalization and warning placement.
- `scripts/buildCardPoneExtension.mjs`: opt-in clean release output directory; reuse local OCR model when available.
- Store text and release checklist added. No production DB, authentication configuration or card pricing logic changed by this release preparation.
