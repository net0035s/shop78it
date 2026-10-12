# ผลเตรียมเปิดร้าน Shop78it — 11 ตุลาคม 2026

**สถานะล่าสุด 12 ตุลาคม: อัป Preview ทดสอบแยกแล้วตามเจ้าของอนุญาต ยังไม่พร้อมเปิดรับเงินจริงและไม่ deploy Production**

รักษางานแก้เดิม 26 ประเด็นและงาน UI ที่ค้างไว้ ไม่มี reset/ล้างฐาน/seed ลงฐานร้าน ไม่ได้เปลี่ยนกุญแจจริงหรือ environment บน Vercel รายการที่ต้องใช้บัญชีผู้ให้บริการ การตั้งค่าบนโฮสต์ หรืออนุมัติการย้ายจริงยังค้างตามตารางด้านล่าง

## งานที่เพิ่มและแก้แล้ว

1. เพิ่ม ORDERS_ENABLED และ LAUNCH_APPROVED สำหรับปิดรับรายการก่อนเปิดร้าน ระบบรับเงินยังต้อง PAYMENTS_ENABLED และกุญแจที่ปลอดภัย
2. Preview ต้องแยกฐาน sandbox จาก Production ด้วย fingerprint ที่ตรงทั้ง DATABASE_URL/DIRECT_URL ตัวจำลองที่ชี้ remote database โดยไม่มีหลักฐานแยกฐานถูกปฏิเสธเขียนข้อมูล
3. หลังบ้านเพิ่มหน้าตรวจความพร้อมและงานค้าง: payment_review, รับเงินค้าง, จ่ายแล้วรอส่ง, manual delivery, หมดอายุรอคืนสต็อก, retry ส่งข้อความหมดและงาน sending ค้าง
4. สิทธิ์แอดมินใช้ verified primary email ของ Clerk และ allowlist เท่านั้น ไม่เชื่อ metadata/secondary email ที่ตรงกันอย่างเดียว
5. เพิ่มบันทึกคืนเต็มยอดที่ทำภายนอกแล้ว ต้องมีคำยืนยัน เลขอ้างอิงและเหตุผล สร้าง audit แยก ป้องกันบันทึกซ้ำทั้งออเดอร์เดียว/ข้ามออเดอร์พร้อมกัน ไม่สั่งโอนเงินและไม่คืนคีย์ที่เปิดเผยกลับเข้าสต็อก
6. รายงานยอดรับคงประวัติเงินรับเดิมหลัง refund พร้อมยอดคืนวันนี้แยกกัน สถานะ refunded แสดงในหลังบ้าน/ติดตาม/รับสินค้า
7. แก้คิวอีเมลให้ไม่ส่งคำแนะนำสินค้าที่ถูกซ่อน ไม่ส่ง access link ที่ใช้แล้ว/หมดอายุ หยุด receipt ที่ค้างหลัง refund และแสดงงาน sending ที่หมด retry เป็น failed
8. เพิ่ม /help, ช่องทางช่วยเหลือสำรอง และข้อความแจ้งปิดร้าน ปรับ FAQ / นโยบายคืนเงิน / เงื่อนไขให้ตรงกับ manual และ automatic delivery
9. เอาคำกล่าวอ้าง 500+ รีวิว, ปลอดภัย 100% และส่งทันทีทุกสินค้าออกจากหน้าแรก/ข้อความหลัก เปลี่ยนเป็นพฤติกรรมของระบบที่ตรวจได้
10. เพิ่ม backup เข้ารหัสด้วยกุญแจอิสระ ตรวจ row counts/digests ใน snapshot เดียว กู้คืนได้เฉพาะฐาน loopback shop_restore_sandbox ว่าง และตรวจ drift ก่อนซ้อม migration
11. เพิ่ม .vercelignore สำหรับ backup, recovery key, environment, dev.db และรายงานปฏิบัติการ เพื่อไม่อัปขึ้น deployment โดยไม่ตั้งใจ
12. เพิ่มการทดสอบ SMTP จำลอง, สิทธิ์, refund, HTTP, layout และ PostgreSQL หลาย connection รวม CI ทดสอบ launch ด้วย PostgreSQL
13. เพิ่มการตรวจ RLS/public grants ใน audit และ readiness; หลังเจ้าของอนุมัติและสำรอง/กู้คืนใหม่ ได้เปิด RLS และถอน public grants จริงทั้ง 9 ตารางผ่าน Supabase migration 20261011064132 แล้ว ข้อมูล/hash คงเดิม และ Prisma อ่านได้

