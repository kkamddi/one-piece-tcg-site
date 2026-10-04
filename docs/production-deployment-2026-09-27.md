# Production deployment and extension 0.1.18 — 2026-09-27

## Website deployment

- User explicitly authorized production deployment and Chrome Web Store submission.
- Production commit: `05edde16fc3021d0292d385cb0f4e523b830a96b`, merging current main `6155cef` and the verified archive `c0a5345`. Both parent histories and current production catalog data were preserved; no force push.
- Existing production workflow succeeded: https://github.com/kkamddi/one-piece-tcg-site/actions/runs/36297226902
- Secret-scan workflow succeeded: https://github.com/kkamddi/one-piece-tcg-site/actions/runs/36297226899
- Deployment: https://a9bb7920.optcgkorea-static.pages.dev
- Homepage and extension privacy page return HTTP 200. Unauthenticated extension membership returns HTTP 401 with `Cache-Control: no-store, private`.
- The deployment URL and production domain serve the same application asset, `assets/card-pone-app-mJjzzfFT.js`.
- Deployment logs confirm unchanged Riftbound catalog revisions and no database import. No authentication/provider/environment settings changed.

## Verification

- Final extension/image-recognition suite: 66 tests passed.
- Isolated integrated checkout: production site build and 54 targeted extension/auth-routing/catalog tests passed. Existing large-bundle/OpenCV browser-externalization warnings remain.
- Extension-only 0.1.18 build succeeded. ZIP: `artifacts/card-pone-scan-0.1.18-store.zip`, 86,855,402 bytes, 5,460 entries, exactly one root manifest; no environment, signing-key, source-map, node_modules or Git paths detected.
- Actual local-preview scan button measured 48px high with 16px text. Installed toolbar capture remains unverified; original cropped-photo failure is not conclusively resolved. Detailed recognition evidence remains in the regression report.
- Source changes were reviewed and checked for newly introduced secret patterns. User photos, generated packages, isolated validation checkout and local instructions are not uploaded to Git.

## Store submission

- Existing item `bmallhfmgjlccnegdjjlmhobcgocphlc` reused. Prior pending 0.1.17 review cancelled as part of the authorized replacement.
- The portal processed the ZIP and displayed version 0.1.18. Final submission produced the confirmation “검토를 위해 확장 프로그램을(를) 제출함”. Approval is pending; the extension has not been published.
- Automatic publication was explicitly unchecked before submission; the confirmation states that approval is staged for later manual publication. Existing private reviewer instructions, listing and privacy declarations were left unchanged. No credential values were read or copied during this update.

Original development branch and unrelated local changes remain untouched. Signing-key backup remains unverified; reproducible packages remain local only.
