# Card recognition regression — 2026-09-27

## Scope and evidence

- Investigated the supplied Yamato OP01-121 SP photo, expected artwork `JP-135443`.
- The card-only capture (403×552) already matched the correct artwork with the pre-change local engine at original, 320px and 240px widths. The existing 0.1.17 packaged panel also returned this artwork as its only candidate in a loopback browser preview, including OCR and its sandboxed image worker.
- That browser preview did not exercise Chrome's live `captureVisibleTab` selection path, membership checks, or remote-reference caching. It did not reproduce the user's installed-extension failure. The failure message, installed build and actual captured pixels remain to be compared. The preview's price request failed; price retrieval was not changed in this task.
- The separate full-holder image (518×805) did reproduce an image-only retrieval failure: the correct card number did not survive shortlisting. The correct artwork was present in local, packaged and current online references.

## Change

`shortlistImageCodes` now ranks both the full 8×12 RGB signature and its central artwork region. This adds another retrieval route when foil borders, rules text or holder framing dominate the global signature. No new model, package, reference-index format or image upload is introduced.

The 64-code budget, ORB descriptor checks, geometric verification, artwork-evidence requirements and ambiguous-variant confirmation remain unchanged. Experimental extra raw-crop hypotheses were not retained because they did not fix the reproduced retrieval failure.

## Validation

- 24 focused tests passed: image matching, recognition candidate handling and extension confidence rules. Includes a new synthetic regression where misleading borders would otherwise crowd out the correct central artwork.
- 56 image-only perspective/glare cases: 56 retrieved, 56 verified, 56 rank-one; 28 ambiguous cases require confirmation; 0 cross-number cases; 0 incorrect automatic prices. This is not an all-card or real-world accuracy estimate.
- Both supplied photos match `JP-135443` after the change at original, 320px and 240px widths. Full-holder retrieval was verified against the current online reference set as well as local data.
- A subsequent card-only run downloading the entire shortlisted online reference set timed out; that network-dependent rerun did not complete. This is not evidence that the user's original failure had the same cause, and is not counted as a passing online test.
- `scripts/verifyCardPhotoRegression.mjs` accepts a local photo path and expected artwork key, tests image-only JP+EN retrieval and matching, and fails on a missing top match or verified different-number result. `--remote-index` uses online indexes and reference files consistently; it sends no photo data. Use `--widths=original,320,240` to select sizes.

User photos are not added to Git. The browser test used a temporary local Aside-session copy of the card-only image. Generated reports/caches remain under ignored `artifacts/card-image-validation`.

## Follow-up: test package and login destination

- The extension login action now opens the website homepage instead of `/portfolio`; the existing login modal and membership verification are unchanged. The member tests cover the homepage URL and extension-owned tab tracking.
- All 65 focused extension/image-recognition tests passed. A fresh extension-only build succeeded in a separate ignored artifact directory, without replacing the old package. A mocked-browser execution of the compiled background message handler verified the homepage URL and saved tab ID. The original card-only photo also passed the local image-only regression again.
- The designated Aside profile path was verified, but its CLI session could not attach to the newly launched visible app window (`No active browser tab is available to attach`). The automated extension-manager tab did not establish installation in that visible window. Installation and live capture verification remain incomplete; another profile was not used as a fallback.
- No extension version bump, store resubmission, installed-extension replacement, production deployment, or database change was performed. Local source changes and test packages do not update the user's installed extension automatically.
