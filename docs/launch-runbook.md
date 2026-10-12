# ขั้นตอนเตรียมเปิด Shop78it

อัปเดต 11 ตุลาคม 2026 งานนี้ยังไม่ deploy ไม่รับเงินจริง ไม่ใช้ commerce schema migration และไม่เปลี่ยน ENCRYPTION_KEY ของข้อมูลจริง หลังเจ้าของอนุมัติแยก ได้เปลี่ยนเฉพาะ RLS/privileges ของ 9 ตารางร้านแล้ว

## หลักฐานที่ต้องตรวจ

- ผลล่าสุด: [สรุปเตรียมเปิดร้าน](launch-preparation-2026-10-11.md)
- [ผลสำรองและซ้อมกู้คืน](launch-backup-rehearsal-latest.json)
- [ตรวจฐานจริงแบบอ่านอย่างเดียว](launch-audit-latest.json)
- [ตรวจบริการภายนอกแบบไม่ส่งข้อความ](launch-external-readonly-latest.json)
- [แผน migration](commerce-migration-plan.md) และ [แผนกุญแจ](encryption-key-rotation.md)

การตั้ง environment ครบหรือ deployment เป็น Ready ยังไม่ยืนยันว่าซื้อและรับสินค้าได้จริง ห้ามตั้งตัวแปร *_VERIFIED=true เพื่อทำให้รายการตรวจผ่านโดยยังไม่มีหลักฐาน

## P0 เพิ่มเติม: สิทธิ์ Supabase Data API

แก้บนฐานจริงแล้วหลังเจ้าของอนุมัติ: เปิด RLS และถอน anon/authenticated/PUBLIC ทั้ง 9 ตาราง สำรอง/กู้คืนใหม่ก่อนเปลี่ยนแล้ว และ counts/hash ตรงทุกตารางหลังเปลี่ยน Prisma ยังอ่านได้ ดู [แผน SQL ผลทดสอบ และ rollback](data-api-security-plan.md) และ [หลักฐานการเปลี่ยน](launch-rls-change-latest.json) การกู้ด้วย pg_dump no-acl ไม่คืน grants เดิมอัตโนมัติ ต้องเก็บ permission snapshot แยก ตาราง commerce ใหม่มี RLS ใน migration ที่ยังไม่ใช้จริง และต้องตรวจสิทธิ์ซ้ำหลังย้าย ห้ามเพิ่ม policy allow-all เพื่อทำให้ INFO ไม่มี policy หายไป

## 1. สำรองข้อมูลและกุญแจ

สำรอง public business schema ด้วย pg_dump ใน snapshot เดียวกับการตรวจจำนวนและ SHA-256 ของแต่ละตาราง แล้วเข้ารหัส AES-256-GCM ด้วยกุญแจสำรองอิสระ เก็บกุญแจไว้คนละที่กับ archive และนอก Git

รอบนี้ได้สำรองและทดลองกู้คืนสำเร็จแล้ว ตำแหน่งไฟล์และกุญแจอยู่ในรายงาน JSON กุญแจถูกจำกัดสิทธิ์ Windows เฉพาะผู้ใช้ปัจจุบัน ไฟล์ archive และกุญแจไม่ถูกอัปโหลดด้วย Vercel สำเนาฐานข้อมูลที่ใช้ซ้อมถูกลบหลังหยุด PostgreSQL แล้ว

สำรองนี้ไม่รวม Supabase Auth, Storage และการตั้งค่าโปรเจกต์ ตรวจอ่านวันที่ 11 ตุลาคม: auth.users=0, storage.buckets=0, storage.objects=0 หากเพิ่มข้อมูลในบริการเหล่านี้ต้องเพิ่มการสำรองแยก ให้เก็บ configuration และการตั้งค่าบัญชีผู้ให้บริการแยกด้วย อย่านำกุญแจลงรายงานหรือแชต

ยังต้องเก็บสำรองและกุญแจอีกชุดบนอุปกรณ์/พื้นที่ส่วนตัวแยกจากเครื่องนี้เพื่อรับมือเครื่องเสีย และสร้าง backup ใหม่ทันทีในช่วงหยุดรับรายการก่อนย้ายจริง ไฟล์รอบนี้เป็นหลักฐานการซ้อม ณ เวลาที่บันทึก

