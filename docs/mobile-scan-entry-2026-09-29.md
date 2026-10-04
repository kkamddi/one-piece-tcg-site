# Extension install and mobile scan entry

- Desktop homepage: compact Chrome Web Store banner, dismissed for seven days; persistent extension link in header. No automatic installation.
- Mobile: center camera/scan button in the existing five-item bottom navigation. Lab remains accessible in the mobile header.
- Re-enabled the existing mobile scanner, sharing app-owned open state with the market screen. Existing local photo/OCR/artwork processing and explicit version confirmation are preserved.
- Scanner and image-match tests: 29 passed. JSX parsing and scoped diff whitespace checks passed.
- Aside desktop check: install link visible; dismiss survives reload while the permanent link remains.
- Local same-origin 390px iframe check (not a physical device): center button opens scanner; camera-unavailable fallback offers photo selection. User-provided Yamato photograph ranked the matching SEC-SPC artwork first. Explicit confirmation opened its market detail and loaded Single price/trade data.
- Physical phone camera, iOS/Android browser behavior and native app integration remain unverified. No claim of universal photo recognition accuracy.
- No production deployment, main push, authentication or database changes.
