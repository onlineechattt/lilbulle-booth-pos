# Lil Bulle — ชุดส่งต่อโค้ดให้ Claude
วันที่จัดชุด 12 พฤศจิกายน 2026

**สถานะ:** เอกสารส่งต่อและโค้ดตัวเลือกสำหรับทดสอบเท่านั้น **ไม่ได้ Deploy หรือแก้ข้อมูล Stock/ยอดขายจริง**

## จุดเริ่มต้น
- อ่าน `AGENTS.md` และ `docs/CLAUDE_TASK_BRIEF_TH.md` ก่อนแตะโค้ด
- โค้ด Apps Script ตัวเลือกสำหรับการทดลอง GAS-only อยู่ใน `apps-script/CANDIDATE_GAS_POS_NOT_DEPLOYED/` (ครบ 4 ไฟล์)
- `apps-script/LEGACY_REFERENCE_NOT_FOR_DIRECT_REPLACE/` เป็นตัวอย่างหน้า Index เก่า อย่านำไปทับหน้าใช้งานจริง
- สำหรับเว็บ Netlify ให้ Claude clone ล่าสุดจาก GitHub ตาม `github/REFERENCE_ONLY/GITHUB_SOURCE_URLS.md`
- `github/REFERENCE_ONLY/patch_repo.py` เป็นแพตช์เก่าสำหรับอ้างอิง ห้ามคัดลอกขึ้น repo แล้วคิดว่าทำงานเอง

## ลักษณะระบบ
- Google Apps Script แยกคลังสินค้ากับ Booth POS (ระบบขายเดิมผ่าน Netlify)
- Google Sheets เก็บ Stock, EventIssue, EventReturn, LilbullePOS_V11, BoothPOS_Products, LilbullePOS_Promotions และตารางอื่น ๆ
- POS เก่ามี Netlify proxy เป็นตัวกลาง; GAS-only ทดลองมี `POS_GAS` และ `POS_GAS_Bridge`
- บอสต้องการคง Netlify ที่ยังใช้งานได้ไว้ก่อน เพราะกลัวกระทบยอดขายและ LINE Bot

## เป้าหมายของงานต่อ
1. ตรวจสถานะสด: Deployment ไหนเปิดใช้งาน, Web App doGet ส่ง Netlify หรือ GAS, โค้ดที่ใช้จริงเวอร์ชันอะไร
2. ตรวจ Barcode ทั้ง 5 SKU ใน `BoothPOS_Products!F` และทำสแกนผ่านกล้องมือถือ/ภาพถ่าย พร้อมกรอกรหัสสำรอง
3. ปรับ POS ให้โหลดเฉพาะข้อมูลบูทที่เลือก, lazy-load ประวัติ/รูป, โดยไม่ทำให้ยอดขายผิด
4. บอสสร้างและแก้โปรโมชั่นจับคู่บนเว็บได้เอง และ role team ไม่มีสิทธิ์แก้
5. ตรวจการสรุปยอดขาย/เติมของ/ปิดวัน/คืนของ แยก EXP และไม่ทำ Stock คลังกลางซ้ำ
6. เก็บ/ทดสอบ LINE Bot และ Manual LINE summary ก่อนเปลี่ยนเส้นทางเว็บ

## จุดที่ยังไม่ผ่านการพิสูจน์
- โค้ดทดลอง GAS-only ยังไม่ได้ทดสอบ end-to-end กับระบบจริง และฟังก์ชันแนบสลิป/LINE บางตัวไม่ครบ
- Live Apps Script อาจไม่ใช่โค้ดตัวเลือกใน ZIP; ต้อง diff และตรวจ Version deployment
- GitHub frontend ที่ตรวจล่าสุด `public/app.js` = V12.1.15, Netlify proxy `pos.mjs` = V12.1.6; GAS backend source V12.3 ไม่ได้ทำให้เว็บอัปเดตเอง
- Netlify มีการพัก Production Deploy เนื่องจากเครดิต Free หมด แต่ published site ยังออนไลน์ตามภาพของบอส

## การนำไฟล์ไปให้ Claude
อัปโหลด ZIP นี้ใน Claude พร้อมข้อความใน `docs/CLAUDE_TASK_BRIEF_TH.md` และให้ Claude เชื่อมกับ GitHub repo `onlineechattt/AI` / Apps Script ด้วยสิทธิ์ที่เหมาะสม โดยเริ่มจาก Audit (read-only) ไม่ใช่ Deploy ทันที
