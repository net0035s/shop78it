# สถานะเว็บหลักหลังย้าย — 12 ตุลาคม 2026

เว็บหลัก: https://shop78it.vercel.app

Production ปัจจุบัน: `dpl_9CejMLiCr4Jo9t8my3pP6UVvYntX` / `shop78it-q4d9k5xf7-netnaruto0035s1-5199s-projects.vercel.app` สลับโดเมนแล้ว เปิดหน้าแรกแบบไม่ใช้ authentication bypass ได้ HTTP 200

## งานที่ดำเนินการจริงแล้ว

- ย้ายต้นทาง hddnabbhdjphjwjohvcg จาก 9 เป็น 15 ตารางธุรกิจ บันทึก Prisma migration history ทั้งสองรายการ ตรวจ schema drift ไม่พบ ออเดอร์เดิมคง 26 รายการ ยอดเงิน สต็อก sold flags และความสัมพันธ์เดิมผ่านการตรวจ
- เปลี่ยนกุญแจ: เก็บ plaintext ของ 14 ค่าที่อ่านด้วยกุญแจในเครื่องได้ และแทน 24 ค่าเปิดไม่ได้ด้วย MOCK ตามที่เจ้าของยืนยันว่าทั้งหมดเป็นการทดลอง ไม่ใช่การกู้ข้อมูลเดิม และไม่คืน sold stock กลับขาย กุญแจใหม่อ่านได้ 38 ค่า
- ใช้ runtime database role แยก `shop78it_runtime_v2` ไม่มี superuser/createdb/createrole/bypassrls มี CRUD เฉพาะตารางธุรกิจกับ policy เฉพาะ role นี้ Backend ยังคงตรวจ Clerk/สิทธิ์ออเดอร์ทุกคำขอ ไม่ให้ anon/authenticated เข้าตาราง
- writer เก่าทั้งเว็บ/worker/เครื่องที่ใช้บัญชีเดิมถูกปฏิเสธโดย statement trigger ระดับฐาน ไม่อาศัย flag ที่โค้ดเก่าไม่รองรับ ต้องคง guard ไว้ ไม่ลบเพราะเห็นว่าเว็บใหม่เปิดได้
- สำรองก่อนย้ายล่าสุดและหลังย้ายเข้ารหัส ทดลอง restore ลง localhost ผ่าน รวม private guard schema/ชื่อ role ที่ต้องมีในการ restore แต่ไม่รวม Auth/Storage/global role passwords ค่า runtime ใหม่ทั้งหมดเก็บใน checkpoint เข้ารหัส กุญแจ archive แยกและ ACL เฉพาะผู้ใช้
- แพตช์ช่องโหว่ GHSA-vfj7-8cjw-p6xm ด้วย local security fork ของ braces: `vendor/braces` 3.0.4-shop78it.1 ไม่ใช่ upstream release เปรียบเทียบ syntax 76 กรณี ทดสอบโจมตี depth/cycle 30 กรณีผ่าน npm ci/lint/typecheck/tests/build/audit ผ่าน ไม่ลดเกณฑ์ CI Full/runtime audit ปัจจุบัน 0
- HTTP smoke บน Production ใหม่และโดเมนหลักผ่าน 6 กลุ่ม หน้าเว็บ/หน้าติดตาม/นโยบายเปิดได้ admin และ worker ปฏิเสธ unauthenticated New orders ถูกปิดก่อนเขียนธุรกิจ Stripe/TrueMoney ถูกปิด รวมตรวจ Stripe ด้วย probe grant ถูกสิทธิ์ ออเดอร์+อีเมลสะท้อนสถานะฐาน ไม่เปิดเผยสินค้า/สร้าง cookie/ส่งเมล ลบ grant ของ probe แล้ว และข้อมูลธุรกิจอื่นคงเดิม อนุญาตให้ rate-limit metadata เปลี่ยนตามคำขอทดสอบ
- Sandbox Stripe alias ยังชี้ Preview `dpl_CdnAbkQHB9h4BFtmo8CFRZYMy85C` ไม่ถูกสลับตาม Production

หลักฐาน: launch-source-transition-latest.json, launch-source-transition-rehearsal-latest.json, launch-post-transition-backup-latest.json, launch-closed-production-deployment-latest.json, launch-closed-production-smoke-latest.json, launch-dependencies-audit-latest.json

## ยังไม่ได้เปิดขายจริง

Production ใช้ APP_MODE=live แต่ ORDERS_ENABLED=false, PAYMENTS_ENABLED=false, LAUNCH_APPROVED=false, STRIPE_ENABLED=false และยังใช้ Clerk test instance มีบัญชีอีเมล/Telegram จากค่าที่เจ้าของตั้งแล้ว แต่ยังไม่ได้ยืนยัน delivery ของ Production ทั้งสองช่องทางในรอบนี้ ไม่มีการส่งข้อความจริง ไม่มีการรับเงินจริง ไม่มีการซื้อแผนหรือโดเมน

