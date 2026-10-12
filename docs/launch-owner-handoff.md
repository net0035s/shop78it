# งานส่งต่อก่อนเปิดร้าน — อัปเดต 12 ตุลาคม 2026

เจ้าของอนุมัติและดำเนิน migration/rekey ต้นทางพร้อม Production ใหม่แล้ว เว็บหลัก https://shop78it.vercel.app ชี้ `dpl_9CejMLiCr4Jo9t8my3pP6UVvYntX` เปิดได้ HTTP 200 ยังปิดรับออเดอร์และเงินจริง ไม่มีการซื้อแผน/โดเมน ดู [สถานะปัจจุบันและสิ่งที่ต้องใช้บัญชีเจ้าของ](launch-main-current.md) ข้อความวันที่เก่าต่อจากนี้เก็บเป็นประวัติการเตรียม ไม่ใช่สถานะล่าสุด

เจ้าของเลือกใช้ Vercel ต่อและซื้อโดเมนช่วงท้าย สำรองฐานร้านต้นทางใหม่วันที่ 12 ต.ค. เวลา 12:05 น. ไทย และทดสอบกู้คืน/hash ครบ 9 ตาราง ซ้อม commerce migration เป็น 15 ตาราง และซ้อม rekey บนสำเนาล่าสุดผ่าน (รักษา 14 ค่า/แทน 24 ค่าที่อ่านไม่ได้ด้วย MOCK เฉพาะสำเนา) ไม่เปลี่ยนข้อมูลหรือกุญแจต้นทาง ดู [แผนช่วงถัดไป](vercel-launch-next-stage.md) ก่อนดำเนินการจริง

