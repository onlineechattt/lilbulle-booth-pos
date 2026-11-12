# AGENTS.md — Lil Bulle | Rules for Claude / coding agents

## Mission
Maintain Lil Bulle inventory and booth POS without data loss, incorrect stock movement, duplicate sale entries, or interrupting LINE bot flows. The current user selected to KEEP the working Netlify POS for now while free Netlify operational credits block production deploys. A GAS-only POS was explored as an experiment, not approved as a production cutover.

## Sources of truth
1. **Live deployed system first:** verify Apps Script deployed version, Netlify published commit, and Google Sheets current schema. Filenames do NOT guarantee deployment.
2. `apps-script/CANDIDATE_GAS_POS_NOT_DEPLOYED/` is a supplied working candidate, *not* guaranteed current live source or production-tested.
3. GitHub repo https://github.com/onlineechattt/AI provides Netlify front-end; actual active files under `public/` and `netlify/functions/`.
4. Existing Google Sheet is https://docs.google.com/spreadsheets/d/11YZNBAxcIso5iiehdyUH-ua9q4i6ADdxN3Lhf_Nhxqo/edit; treat as LIVE operational data. Avoid modifications during testing.

## Invariants
- **Warehouse inventory**: issue out of central Stock when issuing to booth; return only actual returned items to central Stock; separate SKU and EXP, no silent cross-lot fallback. Never deduct Stock again on POS sale.
- **POS**: records sales, payments, giveaways/damage and stock-count differences for booth only, does not silently mutate central Stock. A booth POS restock record cannot double-deduct central Stock; coordinate physical warehouse issue with POS bookkeeping.
- Sale price and discount/sets persist on the original bill, immutable when the manager edits promotions later.
- Manager/boss-only promotion creation/edit/activate/deactivate must be enforced **on server**; team can only sell active promotions.
- Barcode comes from `BoothPOS_Products!F` (header `Barcode`); match to SKU; preserve leading zeros, reject duplicates/unknown values. Ordinary EAN-13 identifies SKU, **not EXP**.
- Exactly-once/idempotent sale and financial operations keyed by stable requestId; do NOT auto-retry with a new requestId after unknown response.
- Verify LINE Bot send and existing manual summary before touching webhooks/routes/notifications. Never expose keys, PIN, tokens in browser or repository.
- Avoid destructive column inserts/renames, backfilling stock, or production writes without verified backup and explicit approval.

## Change protocol
1. Create a Git branch and staging/copy of GAS+Sheet; record live versions and deploy URLs.
2. Diff active source against files in this handoff; preserve Index.html, POS.html and existing production behaviors.
3. Implement small reversible changes, test sale -> close -> return and every EXP combination. Separate reporting from actual inventory movement.
4. Verify role controls, camera/barcode support on real iPhone/Android, and LINE Bot integration; keep manual SKU fallback.
5. Deploy controlled version only after verification; maintain rollback instructions. Note Netlify Free credits/deploy pause.
6. Each update to boss: version, changed files, impacts, tests, deployment status, risks, explicit next action in Thai.

## Security
- Script Properties hold BOSS_PIN, POS_TEAM_PIN, POS_API_KEY, LINE access token etc; do not export their values.
- GAS `google.script.run` calls are server RPCs but front-end validation is never an authorization boundary.
- GAS HTML Service live-camera use requires device/browser verification; image capture or manual entry is fallback.

## Do NOT assume
- That files in a ZIP auto-deploy, or a root-level `.gs` file is active Apps Script.
- That `?page=pos` renders GAS-only POS until the deployed doGet(e) is verified.
- That LINE Bot depends on Netlify: map its webhook explicitly before modifying.
- That a published Netlify deploy is the same as the newest GitHub commit.
