# GitHub active source (read before modifying)

Repository: https://github.com/onlineechattt/AI
Default branch: `main`
Last inspected commit: `2acf0652c3b71b98c20f0dcc768c7f438d87039a` (2026-11-10 14:21 UTC)

**Active Netlify front-end paths (not nested ZIP upload folders):**
- https://github.com/onlineechattt/AI/blob/main/public/app.js — last inspected V12.1.15
- https://github.com/onlineechattt/AI/blob/main/public/index.html
- https://github.com/onlineechattt/AI/blob/main/public/bundles.js
- https://github.com/onlineechattt/AI/blob/main/netlify/functions/pos.mjs — last inspected proxy V12.1.6
- https://github.com/onlineechattt/AI/blob/main/netlify.toml — publish=`public`, functions=`netlify/functions`

**WARNING:** A previous upload created additional directories (`AI-main/AI-main`), and placed Apps Script source files and `patch_repo.py` at the repository root. Those files do not automatically replace the active front-end or Apps Script deployment. The `.py` file is a patching tool, NOT a Netlify function. Do not copy it directly as `app.js`.

The handoff ZIP intentionally does NOT claim to contain a full, fresh checkout of GitHub source. Clone/pull from origin before changing it; reconcile with the current commit rather than applying the old patch blindly.