คำสั่งสำหรับผู้ดูแลที่ตรวจเป้าหมายแล้ว:

```powershell
# ตั้งกุญแจจากไฟล์ที่เก็บปลอดภัยใน environment ของโปรเซสเท่านั้น
# PG_DUMP_PATH / PG_RESTORE_PATH ต้องเป็นเครื่องมือ PostgreSQL เวอร์ชันที่รองรับ server
npm run backup:database
# กู้ได้เฉพาะ loopback ฐานใหม่ชื่อ shop_restore_sandbox และต้องว่าง
npm run backup:database -- --restore "backups/ชื่อไฟล์.enc"
```

สคริปต์ scripts/rehearse-source-backup.ts --source-backup ทำ backup แบบอ่าน source อย่างเดียว แล้วตรวจ drift / migration เฉพาะสำเนา PostgreSQL ชั่วคราวในเครื่อง ต้องมี LOCAL_EMBEDDED_POSTGRES_PATH, PG_DUMP_PATH และ PG_RESTORE_PATH ไม่ใช่คำสั่งเปิดใช้ migration จริง

## 2. ตรวจข้อมูลเข้ารหัสก่อนเปลี่ยนกุญแจ

พบค่าที่เข้ารหัส 38 ค่า กุญแจที่มีในเครื่องและ environment Vercel อ่านได้ 14 ค่า อีก 24 ค่าไม่ผ่าน authentication ของ AES-GCM ไม่มีรูปแบบผิดหรือ payload ว่าง กุญแจปัจจุบันไม่ผ่านการตรวจความปลอดภัย

เจ้าของยืนยันแล้วว่าข้อมูลทั้งหมดเป็นการทดลอง การซ้อมบนสำเนาผ่าน: รักษา 14 ค่าที่อ่านได้ แทน 24 ค่าที่เปิดไม่ได้ด้วย MOCK และหมุนไปกุญแจชั่วคราวใหม่ครบ 38 ค่า โดย rollback ได้ ข้อมูลและกุญแจบนฐานร้านจริงยังไม่ได้เปลี่ยน การค้นกุญแจเก่าไม่ใช่งานที่เจ้าของต้องทำซ้ำเพื่อซ้อมอีก แต่ก่อนเปลี่ยนจริงยังต้องตรวจและอนุมัติแผนใน encryption-key-rotation.md พร้อม backup ใหม่

อย่าแทน ENCRYPTION_KEY ด้วยค่าสุ่มแล้วหวังว่าข้อมูลเดิมจะใช้ได้ ห้ามทิ้ง/แทนสต็อกที่อ่านไม่ได้อัตโนมัติ หากข้อมูลมีหลายกุญแจต้องตรวจให้ครบทุกแถวและซ้อมแผนรองรับหลายกุญแจบนสำเนาก่อน ดูแผน rotation เดิม ห้ามเปิดรับเงินเมื่อยังมีสินค้าที่ส่งให้ลูกค้าไม่ได้

## 3. แยก Preview และผู้ให้บริการทดสอบ

ฐาน cloud sandbox แยกสร้างและเชื่อมแล้ว: **shop78it-sandbox / acocmsdnkpjfggycsxro** ในองค์กร **november** มี 15 ตาราง สินค้า MOCK 3 รายการ สต็อกเข้ารหัส 6 ชิ้น และไม่มีข้อมูลลูกค้าจริง ใช้กุญแจ sandbox แยกจากร้าน ตรวจ Prisma/schema drift และทดสอบจอง–ยกเลิกแบบ rollback ผ่านแล้ว ดู launch-cloud-sandbox-latest.json

เว็บในเครื่องเปิดด้วย `npm run dev:cloud-sandbox` เพื่อบังคับตรวจ fingerprint และปิดเงินจริง/ข้อความจริง อย่าใช้ `npm run dev` ปกติโดยคาดว่าจะโหลด .env.sandbox.local อัตโนมัติ ประวัติ Prisma migration ของ cloud sandbox resolve สองไฟล์แล้วหลังตรวจว่าไม่มี schema drift และข้อมูลทั้ง 15 ตารางคงเดิม ตาราง metadata เปิด RLS และถอน public grants แล้ว ตรวจซ้ำแบบอ่านอย่างเดียวด้วย `npx tsx scripts/resolve-cloud-sandbox-history.ts` ดู launch-cloud-sandbox-history-latest.json ห้ามนำคำสั่งนี้ไปใช้กับฐานร้าน