[เว็บ Preview](https://shop78it-lxcs29u7u-netnaruto0035s1-5199s-projects.vercel.app) ขึ้น READY ใช้เฉพาะฐาน sandbox ป้ายทดลองแสดงชัด Production deployment และโดเมนร้านเดิมคงเดิม Stripe เปิดเฉพาะ Sandbox ด้วย test key และ signing secret แล้ว ไม่มี cron อัตโนมัติใน Preview นี้ ถ้าขึ้น Authentication Required ให้ล็อกอิน Vercel ของเจ้าของ

หน้าติดตามแสดงรายละเอียดบิลด้วยเลขออเดอร์และอีเมลตรงกันโดยไม่ต้องรอเมล และตรวจสถานะทุก 10 วินาที ข้อมูลจัดส่งยังใช้สิทธิ์จากเครื่องที่ซื้อ/ลิงก์ยืนยัน Test Browser ผ่าน 14 กลุ่ม รวมอัปเดตหลังแอดมินส่ง Manual โดยไม่ reload ตรวจฐาน Sandbox แล้วออเดอร์ Stripe ของเจ้าของ 3 รายการเป็น completed หลังแก้หลังบ้าน ไม่มีการแก้หรือลบรายการเหล่านี้จากการตรวจ

แก้ซื้อซ้ำแล้ว: Checkout ไม่ย้อนกลับไปออเดอร์ที่จ่ายแล้วและรอส่ง Manual; ประวัติและลิงก์บิลเก่ายังใช้ได้ Browser 12 กลุ่มและ TypeScript/lint ผ่าน ไม่มีการแก้/ลบออเดอร์ที่เจ้าของซื้อทดสอบไว้ และผูก Webhook Sandbox เดิมเข้ากับรุ่นนี้แล้ว

อัปเดต Stripe 12 ตุลาคม: ตรวจยืนยันบัตร 2 ออเดอร์และ PromptPay 1 ออเดอร์กับ Session/PaymentIntent ของ Stripe Sandbox แล้ว ยอด THB/mode/binding ตรงกัน ส่งส่วนอัตโนมัติครบและอ่านได้ หลังเจ้าของแก้ Manual ออเดอร์ทั้ง 3 เป็น completed ในฐาน ไม่แก้หรือลบออเดอร์ของเจ้าของ Webhook จาก Stripe จริงผ่านและข้อความไม่มีลายเซ็นถูกปฏิเสธ Browser fixture 14 กลุ่มและ deployed HTTP 7 กลุ่มผ่าน อีเมล/Telegram ยังปิดใน Preview จึงยังไม่ถือว่าผ่านการส่งข้อความบนโฮสต์จริง อ่าน [ขั้นตอน Stripe](stripe-integration.md) และ [ผลตรวจ Sandbox แบบอ่านอย่างเดียว](launch-stripe-paid-sandbox-latest.json)

## สิ่งที่เจ้าของเตรียม

1. เลือกโฮสต์/แผนสำหรับร้านค้าและงานอัตโนมัติทุก 5 นาที ระบุงบและ URL ร้านสุดท้าย ไม่ซื้อแผนหรือย้ายโฮสต์อัตโนมัติ
2. ระบุช่องทางรับเงินที่จะเปิดจริง แล้วตั้งบัญชีรับเงิน/กุญแจผู้ให้บริการผ่าน environment ที่ปลอดภัย ห้ามส่งค่าลับในแชต ผล mock ไม่ยืนยันบัญชีผู้ให้บริการจริง ถ้าไม่มี sandbox ต้องตรวจวิธีทดสอบที่ผู้ให้บริการรองรับก่อนดำเนินการ
3. เตรียม Clerk live publishable/secret keys และอีเมลแอดมินที่ยืนยันแล้ว การทดสอบ Clerk test ไม่ใช่การตรวจ login บนโดเมนร้านจริง
4. เตรียมสินค้า สต็อก ราคา เวลาจัดส่ง เงื่อนไขประกัน–คืนเงิน และช่องทางช่วยเหลือที่ใช้จริง ไม่เดาเวลาส่ง/คำรับรองให้ร้าน
5. เก็บ backup เข้ารหัสและ recovery key อีกชุดนอกเครื่องนี้ แยกกุญแจจากไฟล์ archive และจากกุญแจสินค้า
6. ตรวจแผน commerce-migration-plan.md และ encryption-key-rotation.md ก่อนอนุมัติการเปลี่ยนจริง ข้อมูลเดิมทั้งหมดเป็นการทดลอง แต่ยังต้องกำหนดว่าจะรักษาข้อมูลใดและแทนค่าทดลองที่อ่านไม่ได้อย่างไร ห้ามแทนข้อมูลต้นฉบับด้วย MOCK โดยไม่ตรวจแผน
7. อนุมัติ deploy และเปิดรับรายการเป็นขั้นตอนสุดท้ายหลังเห็นผลตรวจครบ ห้ามถือว่า Ready ของโฮสต์เท่ากับขายและส่งสินค้าได้

อีเมลส่งในเครื่องและฐานทดสอบแยกทำแล้ว ไม่ต้องสร้างใหม่ งานนี้ไม่เปลี่ยน environment บน Vercel

## งานฝั่งผู้พัฒนาที่ทำเสร็จรอบล่าสุด

- แก้ checkout คูปอง 100% ที่สถานะออเดอร์อาจถูกล้างระหว่างเปลี่ยนหน้า
- ป้ายสถานะจัดส่งแสดงตามออเดอร์จริง รอแอดมินจึงขึ้นรอจัดส่ง และเอาคำรับรองซัพพอร์ต 24 ชั่วโมงที่ยังไม่ได้ยืนยันออก
- ตะกร้าที่ปิดไม่แทรกปุ่มใน keyboard/accessibility navigation; ช่องอีเมล/รหัสผ่าน/คีย์รับสินค้าบนมือถือย่อในกรอบได้
- SMTP sandbox ใช้ sink loopback ได้ใน Next development โดยยังบังคับ TLS สำหรับ live/production และ server ภายนอก
- Cloud sandbox ไม่มี schema drift; resolve migration history สองไฟล์แล้ว รักษาข้อมูลทั้ง 15 ตาราง และป้องกัน migration metadata ด้วย RLS/revoke
- ทดสอบผ่าน: storefront 9 กลุ่ม, commerce 28 กลุ่ม, launch 9 กลุ่ม, RLS 7 กลุ่ม, backup/restore/migration, TypeScript/lint และ build ที่แยกจากเว็บในเครื่อง

ดูรายละเอียดและข้อจำกัดใน [รายงานงานฝั่งผู้พัฒนา](launch-agent-preparation-latest.json) และ [ผล browser E2E](launch-storefront-e2e-latest.json) ชุด browser ใช้ฐานชั่วคราว ไม่ใช่ผล deployed/cloud storefront E2E

## การทดสอบที่ผู้พัฒนารันซ้ำได้

```powershell
npm run typecheck
npm run lint
npm test
npm run test:cloud-sandbox
npm run test:storefront-e2e
```

`test:storefront-e2e` ต้องมี Clerk test keys ใน environment/ไฟล์ local และ browser Edge บน Windows (บนระบบอื่นติดตั้ง Chromium ของ Playwright ก่อน) ตัวทดสอบสร้างฐานชั่วคราว loopback ใช้กุญแจชั่วคราว ปิดรับเงินจริงใน HTTP app เก็บเมลใน SMTP sink และสร้าง/ลบเฉพาะผู้ใช้ทดสอบใหม่ `+clerk_test` ไม่มีการส่งข้อความไปกล่องจดหมายจริง ใช้ official Clerk helper เพื่อออก test session ไม่ใช่ผลทดสอบฟอร์ม login หรือ Clerk live บน production

ชุดนี้แยก build cache ใน `.cache/next-e2e` และพอร์ตชั่วคราวจากเว็บ sandbox ที่เปิดอยู่ ไม่แก้ข้อมูล cloud หรือฐานร้าน รูปหน้าจออยู่ใน `.cache/storefront-e2e` รายงานผลอยู่ที่ launch-storefront-e2e-latest.json

## ส่วนที่ยังไม่ถือว่าผ่านการเปิดจริง

- Provider sandbox/บัญชีรับเงินจริง และวิธีตรวจยอดกับผู้ให้บริการ
- Clerk live และ login บน deployment/domain จริง
- SMTP/Telegram และ scheduler บนโฮสต์จริง
- commerce migration/กุญแจจริง ตามแผนที่ตรวจแล้ว พร้อม backup ใหม่
- ผล `npm audit` รวม dev dependencies ยังมี high 7 รายการจาก braces ที่ยังไม่มีแพตช์ใน advisory ปัจจุบัน CI audit gate คงเดิม ไม่ลดเกณฑ์หรือใช้ force major upgrade เพื่อซ่อนผล
- การอนุมัติ deploy และเปิดร้าน

ฟีเจอร์ใหม่ที่ไม่อยู่ในงานเตรียมเปิดรอบนี้ยังอยู่ใน feature-backlog.md ไม่รวมเข้ากับรายการที่ต้องให้เจ้าของทำก่อนเปิด