## ผลตรวจข้อมูลร้านและการซ้อมจริง

งานตรวจและสำรองอ่านฐานร้านอย่างเดียว ไม่ได้เปลี่ยนแถวข้อมูลบน Supabase หลังเจ้าของอนุมัติได้เปลี่ยนเฉพาะ RLS/privileges ทั้ง 9 ตารางและบันทึก Supabase migration โดยยังไม่ได้ใช้ commerce schema migration หรือ deploy โค้ด

- ตารางเดิม 9 ตาราง: Category 1, DeliveryItem 6, DigitalKey 0, DigitalStock 20, DiscountCode 1, Order 24, OrderItem 24, Product 4, StoreSettings 0
- ออเดอร์ cancelled 19, completed 4, pending 1; ไม่พบ sold stock บน pending order
- สำรองแบบเข้ารหัสสำเร็จ กุญแจสำรองเก็บแยกนอก repository และจำกัดสิทธิ์ Windows
- กู้คืนสำเร็จ จำนวนแถวและ SHA-256 ของแต่ละตารางตรงกันทั้ง 9 ตาราง
- baseline drift: ไม่พบความต่าง
- ซ้อม additive migration บนสำเนาในเครื่องสำเร็จ เป็น 15 ตาราง ยอดเงิน/สต็อก/bytes เข้ารหัสเดิมไม่เปลี่ยน
- สำเนาชั่วคราวถูกลบหลังหยุด PostgreSQL
- เข้ารหัส 38 ค่า: อ่านได้ 14 ค่า อีก 24 ค่า AES-GCM authentication ไม่ผ่านด้วยกุญแจใน .env, Preview และ Production ไม่พบกุญแจอื่นใน .env.local
- กุญแจปัจจุบันไม่ผ่านการตรวจค่าปลอดภัย ยังไม่เปลี่ยนหรือ re-encrypt ข้อมูลจริง

ตำแหน่ง archive และ recovery key อยู่ใน [หลักฐานสำรอง](launch-backup-rehearsal-latest.json) ไม่เผยค่ากุญแจในรายงาน สำรองครอบคลุม public business schema; ไม่รวม configuration ของ Supabase/ผู้ให้บริการ และยังต้องเก็บสำรองส่วนตัวอีกชุดนอกเครื่องนี้ ณ เวลาตรวจ Supabase Auth/Storage มีจำนวน 0

## ผลทดสอบ