ในฐานทดสอบใหม่ ใช้ migration ของ repository และข้อมูลจำลองเท่านั้น ไม่คัดลอกข้อมูลลูกค้าจริงขึ้น sandbox ระยะยาว ตั้ง Vercel Preview แยกจาก Production:

- DATABASE_URL และ DIRECT_URL ต้องชี้โปรเจกต์ทดสอบเดียวกัน
- APP_MODE=sandbox, ORDERS_ENABLED=true, PAYMENTS_ENABLED=false
- SANDBOX_DATABASE_FINGERPRINT เป็น SHA-256 identity ของฐานทดสอบจาก databaseFingerprint
- PRODUCTION_DATABASE_FINGERPRINT เป็น identity ของฐานร้าน และต้องต่างจาก sandbox
- Clerk ใช้ test instance และข้อมูลทดสอบ
- กุญแจ sandbox เป็นค่าสุ่มแยกจากกุญแจข้อมูลจริง
- ไม่ใช้ SMTP/Telegram/TrueMoney/SlipOK credentials ของร้านจริงใน Preview
- URL ร้านและลิงก์รับสินค้าเป็น HTTPS ของ Preview นี้

โค้ดใหม่ปฏิเสธ write ใน Preview ที่ไม่ผ่านการแยกฐาน และปฏิเสธ APP_MODE=sandbox ที่ชี้ฐาน remote โดยไม่มีหลักฐานแยกฐาน แต่โค้ดนี้ยังไม่ได้ deploy จึงไม่ถือว่า Preview ที่อัปก่อนหน้านี้ได้รับการป้องกันแล้ว

ทดสอบ provider จริงเฉพาะ sandbox ที่ผู้ให้บริการรองรับ ห้ามใช้ voucher จริงหรือสลิปจ่ายเงินจริงเพื่อแทน sandbox ผลทดสอบด้วย mock ไม่ยืนยันว่า provider credentials จริงใช้ได้

## 4. ซ้อมและอนุมัติ migration

สำเนาข้อมูลร้านรอบนี้ผ่าน baseline drift check, กู้คืนจำนวน/row digest ตรงกัน และ additive migration ได้ครบ 15 ตาราง โดยยอดเงิน สต็อกและ bytes ที่เข้ารหัสเดิมไม่เปลี่ยน แต่อีก 24 ค่ายังอ่านไม่ได้เหมือนก่อน migration จึงยังไม่ผ่านเกณฑ์เปิดร้านทั้งหมด

ก่อนย้ายจริง: หยุดรับรายการใหม่ตามแผน, สำรองใหม่และตรวจ restore, ปิด worker ชั่วคราวตามขั้นตอนที่เจ้าของตรวจแล้ว, ตรวจ drift อีกครั้ง และขออนุมัติแผนย้าย/rollback จากเจ้าของ ห้าม db push, reset, clear-db หรือ seed ลงฐานร้าน

ใช้ขั้นตอน baseline resolve และ migrate deploy ตาม commerce-migration-plan.md เท่านั้นหลังได้รับอนุมัติ ห้ามรัน baseline CREATE TABLE ซ้ำบนฐานร้านเก่า บันทึกว่าประวัติ paidAt ของรายการเก่าเป็นค่า estimated เมื่อ backfill ไม่ใช่เวลา provider ที่ยืนยันจริง

## 5. งานอัตโนมัติและการส่งสินค้า

vercel.json ยังคง cron ทุก 5 นาที /api/cron/clear-unpaid ไว้ตามเดิม ไม่เปลี่ยนให้วันละครั้งเพื่อให้ deploy ผ่าน เพราะจะทำให้คืนสต็อกและส่งซ้ำล่าช้า Vercel Cron รัน Production ส่วน Preview ต้องทดสอบ worker แบบได้รับอนุญาตบน sandbox เท่านั้น

ก่อนเปิดจริง:

