# TrueMoney และ Stripe Checkout

สถานะล่าสุด 12 ตุลาคม 2026: deploy เฉพาะ Vercel Preview แล้วตามเจ้าของอนุญาต ไม่ deploy Production ไม่รับเงินจริง ไม่แก้ข้อมูลหรือกุญแจฐานร้านจริง และไม่เปลี่ยน schema ฐานข้อมูล

## Preview ที่อัปแล้ว

[เปิดเว็บทดสอบ](https://shop78it-lxcs29u7u-netnaruto0035s1-5199s-projects.vercel.app) — deployment dpl_CdnAbkQHB9h4BFtmo8CFRZYMy85C สถานะ READY ใช้ฐาน acocmsdnkpjfggycsxro กับกุญแจข้อมูล sandbox และ Clerk test ค่าที่ส่งมีผลเฉพาะ deployment นี้ ไม่เปลี่ยน project environment ของ Production และโดเมนร้านหลักไม่ได้ชี้มาที่ Preview นี้

รุ่นนี้แก้การซื้อซ้ำหลังออเดอร์จ่ายแล้ว โดยเก็บบิลเดิมในประวัติและไม่คืนบิลเก่าแทนการซื้อใหม่ ทดสอบ Browser 12 กลุ่มผ่าน รวมซื้อใหม่หลัง completed และ needs_manual_delivery และการเปิดบิลเดิมด้วยลิงก์โดยตรง ดู checkout-repeat-purchase-fix.md

เพิ่มหน้าติดตามอัปเดตสถานะทุก 10 วินาทีและค้นรายละเอียดบิลด้วยเลขออเดอร์/อีเมลได้ทันที โดยไม่ออกสิทธิ์รับสินค้าและไม่เผยคีย์/รหัสผ่าน ทดสอบ Browser เพิ่มรวมเป็น 14 กลุ่ม หน้ารับสินค้ากับหน้าติดตามที่เปิดค้างแสดง completed หลังแอดมินจัดส่งโดยไม่ reload แจ้งการปิดอีเมลใน Preview ตรงตามจริง ดู order-tracking-update.md

มี Vercel Authentication ตามการตั้งค่าโปรเจกต์เดิม หากเห็น Authentication Required ให้ล็อกอินด้วยบัญชี Vercel ของเจ้าของ เว็บมีป้ายทดลอง ข้อมูล MOCK และรับเงินจริงปิดอยู่ Stripe เปิดเฉพาะ Sandbox ด้วย test key และ signing secret ที่เจ้าของบันทึกแล้ว ไม่มีการส่ง Live key ขึ้น Preview

Webhook ใช้ชื่อโดเมนเฉพาะ shop78it-stripe-sandbox.vercel.app ชี้ที่ Preview นี้ ผ่าน Automation Bypass ที่เจ้าของจัดเตรียม โดยไม่ปิด Vercel Authentication ทั่วโปรเจกต์ URL เต็มมี Secret จึงไม่แสดงในเอกสารหรือ log และเก็บเฉพาะไฟล์ .cache ที่ Git ไม่ติดตาม ตรวจ Stripe destination ว่าเป็นบัญชี Sandbox, Snapshot และรับ 4 checkout.session events แล้ว

ทดสอบออนไลน์: ข้อความที่ไม่มีลายเซ็นถูกปฏิเสธ HTTP 400 และ Stripe ส่ง checkout.session.expired จาก Checkout จำลองที่สร้างและยกเลิกสำเร็จ เหตุการณ์มี pending_webhooks=0 โดยตรวจว่ามี destination ที่ enabled สำหรับ expired เพียงตัวเดียวและ URL ตรงกับปลายทางนี้ เป็นหลักฐานรับข้อความจาก Stripe จริง แต่รายการตรวจนี้ไม่ได้ผูกกับออเดอร์ธุรกิจ จึงยังไม่ใช่หลักฐานว่าการจ่ายจนส่งสินค้าสำเร็จ ดู launch-stripe-webhook-online-latest.json

ตรวจ HTTP บน deployment จริงผ่าน 6 กลุ่ม: หน้าแรก MOCK, แอดมิน/cron ที่ไม่มีสิทธิ์, foreign origin, สร้าง/จองออเดอร์เฉพาะ fixture ใหม่, cookie scope ของออเดอร์, และปฏิเสธ TrueMoney/Stripe ที่ยังไม่พร้อม Fixture ของสคริปต์ลบแล้ว สินค้าเดิมใน sandbox คงเดิม ดู launch-preview-smoke-latest.json และ launch-preview-deployment-latest.json

ตรวจบัตร Sandbox หลังเจ้าของทดสอบแล้วเมื่อ 12 ตุลาคม: ตรวจแบบอ่านอย่างเดียวกับฐาน Sandbox และ Stripe พบ 2 ออเดอร์บัตรที่ Session paid/complete และ PaymentIntent succeeded ยอด THB/mode/binding ตรงกัน ออเดอร์ 20 บาท completed ส่งอัตโนมัติ 1 รายการ; ออเดอร์ 50 บาท needs_manual_delivery ส่งส่วนอัตโนมัติ 1 รายการและรอส่วน Manual ตาม flow เดิม ข้อมูลส่งอัตโนมัติถอดรหัสได้ ดู launch-stripe-paid-sandbox-latest.json ไม่มีการลบหรือเปลี่ยนออเดอร์ที่เจ้าของสร้าง

ตรวจ PromptPay Sandbox หลังเจ้าของกด Authorize test payment เมื่อ 12 ตุลาคม: Session paid/complete และ PaymentIntent succeeded ยอด 40 บาท THB/mode/binding ตรงกัน ออเดอร์ needs_manual_delivery ส่งส่วนอัตโนมัติครบ 1 รายการและรอส่วน Manual อ่านข้อมูลส่งมอบได้ รายงาน launch-stripe-paid-sandbox-latest.json ยืนยันทั้ง cardPaymentVerified และ promptPayPaymentVerified ไม่มีการแก้หรือลบออเดอร์ของเจ้าของ

Preview นี้ไม่มี cron schedule เพื่อไม่ติดข้อจำกัด Hobby ไม่มีข้อความออก/analytics/เงินจริง อีเมล receipt และ Telegram ของออเดอร์ทดสอบยัง queued ตามการปิดส่งจริงของ Sandbox ยังไม่ยืนยันการส่งส่วน Manual ของออเดอร์ Stripe จริงใน Sandbox จนจบ แม้ Browser fixture ได้ทดสอบกรณีนี้แล้ว

## ช่องทางที่ลูกค้าเลือก

1. ซอง TrueMoney แบบเดิม: ตรวจยอดตรงกับบิลก่อน redeem และใช้ payment lock เดิม
2. Stripe Checkout สำหรับซื้อครั้งเดียวเป็นเงินบาท: บัตรและ PromptPay ที่บัญชี Stripe เปิดไว้ ชำระบนหน้าของ Stripe ไม่อัปโหลดสลิป ไม่บันทึกข้อมูลบัตรในเว็บร้าน

หน้า checkout แสดงสองช่องทางนี้ ส่วน API PromptPay/SlipOK เดิมเก็บไว้เพื่อรักษางานเดิม แต่ไม่ได้ถูกเรียกจากช่องทาง Stripe

## สิ่งที่เพิ่ม

- Stripe SDK 23.0.0 และ API checkout/status/cancel/webhook ใช้ Node runtime
- ยอดสุทธิจากฐานร้านเป็น satang ไม่รับราคา/currency/session ID จาก browser
- Session และ PaymentIntent ผูกกับ attempt ด้วยข้อมูล binding และตรวจ mode, currency THB, ยอดรับจริง และสถานะ succeeded ก่อนส่งสินค้า
- Checkout ใช้ allowed_payment_method_types ของ Stripe API รุ่นปัจจุบัน และปิด Adaptive Pricing เพื่อคง THB/ยอดตามบิล วิธีที่จะแสดงจริงยังขึ้นกับ Payment methods ของบัญชี
- เรียกซ้ำ/timeout ใช้ attempt และ idempotency key เดิม เมื่อผลไม่แน่ชัดเก็บ payment_review และ reservation ไว้
- การกลับจาก Stripe เป็นเพียงจุดเริ่มตรวจสถานะ ฝั่ง server อ่าน Stripe อีกครั้งก่อนยืนยัน/ส่งสินค้า
- ตรวจลายเซ็นจาก raw webhook body ด้วย signing secret ปฏิเสธ payload เปลี่ยนแปลง/ขนาดเกิน รองรับ completed, async_payment_succeeded, expired, async_payment_failed และอ่านสถานะล่าสุดเพื่อรับ event ที่ซ้ำ/สลับลำดับ
- ปิดรายการเพื่อเปลี่ยนช่องทางได้เมื่อ Stripe ยืนยันผลที่ปลอดภัยเท่านั้น ถ้า PaymentIntent ยัง processing หรือยังไม่ canceled จะไม่คืน stock
- worker ตรวจรายการ Stripe ค้างเพิ่มเติม ครั้งละ 3 รายการ พร้อมงานส่งสินค้า/แจ้งเตือนเดิม ตรวจรายการเก่าต่อได้แม้ปิดรับออเดอร์ใหม่
- ไม่เปลี่ยน schema: ใช้ PaymentAttempt ที่มีอยู่ reference เก็บ Checkout Session ตลอดอายุรายการ และ order summary ส่งเฉพาะชื่อช่องทาง ไม่ส่ง binding/กุญแจ

## การตั้งค่าที่ต้องทำต่อ

ผลตรวจไฟล์ล่าสุดพบ **live-server key** ใน STRIPE_SECRET_KEY จึงไม่ส่ง API request ใด ๆ และ launcher ตัดค่านี้ออกจาก sandbox child environment ตรวจผลที่ launch-stripe-config-latest.json

1. เปิด Stripe Dashboard เลือก Sandbox/โหมดทดสอบ ก่อนเปิดหน้า API keys
2. ใน `.env.sandbox.local` เปลี่ยนเฉพาะ STRIPE_SECRET_KEY เป็น server key ของ Sandbox (`rk_test_...` หรือ `sk_test_...`) รักษา DATABASE_URL, DIRECT_URL และ ENCRYPTION_KEY sandbox เดิม ไม่ส่งค่ากุญแจในแชต
3. ตรวจด้วย `npx tsx scripts/check-stripe-sandbox.ts` สคริปต์แสดงเฉพาะประเภทกุญแจและ HTTP status/country ไม่แสดงค่า เมื่อรูปแบบไม่ผ่านจะไม่ส่ง API request กุญแจ restricted อาจไม่มีสิทธิ์อ่าน Account แม้ใช้ Checkout ได้ จึงห้ามสรุปจาก 403 ว่า credential เสีย
4. เปิด Cards และ PromptPay ที่ Stripe Sandbox > Payment methods สำหรับบัญชีประเทศไทย ตรวจผ่านหน้าจ่ายจริงของ sandbox อีกครั้ง API ที่ต้องใช้คือ Checkout Sessions create/read/expire และ PaymentIntents read; ใช้ restricted key ที่มีสิทธิ์ตาม endpoint เหล่านี้ ตรวจสิทธิ์ส่วนอื่นจาก Stripe error จริงก่อนเพิ่ม
5. หลังตรวจ test key ใช้ Stripe CLI ที่ล็อกอิน Sandbox เพื่อ forward event เข้า `http://localhost:3000/api/payment/stripe/webhook` เลือกสี่ events ด้านล่าง เก็บค่า whsec_ ที่ CLI ออกให้ใน STRIPE_WEBHOOK_SECRET ของ `.env.sandbox.local` แล้ว restart `npm run dev:cloud-sandbox` กุญแจ CLI เป็นคนละค่ากับ Dashboard endpoint secret อย่าสลับกัน

```powershell
stripe listen --forward-to http://localhost:3000/api/payment/stripe/webhook --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired,checkout.session.async_payment_failed
```

ใช้คำสั่งนี้หลังตั้ง Stripe CLI ให้ตรง Sandbox แล้วเท่านั้น CLI ต้องเปิดค้างไว้ระหว่างทดสอบ ค่า signing secret เก็บเฉพาะในไฟล์ environment บนเครื่อง ไม่ลงแชต/Git

cloud sandbox launcher เปิดเฉพาะ Stripe test เมื่อ test server key ถูกชนิด โดยยัง PAYMENTS_ENABLED=false, LAUNCH_APPROVED=false, TrueMoney redeem/SMTP/Telegram จริงปิด สำหรับ live code ยังต้อง STRIPE_ENABLED=true, live server key, webhook secret, PAYMENTS_ENABLED=true และการอนุมัติเปิดร้านตามแผนเดิม ห้ามตั้งค่าเปิดจริงในงานรอบนี้

สำหรับบัญชี settlement THB โค้ดกำหนดยอด Stripe อย่างน้อย 10 บาทตามเอกสาร Stripe หากบิลต่ำกว่านี้ใช้ซอง TrueMoney และไม่เพิ่มยอด/ค่าธรรมเนียมเอง Checkout มี expiry ขั้นต่ำ 30 นาที จึงไม่สร้าง session เมื่อบิลเหลือน้อยกว่า 31 นาที และไม่ต่อเวลาบิลเก่าเงียบ ๆ

## หลักฐานและส่วนที่ยังไม่ยืนยัน

- `npm run test:stripe`: 16 กลุ่ม ด้วย gateway จำลองและฐาน loopback ชั่วคราว ไม่มีเงินจริงหรือข้อความส่งออก
- `npm run test:stripe-provider`: ใช้กุญแจ test ที่ผ่าน guard เท่านั้น สร้าง/อ่าน/เรียกซ้ำ/expire Stripe Checkout หนึ่งรายการกับฐาน loopback ชั่วคราว ไม่ชำระเงินหรือส่งข้อความ ไม่ใช้ cloud business rows ผลนี้แยกจาก test card/PromptPay และ webhook จ่ายจริงใน sandbox
- `npm test`: งาน configuration/encryption/migration/commerce/launch เดิม รวม Stripe แล้ว
- `npm run test:postgres-launch`: รวม Stripe บน PostgreSQL หลาย connection พร้อม backup/restore และ RLS
- `npm run test:storefront-e2e`: ตรวจสองช่องทางใน browser/มือถือและ Stripe ที่ไม่มี configuration รับเงินไม่ได้ ร่วมกับเส้นทางออเดอร์/จัดส่งเดิม
- Build แยก cache/source configuration ผ่าน ตรวจผลล่าสุดใน launch-isolated-build-latest.json
- **ยังไม่ยืนยัน** Checkout/provider API จริงใน Sandbox, การจ่ายด้วย test card/PromptPay test QR, การ forward webhook จาก Stripe หรือการทำงานบน deployment เพราะ key ปัจจุบันเป็น Live และ webhook secret ยังไม่มี
- ไม่ถือว่า audit รวม dev tools ผ่าน: high 7 เดิมยังคงอยู่ ไม่มีการลด CI gate ส่วน runtime audit ตรวจใหม่หลังเพิ่ม SDK

อ้างอิง: [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create), [Fulfillment](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted), [Webhooks](https://docs.stripe.com/webhooks), [Keys](https://docs.stripe.com/keys), [THB minimum](https://docs.stripe.com/currencies.md#minimum-and-maximum-charge-amounts)
