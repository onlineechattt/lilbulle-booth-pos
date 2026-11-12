# Evidence-based state and limitations (2026-11-12)

| Component | Evidence / version | Status |
|---|---|---|
| Apps Script inventory source | `apps-script/CANDIDATE.../Code.gs` = V11.3 file supplied; routes `?page=pos` to `POS_GAS` | Candidate; **not proven deployed** |
| Booth POS backend source | `apps-script/CANDIDATE.../BoothPOS_V11.gs` = file V12.3_PROMOTIONS | Candidate; **not proven deployed** |
| GAS-only POS | `POS_GAS.html` + `POS_GAS_Bridge.gs` | Trial; missing some Netlify functionality incl. LINE/manual summary and receipt uploads |
| Production Netlify GitHub front-end | `onlineechattt/AI` `public/app.js` last inspected V12.1.15 | Active path but published Netlify deploy may be older |
| Production Netlify proxy | `netlify/functions/pos.mjs` last inspected V12.1.6 | Active path, no `promotionSave` endpoint at time of inspection |
| GitHub head | commit `2acf0652c3b71b98c20f0dcc768c7f438d87039a` | As of latest inspection, not necessarily published |
| Google Sheet | `11YZNBA...` tab `BoothPOS_Products`, F1 `Barcode` | Verified; 5 product rows populated |
| Netlify account | Free plan 300 credits/month, screenshot says operational credits and production deploy paused | No assumption of exact billing reset without Credit balance |

## Known operational risks
- Importing a ZIP into a nested `AI-main/AI-main` directory will not update `public/app.js`.
- Deploying only Apps Script will not change Netlify frontend.
- Two independent UX paths: Netlify POS currently in use; GAS-only POS experimental. Do not confuse or cut over without parity.
- BarcodeDetector is not universally supported in browsers or sandboxed GAS HTML; test real devices, keep manual fallback.
- The GAS-only `lbGasCall` allows limited actions; compare to existing full `lbApi_` API list and inventory UI.
- GAS login uses ScriptProperties PIN and CacheService session; do not log values.
- Never return a quantity larger than issued-minus-returned **per SKU+EXP**, unless a separate approved stock adjustment handles it.
- Functions using sheet-wide reads should be profiled before heavy refactor.
- Confirm how promotions are expanded into bill lines: preserve SKU quantities and immutable price snapshot.