1. เลือกโฮสต์/แผนรองรับร้านค้าและตารางงานทุก 5 นาที Vercel Hobby ใช้ส่วนตัวไม่ใช่เชิงพาณิชย์ ([Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines))
2. ตั้ง CRON_SECRET สุ่มอย่างน้อย 32 ตัวอักษรใน Production และตัวเรียกงานให้ตรงกัน เก็บความลับนอก repository
3. เรียก worker บน sandbox ด้วย header Authorization: Bearer ของ sandbox ตรวจบิลหมดอายุ คืนคูปอง/สต็อกครั้งเดียว ไม่คืนของรายการรับเงินแล้ว และไม่ปล่อยรายการ payment_review
4. อีเมล shop78it@gmail.com ในเครื่อง verify ผ่าน และเจ้าของยืนยันว่าได้รับอีเมลทดสอบ 1 ฉบับแล้ว ไม่ต้องสร้าง App Password ใหม่เพื่อทำขั้นตอนเดิมซ้ำ ผลนี้ยังไม่ยืนยันค่าบนโฮสต์ ต้องตรวจการส่ง/รับบน deployment เมื่อได้รับอนุญาตแยก การทดสอบอัตโนมัติใช้ SMTP sink ในเครื่องและไม่ส่งเมลจริง
5. ทดสอบ Telegram ไปยังห้องทดสอบที่อนุญาต ปัจจุบันตรวจ getMe ได้ แต่ยังไม่ส่งข้อความจริง
6. ทดสอบซื้อจำลองจนรับสินค้าทั้งอัตโนมัติและจัดส่งเอง ตรวจ access link ใช้ครั้งเดียวหมดอายุใน 15 นาที การส่งซ้ำ และลิงก์ HTTPS ของ deployment
7. ทดสอบ login กับ Clerk บน deployment ทดสอบ รวมแอดมินที่ primary email verified, ผู้ใช้ทั่วไปและผู้ไม่ login ปัจจุบันตรวจ BAPI test instance ได้แอดมินที่เข้าเกณฑ์ 1 บัญชี แต่ยังไม่ทดสอบ login บน deployment

หน้าหลังบ้านแสดง paid รอจัดส่ง, payment_review, การรับเงินค้าง, งานคืนสต็อกและข้อความที่ส่งไม่สำเร็จ การติดตามบริการแจ้งเตือนภายนอกต่อเนื่องแยกไว้ backlog

## 6. เปิด/หยุดรับรายการ

เริ่ม Production ด้วย ORDERS_ENABLED=false และ PAYMENTS_ENABLED=false ขณะตรวจการทำงาน ต้องตรวจ environment URL ร้าน, Clerk live, schema, กุญแจ, worker, การส่งสินค้าและ backup ให้ครบก่อนขออนุมัติ deploy/เปิด

หลังเจ้าของอนุมัติและตรวจหลักฐานครบ ตั้ง *_VERIFIED ตามสิ่งที่ทำจริง, HOSTING_COMMERCIAL_CONFIRMED=true, LAUNCH_APPROVED=true แล้วจึง ORDERS_ENABLED=true และ PAYMENTS_ENABLED=true ตามแผนเปิดร้าน การปรับค่า Vercel มีผลกับ deployment ใหม่ ต้องตรวจ deployment ที่ใช้ค่าจริงอีกครั้ง

หากพบปัญหา ปิดการรับรายการใหม่และรับเงินตามขั้นตอน deploy/config ของโฮสต์ก่อนตรวจบัญชีรับเงิน อย่า reset ออเดอร์ paid/payment_review เป็น pending หรือยกเลิกข้อมูลหลังรับเงิน งานจัดส่ง/แจ้งเตือนของรายการเดิมยังต้องดูแลต่อ

## คืนเงิน

ปุ่มหลังบ้านบันทึกการคืนเต็มยอดที่โอนภายนอกไปแล้วเท่านั้น ต้องยืนยัน transfer, เลขอ้างอิงและเหตุผล จึงสร้าง immutable audit และสถานะ refunded สินค้าที่เปิดเผยแล้วไม่กลับไปขายเอง ระบบป้องกันเลขอ้างอิงซ้ำรวมถึงการบันทึกพร้อมกันหลายออเดอร์

ยอดรับเงินเดิมยังคงอยู่ในรายงานตาม paidAt และยอดคืนวันนี้อยู่แยกตามเวลาบันทึก Bangkok ไม่ใช่รายงานยอดสุทธิหรือบัญชีเต็มรูปแบบ คืนบางส่วน/ยอดขาด/ยอดเกิน/สั่งโอนผ่าน provider เป็นงานภายหลัง
