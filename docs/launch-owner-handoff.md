# งานส่งต่อ Shop78it — 13 ตุลาคม 2026

โฮสต์ที่เจ้าของเลือกปัจจุบันคือ **Netlify Free** เว็บทดลอง https://shop78it.netlify.app ใช้ฐาน sandbox แยกจากฐานร้านเดิม ยังแสดงป้ายข้อมูลจำลองและปิดรับเงินจริง ไม่มีการซื้อแผนหรือโดเมน โปรเจกต์ `2fa-go` คงเดิม

## งานผู้พัฒนาที่ตรวจแล้ว

- แก้ตะกร้าหลังจ่ายสำเร็จ ให้หักเฉพาะรายการที่ซื้อครั้งนั้นครั้งเดียว รักษาสินค้าที่เพิ่มทีหลังและประวัติออเดอร์เดิม
- แสดงเลขออเดอร์เต็มและปุ่มคัดลอกบนบิล/รายการออเดอร์
- ภาพรวมแยกจำนวนรอแอดมินจัดส่งออกจากรอจ่าย เมนูออเดอร์มีจำนวนงานที่ต้องดำเนินการ ค้นหา/เปลี่ยนหน้ารายการไม่ทำให้ badge หาย
- ค้นด้วยเลขออเดอร์และอีเมลตรงกันแล้วดูรายละเอียดบิล/สถานะล่าสุดได้ ไม่ต้องรอเมล การเปิดข้อมูลสินค้า/รหัสผ่านจากเครื่องอื่นยังต้องมีสิทธิ์รับสินค้า
- Browser E2E ผ่าน 14 กลุ่ม รวมซื้อซ้ำหลังจ่าย ส่งอัตโนมัติ และอัปเดตหน้าติดตาม/รับสินค้าหลังแอดมินจัดส่ง Manual โดยไม่ reload ใช้ฐานชั่วคราวและ Clerk test มีเมล 6 ฉบับใน sink ภายในเครื่อง ไม่มีเมลส่งออก
- สำรอง runtime และฐาน Netlify sandbox แบบเข้ารหัส แยก recovery key จาก archive ซ้อม restore ครบ 15 ตาราง/13 ออเดอร์ ถอดรหัสได้ 39 ค่า ลบฐาน restore ชั่วคราวแล้ว
- Netlify ใช้ transaction pool ไปยังฐาน sandbox เดิม เปิด scheduled function ทุก 5 นาที พบ audit ยกเลิก pending ที่หมดเวลา 1 รายการและปล่อย unsold stock holds เรียก maintenance ซ้ำผ่าน HTTP 200 โดยไม่ยกเลิกเพิ่ม ออเดอร์จ่ายแล้ว 7 รายการคงเดิม รอจัดส่ง Manual 3 รายการ

ผล Netlify และงานดูแลออเดอร์อัตโนมัติดู [รายงานล่าสุด](netlify-developer-readiness-latest.json) รายงานแยกขอบเขต sandbox จากการรับเงินจริง ไม่ใช้ผลในเครื่องแทนการทดสอบบนโฮสต์

หลักฐานเพิ่มเติม: [แก้ checkout/admin](netlify-checkout-admin-fixes.json), [Browser E2E](launch-storefront-e2e-latest.json), [สำรองและกู้คืน](netlify-recovery-latest.json), [deployment](netlify-deployment-latest.json)

## สิ่งที่ต้องเตรียมก่อนเปิดขายจริง

1. สินค้า สต็อก ราคา เงื่อนไขจัดส่ง/คืนเงิน และช่องทางช่วยเหลือที่ใช้จริง ข้อมูล MOCK ใช้ทดสอบเท่านั้น
2. URL/โดเมนร้านสุดท้าย แล้วตั้ง Clerk Live และ DNS ตรวจ login ลูกค้าและแอดมินบนโดเมนจริง
3. บัญชี Stripe ที่พร้อมรับเงินจริง พร้อม Live key และ Live webhook signing secret ของ endpoint ร้านสุดท้าย ตั้งค่าลับผ่าน environment ไม่ส่งในแชต ไม่แก้แค่คำนำหน้า test key ให้เป็น live
4. Gmail ของร้านตั้งแล้ว ตรวจ SMTP authentication และค่าบน deployed runtime ผ่าน ส่งลิงก์รับสินค้าออเดอร์ FDDA จาก Netlify ตามที่เจ้าของอนุญาต 1 ฉบับ provider accepted/job sent แล้ว ยังรอยืนยันรับเมลและเปิดลิงก์จากเจ้าของ ถ้าจะใช้ Telegram ต้องตั้งและทดสอบแยก ดู [รายงานอีเมล](netlify-email-latest.json)
5. นำสำรองไปเก็บนอกเครื่องตามที่เจ้าของเลือกทำภายหลัง แยกกุญแจจาก archive
6. ตัดสินใจข้อมูลที่จะใช้เปิดจริงและตรวจแผนย้ายฐาน/กุญแจ ก่อน deploy Live ตรวจผลครบแล้วจึงเปิดรับเงิน

ผู้พัฒนาทำการตั้งค่าและทดสอบต่อให้ได้เมื่อข้อมูลร้านพร้อม ผล Sandbox ไม่ยืนยัน KYC, Clerk Live หรือเมลบนโฮสต์จริง

## การทดสอบซ้ำ

```powershell
npm run typecheck
npm run lint
npm run test:storefront-e2e
npx tsx scripts/test-netlify-maintenance.ts
npx tsx scripts/backup-netlify-runtime.ts --sandbox-only
npx tsx scripts/test-netlify-recovery.ts
```

E2E ใช้ Edge บน Windows และสร้าง/ลบผู้ใช้ Clerk test ใหม่เฉพาะชุดทดสอบ Backup อ่านฐาน sandbox; restore เขียนเฉพาะฐาน loopback ชั่วคราว ไม่ทับ cloud

Deployment ต้อง build เต็มพร้อม Netlify Next.js adapter และตรวจ HTML กับ JS/CSS ห้าม upload `.next` ตรงด้วย `--no-build` เพราะ client chunks และ server routes อาจขาด ตั้ง environment ให้ครบก่อน build

ประวัติ Vercel ก่อนย้ายโฮสต์อยู่ใน [บันทึกเดิม](launch-owner-handoff-history-2026-10-12.md) ไม่ใช่ขั้นตอนปัจจุบัน
