# ข้อความพร้อมส่งให้ Claude

คุณเป็นวิศวกรดูแล Lil Bulle Corporate Inventory / Booth POS ในประเทศไทย อ่าน `AGENTS.md` และ `README_TH.md` จาก ZIP ที่แนบก่อนเริ่มงานทั้งหมด

บริบท:
- ระบบคลังใช้ Google Apps Script + Google Sheets
- POS ที่กำลังใช้งานอยู่เป็น Netlify หน้าเว็บ `lilbulle-booth-pos.netlify.app` เชื่อม Apps Script และ LINE Bot
- Netlify Free เครดิตสำหรับ production deploy หมดชั่วคราว เจ้าของต้องการคงระบบที่ยังขายได้ไว้ก่อน **อย่าเปลี่ยน Deploy หรือปิด Netlify โดยไม่ขออนุมัติ**
- ปัจจุบันมี `Code.gs` V11.3 และ `BoothPOS_V11.gs` backend V12.3 เป็นไฟล์ตัวเลือก พร้อม GAS-only POS ทดลอง แต่ยังไม่ยืนยันตรงกับ deployment ที่ใช้งานจริง
- ชีตหลัก: https://docs.google.com/spreadsheets/d/11YZNBAxcIso5iiehdyUH-ua9q4i6ADdxN3Lhf_Nhxqo/edit
- Repo: https://github.com/onlineechattt/AI

ภารกิจลำดับแรก: **Audit แบบอ่านอย่างเดียว** รวบรวม `git status`, deploy ที่ published, Apps Script active files, GAS version ที่ deployed, Sheet schemas, webhook LINE และเส้นทาง request จาก POS สู่ GAS ก่อน ตอบว่าอะไรใช้จริง/อะไรทดลอง

จากนั้นเสนอแผนแก้แบบไม่รื้อและไม่ทำข้อมูลเสีย:
1. รับ Barcode จริง 5 สินค้าจากคอลัมน์ F ใน `BoothPOS_Products`; ค้นหาเฉพาะสินค้าของบูท; รองรับกล้องมือถือ/ภาพถ่าย/กรอกรหัสสำรอง
2. จัดการโปรโมชั่นจับคู่ผ่านหน้า Admin (เลือก SKU จำนวน ราคา ชื่อ เปิด/ปิด); backend รับรองสิทธิ์ boss; bill history คงเดิม
3. POS ต้องไม่หัก Stock คลังกลางซ้ำ; คลังเบิกออกลด Stock, คืนของจริงเพิ่ม Stock, ยอดขาย POS เป็นการบันทึกเพื่อ audit; แยก EXP
4. เพิ่มความเร็วด้วยกรองข้อมูลตาม issueNo ตั้งแต่ Apps Script และ lazy-load ส่วนที่ไม่ใช้
5. ตรวจสอบ LINE Bot/notifications ไม่ให้เสีย

ก่อน Deploy ต้อง: ทำสำเนาชีต+Apps Script, staging tests, ทดสอบ login/void/sale/close/return/EXP/promotion/LINE/image/camera และแสดง diff ทุกไฟล์ให้เจ้าของอนุมัติ

**รูปแบบคำตอบ:** ภาษาไทย, เริ่มต้นด้วย 'บอส', ระบุสถานะจริง และรายงานไฟล์ที่แก้ สาเหตุ จุดเสี่ยง วิธีทดสอบ rollback แบบชัดเจน ห้ามบอกว่า Deploy แล้วหากยังไม่ได้ทำ
