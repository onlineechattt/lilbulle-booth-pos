# Validation — V12.5.0

V12.5 verifies that the server uses the configured promotion recipe and price, checks the displayed price and revision, requires a reason for adjustments, and rejects a complete bill when a booth has insufficient stock. Tests cover independent booth prices, restoring the global price, preservation of recorded bills, and boss authorization on the proxy.

The Netlify interface and the Apps Script extension must be released together. Before publishing, finish any pending live sales and test both components with a staging Sheet. The GAS-only bridge remains available in repository history as a reference. The V12.5 Apps Script extension is distributed in the owner's local ZIP.

Local verification on synthetic data passed 13 Node checks and the headless Chrome smoke test, including boss and team menus, creation of a set, a booth-only price and restoring its global price. No live sales or inventory were used in these checks.

## V12.4 baseline

Source baseline: onlineechattt/AI @ 2acf0652c3b71b98c20f0dcc768c7f438d87039a.

Executed locally on 2026-11-12:

- Local `npm test`: **10/10 passed**, Node.js test runner (4 public matching/proxy checks and 6 local-only GAS ledger checks).
- The GAS ledger fixture suite remains local: automatic publication review declined that fixture file even after it was labeled synthetic. A fresh public checkout has 4 Node tests; the 6 additional checks below were run locally before publishing.
- `node tests/browser-smoke.mjs`: **passed**, headless Chrome; local mock API only.
- JavaScript syntax checks for app, camera module, proxy, and Apps Script through Node VM.
- Synthetic EAN-13 photo decoded using the actual locally served ZXing fallback with BarcodeDetector disabled.
- Canvas MediaStream carrying EAN-13 decoded through the camera path; tracks stopped after detection.
- Permission denial and a stream arriving after scanner closure are handled without an unintended cart addition.
- Full code, 4-digit suffix, ambiguous suffix, missing barcode and another booth's product.
- No API/Sheets call per barcode input; images and history requests carry the selected issue.
- A fake 500-row unrelated ledger contains deliberately invalid JSON: selected-booth refresh never parses it.
- Recent list limited to 20 while totals/count include all selected-day paid bills.
- Sale, request-id deduplication, EXP line persistence, void and close; only POS ledger writes in fake Sheets.
- Backend-first rollout retains old-client read contracts; new UI fails closed against an unscoped backend.
- Lost sale response is retried with the same requestId, not a new bill.
- LINE preview performs no send; explicit send tested with a mocked endpoint.
- Payment QR image deliberately excluded at the owner's explicit request; transfer amount dialog uses the physical booth QR instead.
- Desktop 1280px and mobile 390px checked; no page overflow.

No production deployment, production Sheet writes, live LINE sends, or real phone/camera acceptance test was performed.
TextFinder restricts row payload retrieval but is not a database index; no production latency benchmark is claimed.

Before production: confirm live deployed source, stage against a copy of GAS + Sheets, test actual 5 barcodes,
iPhone/Android camera permissions, photos, replenishment/receive by EXP, close, warehouse return, slips, QR and LINE.
Update GAS extension first, then frontend/proxy. Roll back frontend first if necessary. Do not restore over real sales.