| การตรวจ | ผล |
|---|---|
| lint / TypeScript | ผ่าน |
| import/configuration fail closed | ผ่าน |
| encryption utility ด้วยกุญแจชั่วคราว | ผ่าน |
| additive migration fixture | ผ่าน |
| commerce 28 กลุ่ม | ผ่านบน PGlite และ PostgreSQL หลาย connection |
| launch 9 กลุ่ม | ผ่านบน PGlite และ PostgreSQL หลาย connection รวม SMTP loopback ใน Next development และบังคับ TLS สำหรับ live/production |
| backup/restore fixture + wrong key/tamper/occupied target | ผ่าน |
| RLS/public grants 7 กลุ่ม | ผ่าน PostgreSQL จำลอง: 15/9 ตาราง, public roles ถูกปฏิเสธ, Prisma non-superuser ยังใช้ได้, digest ทุกแถวคงเดิม |
| RLS/public grants ฐานร้านจริงหลังอนุมัติ | ผ่านทั้ง 9 ตาราง: RLS=true, anon/authenticated/PUBLIC ไม่มีสิทธิ์, counts/SHA-256 ทุกแถวตรง backup ใหม่ และ server Prisma อ่าน Product/Order/OrderItem/DigitalStock ได้ |
| Supabase security advisors หลังปรับ | 0 ERROR/0 WARN; INFO 9 รายการ rls_enabled_no_policy เป็น default-deny ที่ตั้งใจสำหรับเว็บที่ใช้ server Prisma เท่านั้น |
| backup/restore/migration สำเนาข้อมูลร้าน | ผ่านโครงสร้างและข้อมูลเดิม; ยังอ่าน encrypted values 24 ค่าไม่ได้ตั้งแต่ก่อน migration |
| build:sandbox กับ Next 15.5.27 | ผ่าน |
| HTTP ของ build ที่รันในเครื่อง 6 กลุ่ม | ผ่าน: help/refund/terms, admin unauth=401, order number alone=403, scoped-cookie access และ payment-disabled=503 |
| browser help/track ขนาด 390 และ 1280 | ผ่าน 4 กรณี ไม่ล้นแนวนอน; ใช้ Edge headless, โปรไฟล์ทดสอบแยก และ Clerk test |
| Clerk test browser sessions | ผ่านแอดมิน verified-primary ได้ 200 และลูกค้าทั่วไปได้ 403 ใช้ official test helper; ยังไม่ยืนยันฟอร์ม login/Clerk live บน deployment |
| SMTP ในเครื่อง | Gmail verify ผ่านและเจ้าของยืนยันรับอีเมลทดสอบ 1 ฉบับแล้ว ชุดอัตโนมัติเก็บเมลใน local sink ไม่ส่งออก; บน deployment ยังไม่ยืนยัน |
| browser storefront ครบวงจร 9 กลุ่ม | ผ่าน checkout, จัดส่งสองรูปแบบ, auth, access link, coupon/cron และ password/download มือถือ ด้วยฐานชั่วคราวและ Clerk test |
| Telegram getMe | ผ่าน แต่ยังไม่ทดสอบส่งไปห้องทดสอบจริง |
| ผู้ให้บริการชำระเงินจริงใน sandbox | ยังไม่ตรวจ credential/endpoint จริง ผลปัจจุบันเป็น mock ไม่มีการรับเงินจริง |
| audit เฉพาะ dependency Production | 0 vulnerabilities |
| audit รวม dev tools | ยังมี 7 high entries และ CI audit gate ยังไม่ผ่าน |

ข้อความ Prisma write-conflict/deadlock ใน concurrency tests เป็นเหตุการณ์ที่ทดสอบ retry ของ Serializable transaction; assertions สุดท้ายผ่านและมี delivery/refund/coupon claim เพียงครั้งเดียว ข้อความ Telegram sandbox failure เป็นกรณีจำลอง retry ล้มเหลว ไม่ได้ส่งข้อความจริง

## แพ็กเกจความปลอดภัย