ยังไม่ตั้ง cron บน closed deployment เพราะแพลนปัจจุบัน Hobby ไม่รองรับรอบ 5 นาที source vercel.json ยังเก็บ schedule เดิม ไม่เปลี่ยนเป็นรายวันเพื่ออ้างว่า worker พร้อม

## ส่วนที่ต้องใช้บัญชีและข้อมูลของเจ้าของก่อนเปิด

1. จัดแผน Vercel สำหรับการค้าจริงและ worker 5 นาที Pro เริ่ม $20/เดือน รวมหนึ่ง deploying seat และเครดิต usage $20 มีภาษี/usage ส่วนเกินตามจริง ยังไม่ซื้อ อาจมีสิทธิ์โดเมนปีแรกใน TLD ที่กำหนดตามข้อเสนอของบัญชี ตรวจราคา/ต่ออายุก่อนเลือก
2. เลือกโดเมนที่เป็นเจ้าของและจัด DNS เพื่อ Clerk production จากนั้นตั้ง Clerk Live/redirect/OAuth ที่เลือก และทดสอบ login/แอดมินบนโดเมนสุดท้าย
3. ใส่ Stripe Live + Live webhook secret และบัญชี TrueMoney ที่จะใช้จริงอย่างปลอดภัย ทดสอบ provider ตามขอบเขตที่อนุมัติ ข้อมูล Sandbox ไม่ใช่หลักฐานว่าบัญชี Live ผ่าน KYC หรือพร้อมรับเงินจริง
4. เจ้าของตรวจสินค้า/ราคา/สต็อกสำหรับขายจริง เพราะข้อมูลเดิมเป็นการทดลองและมี MOCK ทดแทน 24 ค่า นำสำรองที่จัดไว้ไปอัปโหลดแยกกุญแจตามที่เลือกทำภายหลัง
5. เมื่อตัวเลือกข้างต้นพร้อม จึง deploy final-domain configuration ตรวจ worker/email/Telegram delivery แล้วอนุมัติเปิด flags รับออเดอร์และเงินเป็นขั้นสุดท้าย

อ้างอิง: [Vercel Pro](https://vercel.com/docs/plans/pro-plan), [Hobby ใช้ส่วนตัวที่ไม่ใช่การค้า](https://vercel.com/docs/plans/hobby), [Clerk production ต้องมีโดเมนและ DNS](https://clerk.com/docs/guides/development/deployment/production)

## การ deploy/กู้คืนครั้งถัดไป

ค่าชุดใหม่ scoped ต่อ deployment และเก็บใน checkpoint เข้ารหัส ยังไม่ได้เขียนทับ project environment เก่าที่อ่านค่า sensitive กลับไม่ได้ ห้ามกด redeploy จาก global env เก่าหรือสลับ alias กลับเวอร์ชันเก่าลำพัง เพราะกุญแจ/ฐานเปลี่ยนแล้ว

ใช้ `scripts/deploy-closed-production.ts --closed-production` สำหรับเตรียม closed deployment และตรวจ smoke ก่อน `scripts/promote-closed-production.ts --promote-closed` ตรวจ primary ID ตาม release ที่กำลังจัด หากต้องเริ่ม release ถัดไปต้องอัปเดต pinned predecessor หลังตรวจของจริง ห้าม force ข้าม guard ห้ามเปิด intake บน Source ที่ยังมีสินค้า/กุญแจ MOCK และ Clerk test

Rollback ต้องเป็นชุด: ตรวจว่าข้อมูลธุรกิจไม่ได้ถูกแก้หลัง checkpoint (ไม่นับ rate-limit bookkeeping), กู้ original business projection ภายใต้ lock/token ตามเครื่องมือที่ซ้อม, ถอน guard/role ที่สร้างโดยงานนี้อย่างมีขอบเขต แล้วคืน immutable deployment เดิม `dpl_BYRSgyBPXEAmcYAte9PeqjZUxPqU` ตารางเพิ่มคงไว้ ไม่ drop ตารางหรือ restore ทับรายการใหม่ ห้ามทำย้อนหลังหลังเปิดรับเงินหรือมีการแก้ข้อมูลโดยไม่กระทบยอด

การซ้อมคืนข้อมูล/ถอน guard/เปิด writer เดิมผ่านบน localhost รวมถึงการ backup/restore ฐานที่มี role policy และ trigger ไม่ได้ rollback Production ที่ย้ายสำเร็จแล้ว

เครื่องมือตรวจ recovery: `scripts/rollback-closed-source.ts` ค่าเริ่มต้น read-only เปรียบเทียบ digest ธุรกิจ (ยกเว้น rate-limit bookkeeping) และตรวจ deployment เดิม READY โหมดเขียนต้องยืนยัน paired recovery และตรวจว่า project.paused=true ก่อน lock/คืนข้อมูล/ถอน guard หลังทำต้องคง maintenance จนคืน runtime เดิมแล้ว ห้ามรันโหมดเขียนเพื่อทดสอบบนต้นทาง