อัปเดต Next / eslint-config-next 15.5.25 → 15.5.27, Nodemailer 10.0.0 → 10.1.0 และ dependency ย่อย brace-expansion, sharp, source-map-js เป็นเวอร์ชันแก้ไขในช่วงที่รองรับ ตั้ง override postcss-selector-parser 7.1.6 ตาม [changelog ของผู้ดูแล](https://github.com/postcss/postcss-selector-parser/blob/main/CHANGELOG.md) แล้วตรวจ build/layout

audit ลดจาก 14 รายการเหลือ 7 รายการ ทั้งหมดอยู่ใน dependency เครื่องมือพัฒนา: braces, chokidar, micromatch, fast-glob, Tailwind และ ESLint Next chain ที่ใช้ braces ช่องโหว่หลัก [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) ยังไม่มี upstream patch ไม่ใช้ force upgrade Tailwind/Next major เพื่อซ่อนผลตรวจหรือแก้ node_modules แบบไม่ทำซ้ำได้ ไม่มีการลด CI audit gate

ดู [ผล audit เต็ม](launch-dependencies-audit-latest.json) ยังต้องแก้/ทบทวนความเสี่ยง tooling อย่างชัดเจนก่อนถือว่า release checks ครบ ห้ามนำรูปแบบ glob จากผู้ใช้ภายนอกไปรันกับเครื่องมือเหล่านี้

## ช่องทาง Data API ที่แก้บนฐานจริงแล้ว

ดู [ผลเปลี่ยนสิทธิ์](launch-rls-change-latest.json), [ข้อมูลคงเดิม](launch-rls-preservation-latest.json), [Prisma read-only](launch-rls-backend-readonly-latest.json) และ [แผน/rollback](data-api-security-plan.md) สิทธิ์ก่อนเปลี่ยนเก็บแยกไว้ใน launch-data-api-before-rls-latest.json สำรองใหม่รอบ 06:40 UTC ได้กู้คืนตรวจครบแล้ว SQL เปลี่ยน permissions เท่านั้น ไม่รับเงินจริง ไม่ deploy ไม่เปลี่ยนกุญแจจริง และไม่สร้าง sandbox cloud

migration commerce ที่ยังไม่ใช้จริงเพิ่ม RLS และถอน public grants ของ 6 ตารางใหม่แล้ว ต้องตรวจจริงหลังย้ายอีกครั้ง ค่า default privileges ของ Supabase ยังไม่เปลี่ยน จึงห้ามสร้างตารางอื่นใน public แล้วอ้างว่าได้รับการป้องกันอัตโนมัติ

## สิ่งที่ยังติดขัดก่อนเปิด

| ลำดับ | เรื่อง | สิ่งที่ต้องมี/ทำต่อ |
|---|---|---|
| P0 | ข้อมูลเข้ารหัสเดิม 24 ค่าอ่านไม่ได้ | ข้อมูลทั้งหมดเป็นการทดลองตามเจ้าของยืนยัน ซ้อมบนสำเนาผ่านครบ 38 ค่าโดยรักษา 14 ค่าและแทน 24 ค่าด้วย MOCK ยังต้องตรวจแผนและอนุมัติฐาน+runtime จริง พร้อม backup ใหม่ ไม่ต้องค้นกุญแจเดิมเพื่อซ้อมซ้ำ |
| P0 | Preview เดิมใช้ฐานร่วม Production | สร้างและเชื่อม cloud sandbox แยกใน november แล้ว แต่ยังไม่เปลี่ยน environment/deploy Preview เดิม ต้องใช้แผนแยก deployment ก่อนอนุมัติอัปโหลด |
| P0 | ฐานร้านยังไม่ migration | ยังขาด 6 ตารางใหม่และ 5 Order columns ซ้อมการย้ายและ backup/restore ผ่านแล้ว ต้องอนุมัติการย้ายจริงพร้อม backup ใหม่ก่อน |
| P0 | SMTP บนโฮสต์ | EAUTH ในเครื่องแก้แล้ว Gmail verify และรับข้อความทดสอบ 1 ฉบับผ่าน ค่าบน Vercel/การส่งจาก deployment ยังไม่ยืนยัน ไม่ต้องสร้าง App Password ใหม่เพื่อทดสอบขั้นเดิมซ้ำ |
| P0 | โฮสต์ / worker / live configuration | Vercel ปัจจุบันเป็น Hobby ต้องเลือกรูปแบบรองรับการขายและ cron 5 นาที ตรวจค่าใช้จ่ายก่อนเปลี่ยน ตั้ง CRON_SECRET สุ่ม ≥32, URL HTTPS และ Clerk live ที่ถูกต้อง |
| P1 | sandbox ของ payment provider | ต้องมี credential/วิธี sandbox ที่ผู้ให้บริการรองรับ ห้ามใช้เงินจริงเพื่อแทน sandbox |
| P1 | deployed end-to-end | ต้องได้ Preview แยกและอนุญาต deploy ก่อนตรวจ login/รับสินค้า/อีเมล/Telegram/worker จริงบน deployment งานนี้ยังห้าม deploy |
| P1 | dependency audit dev tools | 7 high entries ที่สืบจาก braces ไม่มี upstream patch; gate เต็มยัง fail ตามจริง |
| P1 | สำรองนอกเครื่องและแผนกู้คืนเต็มบริการ | เก็บ archive/key แยกบนพื้นที่ส่วนตัวนอกเครื่อง และสำรอง configuration ผู้ให้บริการ ไม่อ้างว่ารอบนี้เป็น disaster recovery ครบทุกบริการ |

## งานภายหลัง

[feature-backlog.md](feature-backlog.md) แยก feature ใหม่ที่ยังเหลือ เช่นรีวิวจริง หน้า SEO รายสินค้า คืนเงินบางส่วน/เชื่อม provider import preview ประวัติซื้อข้ามอุปกรณ์ และ monitoring ภายนอก ไม่มีการรวมรายการเหล่านี้เข้ากับการแก้ 26 ประเด็นเดิมโดยไม่ระบุ

[launch-runbook.md](launch-runbook.md) ระบุลำดับสำรอง แยกฐาน ซ้อมย้าย ตั้ง worker ตรวจหลักฐาน และขออนุมัติเปิด/หยุดรับรายการ ไม่มีการซื้อแผน ส่งข้อความจริงหรือ deploy ในรอบนี้

## อัปเดตเรื่องกุญแจหลังเจ้าของยืนยันข้อมูลทดลองทั้งหมด

เจ้าของยืนยันว่ารายการทั้งหมดเป็นการทดลอง อนุญาตเฉพาะซ้อมข้อมูลใหม่/ย้าย 14 ค่าที่อ่านได้บนสำเนา ผลซ้อมอ่านด้วยกุญแจใหม่ครบ 38 ค่า (รักษา 14 ค่าเดิม แทน 24 ค่าด้วย MOCK) rollback และจำนวนแถว/เงิน/สถานะขาย/order links ผ่าน ไม่แก้ฐานจริงหรือ Vercel ไม่ deploy กุญแจใหม่ชั่วคราวไม่ได้เก็บไว้

ฐานจริงยังมีข้อมูลเดิมที่อ่านไม่ได้ 24 ค่า ต้องอนุมัติแผนฐาน+runtime ก่อนเปลี่ยนจริง งานค้นกุญแจเก่าไม่ใช่เงื่อนไขกู้ข้อมูลทดลองบนสำเนาอีกต่อไป แต่ห้ามใช้ผลซ้อมเป็นหลักฐานว่ากู้ข้อมูลต้นฉบับที่เปิดไม่ได้สำเร็จ

ดู [ผลซ้อม](launch-test-data-rekey-rehearsal-latest.json) และ [แผนขั้นต่อไป](encryption-key-rotation.md) ขั้นที่เจ้าของทำต่อได้คือแก้ SMTP และแยก Supabase sandbox ขณะรอแผนเปิดระบบครบ

## อัปเดต SMTP — 11 ต.ค. 2026 เวลา 15:01 น. (ไทย)

เจ้าของตั้ง EMAIL_USER=shop78it@gmail.com และ App Password ใน .env.local แล้ว ตรวจผ่าน Next env loader และ Nodemailer verify(): Gmail ยอมรับการเชื่อมต่อและยืนยันบัญชีสำเร็จ ไม่ส่งอีเมล ไม่เปลี่ยน environment บน Vercel

หลักฐาน: [launch-smtp-verification-latest.json](launch-smtp-verification-latest.json)

EAUTH ในผลตรวจเดิมไม่ใช่สถานะของบัญชีส่งในเครื่องล่าสุดแล้ว แต่ยังไม่ได้ยืนยันการรับอีเมลจริง/การจัดส่งบน deployment และค่าบน Vercel ยังไม่ได้ปรับ ขั้นต่อไปต้องได้รับอนุญาตส่งข้อความไปผู้รับทดสอบที่ระบุ จากนั้นแยกตั้ง environment สำหรับ sandbox/live ตามแผนโดยไม่ deploy ตอนนี้

ยืนยันการรับอีเมลทดสอบแล้ว: เจ้าของส่งภาพ Gmail แสดงข้อความหัวข้อ Shop78it — ทดสอบระบบส่งอีเมล พร้อมป้ายกล่องจดหมาย ผู้ส่งและผู้รับ shop78it@gmail.com ตรงกับการทดสอบ ส่งเพียง 1 ฉบับ ไม่มีการส่งเพิ่มเติม สถานะนี้ยืนยันการส่ง/รับจากการตั้งค่าในเครื่องเท่านั้น ยังไม่ใช่ผลทดสอบออเดอร์บน deployment และไม่ได้เปลี่ยน environment Vercel

## Supabase sandbox — 11 ต.ค. 2026

โปรเจกต์ acocmsdnkpjfggycsxro / shop78it-sandbox ในองค์กร november ตรวจ ACTIVE_HEALTHY และ public ว่างก่อนใช้ bootstrap_shop_sandbox ผ่าน Supabase MCP สร้าง baseline+commerce_safety พร้อม RLS/revoke ทั้ง 15 ตาราง ไม่เปลี่ยนฐานร้าน hddnabbhdjphjwjohvcg

เพิ่มข้อมูล MOCK เท่านั้น: หมวด 1 สินค้า 3 สต็อกเข้ารหัส 6 คูปอง 1 ออเดอร์ 0 ใช้กุญแจ sandbox ใหม่ใน .env.sandbox.local ไม่ใช้กุญแจร้าน ตรวจ payload ทั้ง 6 เปิดได้ และ checksum ciphertext ตรง cloud หลังใช้ลำดับ COLLATE C ให้ตรงการเรียงของ Node (ค่า checksum ต่างในครั้งแรกเกิดจากลำดับ collation ไม่ใช่ payload ต่าง)

ตรวจ RLS ครบ 15 ตาราง public grants 0; Advisors ERROR/WARN 0 มี INFO ไม่มี policy ตามการเข้าฐานผ่าน server-only หลักฐาน: [launch-cloud-sandbox-latest.json](launch-cloud-sandbox-latest.json)

DATABASE_URL/DIRECT_URL ของ sandbox ตั้งและตรวจแล้ว ห้ามส่ง password/connection string ในแชต ไม่เปิด npm run dev ปกติโดยคาดว่าจะโหลดไฟล์นี้เอง ต้องใช้ sandbox launcher ที่ตรวจ fingerprint และตัดบริการรับเงิน/ส่งข้อความจริงออก ประวัติ Prisma migration สองไฟล์ resolve แล้วหลังตรวจ schema drift และ checksum ไฟล์ตรง ข้อมูลทั้ง 15 ตารางคงเดิม พร้อม RLS/revoke ของ metadata ดู launch-cloud-sandbox-history-latest.json

ไม่ deploy ไม่รับเงินจริง ไม่ส่งข้อความเพิ่ม APP_MODE=sandbox PAYMENTS_ENABLED=false LAUNCH_APPROVED=false ไฟล์ sandbox ไม่ใส่ credentials รับเงินจริง/ส่งข้อความ ค่าฐานร้านและ Vercel คงเดิม

### เชื่อมเว็บในเครื่องกับ cloud sandbox ผ่านแล้ว

เจ้าของใส่ Session pooler URLs ใน .env.sandbox.local ตรวจ fingerprint acocmsdnkpjfggycsxro ตรงทั้งสองค่า Prisma อ่านสินค้า 3 รายการและสต็อก 6 ชิ้นได้ ถอดรหัส MOCK ครบ 6/6 โครงสร้าง Prisma diff ตรง (ไม่มี drift)

ทดสอบ cloud ผ่าน 5 กลุ่ม: บล็อกเงินจริง ปฏิเสธ fingerprint ฐานร้าน จอง/ยกเลิก/ยกเลิกซ้ำสำหรับ MOCK Account, MOCK License, MOCK Manual Delivery ทุกธุรกรรม rollback และ hash ทั้ง 15 ตารางกลับตรงก่อนทดสอบ ไม่มีข้อความส่งออก หลักฐาน launch-cloud-sandbox-connection-latest.json และ launch-cloud-sandbox-commerce-latest.json

เปิดใน PowerShell: cd "N:\ทำเว็บขาย24.7 bycodex" แล้ว npm run dev:cloud-sandbox จากนั้นเปิด http://localhost:3000 ใช้ launcher แยกเท่านั้น (อย่าใช้ npm run dev ปกติสำหรับขั้นตอนนี้) launcher ปิดเงินจริง อีเมล Telegram analytics และใช้ Clerk test ส่วนการทดสอบหน้าจอ/เข้าสู่ระบบครบวงจรบน cloud sandbox ยังต้องทำต่อ ไม่ถือว่าเว็บพร้อมเปิดรับเงินจริง

## งานฝั่งผู้พัฒนาเพิ่มเติม — 11 ต.ค. 2026 รอบทดสอบครบวงจร

แก้ checkout เมื่อคูปองลด 100%: ไม่ให้ restore effect ล้างออเดอร์ที่เพิ่งสร้างก่อนถึงหน้ารับสินค้า เพิ่ม regression ผ่านการซื้อบน browser จริง แก้ป้ายจัดส่งที่เคยแสดงสำเร็จทุกสถานะให้แสดงตามออเดอร์ แก้ input บัญชี/รหัสผ่าน/คีย์บนมือถือให้ย่ออยู่ในกรอบ และเอาคำรับรองซัพพอร์ต 24 ชั่วโมงที่ยังไม่ได้ยืนยันออกจากหน้ารับสินค้า/ไฟล์ดาวน์โหลด

ตะกร้าที่ปิดถูกซ่อนจาก keyboard/accessibility navigation แล้ว ปรับ local SMTP sink ให้ใช้งานใน Next development ได้เฉพาะ loopback sandbox/test พร้อม regression ที่ยืนยันว่า live/production ยังต้องใช้ TLS ไม่มีการส่งอีเมลจริงในชุดนี้

Browser E2E ผ่าน 9/9: ผู้ไม่เข้าสู่ระบบ/foreign origin ถูกปฏิเสธ, Clerk verified-primary test admin ได้สิทธิ์และลูกค้าถูกปฏิเสธ, checkout จอง stock และ payment endpoint ปิด, mock-confirmed auto delivery ส่งครั้งเดียวและ reload ได้, manual delivery รอแอดมินที่มีสิทธิ์, access link ข้ามอุปกรณ์ใช้ครั้งเดียวและล้าง hash, coupon/cron คืน stock ครั้งเดียว, คูปอง 100% รับสินค้าสำเร็จ, และมือถือซ่อน/แสดง password พร้อมดาวน์โหลดที่ไม่เผย hidden instructions รายงาน [launch-storefront-e2e-latest.json](launch-storefront-e2e-latest.json)

ใช้ฐาน loopback ชั่วคราว กุญแจใหม่ชั่วคราว SMTP ในเครื่อง และ synthetic Clerk test users ที่ลบหลังจบแล้ว ไม่มีเงินจริง ไม่มีข้อความส่งออก ไม่มี deployment ใช้ official Clerk helper จึงไม่อ้างว่าผ่านฟอร์ม login/MFA/Clerk live หรือหน้าร้านที่ deployed/cloud DB

ทดสอบ PostgreSQL หลาย connection ผ่าน commerce 28 + launch 9 + RLS 7 รวม backup เข้ารหัส/restore/digest และ migration preservation ผ่าน Build ที่แยก cache และไม่คัดลอก environment/dev.db ผ่าน TypeScript/lint ผ่าน runtime audit 0; audit รวม dev ยัง 7 high ที่ upstream ไม่มีแพตช์และ CI gate ยังไม่ผ่านตามจริง

Cloud sandbox resolve baseline และ commerce_safety history แล้วหลังตรวจไฟล์/schema/data ตรงกัน ไม่รัน migration SQL ซ้ำ ป้องกัน _prisma_migrations ด้วย RLS/revoke ผล Advisors 0 ERROR/0 WARN มี INFO default-deny 16 ตารางรวม metadata ข้อมูลธุรกิจทั้ง 15 ตารางคงเดิม ดู launch-cloud-sandbox-history-latest.json

ส่วนที่ต้องเตรียม/อนุมัติก่อนเปิดจริงสรุปไว้ใน [launch-owner-handoff.md](launch-owner-handoff.md) ฟีเจอร์ใหม่ยังแยกใน feature-backlog.md ไม่ใช่เหตุผลให้ทดลองรับเงินจริงหรือ deploy โดยไม่ได้อนุมัติ

## อัปเดต Stripe — 12 ตุลาคม 2026

เจ้าของเลือกสองช่องทาง: TrueMoney แบบเดิม และ Stripe Checkout รับบัตรพร้อม PromptPay สำหรับบัญชีประเทศไทย ซื้อครั้งเดียว THB เพิ่ม session/status/cancel/webhook และ worker reconciliation โดยไม่เปลี่ยน schema หรือข้อมูลฐานร้าน ตรวจ Session และ PaymentIntent mode/currency/ยอดรับและ binding ก่อนส่งสินค้า การส่งผลซ้ำไม่ส่งสินค้าซ้ำ การปิดหน้า Stripe ไม่ถือว่า payment canceled เมื่อ intent ยังประมวลผลอยู่

ผลล่าสุดผ่าน Stripe fixture 16 กลุ่มบน PGlite และ PostgreSQL หลาย connection, browser 10 กลุ่มรวมสองช่องทาง/Stripe disabled/มือถือ, commerce 28, launch 9, RLS 7, backup/restore/migration, TypeScript/lint และ isolated build แก้เลขออเดอร์ที่ล้นกรอบมือถือเพิ่ม Runtime audit 0 รวม dev ยัง high 7 ไม่มีการลด gate

ตรวจค่ากุญแจใน .env.sandbox.local พบ live-server key จึงไม่ส่ง Stripe API request และ provider check ถูกบล็อกก่อนสร้าง fixture/payment ส่วน live key ถูกตัดออกจาก child environment ของ cloud sandbox launcher ไม่ลบหรือแทนค่าในไฟล์ของเจ้าของ ต้องเปลี่ยนเป็น server key จาก Sandbox แล้วตรวจ create/read/reuse/expire ของ Checkout จากนั้นทดสอบ test card/PromptPay และ webhook จริงใน sandbox ผล mock ไม่ยืนยันขั้นตอนเหล่านี้ ไม่มีการรับเงินจริง ส่งข้อความ หรือ deploy

ดู [ขั้นตอน Stripe](stripe-integration.md) และ launch-stripe-summary-latest.json / launch-stripe-config-latest.json / launch-stripe-fixture-latest.json / launch-stripe-provider-latest.json

## Preview ออนไลน์ — 12 ตุลาคม 2026

เจ้าของอนุญาตให้อัป Preview หลังตรวจความปลอดภัย อัปจาก source snapshot ที่ตัด environment/backup/dev.db ออก ส่งเฉพาะ environment sandbox ผ่าน process env ไปเป็น deployment-scoped overrides ทั้ง build/runtime ไม่แก้ environment ของ Production ใช้ฐาน acocmsdnkpjfggycsxro กุญแจ sandbox เดิมและ Clerk test ปิดเงินจริง/SMTP/Telegram/analytics/cron เฉพาะ Preview ไม่แก้ cron ต้นฉบับ Stripe live key ถูกตัดออกและปุ่ม Stripe ปิด

[Preview ที่อัป](https://shop78it-49ti270dk-netnaruto0035s1-5199s-projects.vercel.app) — READY: dpl_B4ah2TEMPewN95NwB3SzatJKPAqu Production deployment ก่อน/หลังตรงกันและโดเมนร้านหลักไม่ชี้ Preview ใหม่นี้ มี Vercel Authentication ตามเดิม ต้องล็อกอินด้วยบัญชีเจ้าของหากถูกถาม

ทดสอบบน URL จริงผ่าน 6 กลุ่ม รวมสร้างออเดอร์ MOCK กับ fixture สินค้าใหม่ จอง stock ตรวจ cookie และปิด provider ที่รับเงินจริง หลังจบยกเลิกและลบเฉพาะ order/product/category ของสคริปต์ สินค้าเดิมทั้งหมดคงเดิม ไม่ลบข้อมูลทดสอบของเจ้าของ มี rate-limit buckets ของ HTTP tests ตามปกติ ไม่มีเมล/ข้อความส่งออก ผล launch-preview-smoke-latest.json / launch-preview-deployment-latest.json

ยังไม่ผ่าน Stripe provider test/card/QR/webhook เพราะ key ปัจจุบันเป็น Live ต้องเปลี่ยนเป็น test server key และตั้ง signing secret ก่อนอัป Preview รอบที่เปิด Stripe test ส่วน audit dev 7 high และเงื่อนไขก่อนเปิดจริงเดิมยังค้าง ไม่ตั้ง verification flags ให้ผ่านโดยไม่มีหลักฐาน
