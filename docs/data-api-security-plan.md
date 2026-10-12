# การปิดสิทธิ์ Supabase Data API ของ Shop78it

**ใช้กับฐานร้านจริงแล้วหลังเจ้าของอนุมัติ**: Supabase migration 20261011064132 / lock_down_shop_data_api เปิด RLS และถอน public grants ทั้ง 9 ตาราง ได้สำรอง/กู้คืนใหม่ก่อนเปลี่ยน และ counts/SHA-256 ทุกแถวตรงกันหลังเปลี่ยน server Prisma ยังอ่านได้ ไม่มีการ deploy เปลี่ยนข้อมูลลูกค้า เปลี่ยนกุญแจ หรือรับเงินจริง

หลักฐาน: [ผลการเปลี่ยน](launch-rls-change-latest.json), [hash ก่อน–หลัง](launch-rls-preservation-latest.json), [backend read-only](launch-rls-backend-readonly-latest.json), [สิทธิ์ก่อน](launch-data-api-before-rls-latest.json) และ [สิทธิ์หลัง](launch-data-api-after-rls-latest.json)

Advisors หลังเปลี่ยนมี 0 ERROR/0 WARN และ INFO rls_enabled_no_policy 9 ตาราง ซึ่งตั้งใจใช้ default-deny เพราะเว็บเข้าฐานผ่าน server Prisma ไม่ใช่ Supabase browser client จึงไม่เพิ่ม policy allow-all เพื่อซ่อน INFO ([คำอธิบาย Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy))

ก่อนแก้ วันที่ 11 ตุลาคม 2026 ตรวจแบบอ่านอย่างเดียวพบทั้ง 9 ตารางธุรกิจปิด RLS และให้ anon/authenticated สิทธิ์ทั้งหมด รวมอ่าน เขียน ลบ และ TRUNCATE ไม่มี RLS policy หรือ SECURITY DEFINER function ใน public ขณะตรวจ ผลนี้แสดงช่องทางเสี่ยง ไม่ใช่หลักฐานว่าเกิดการขโมยข้อมูลแล้ว ต้องตรวจ Data API settings และประวัติ Logs เพิ่มเพื่อประเมินเหตุการณ์

อ้างอิง [Supabase advisory 0013](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public) และ [การเชื่อมต่ออย่างปลอดภัย](https://supabase.com/docs/guides/database/secure-data)

## ผลตรวจและวิธีแก้ที่เตรียม

- โค้ดเว็บใช้ Clerk และ Prisma จากเซิร์ฟเวอร์ ไม่พบการใช้ Supabase browser client / REST Data API ใน source
- DATABASE_URL และ DIRECT_URL ที่ตรวจจริงเชื่อมเป็น postgres: superuser=false, BYPASSRLS=true เจ้าของตารางเป็น postgres
- SQL ที่ใช้: [lock-down-data-api.sql](../scripts/sql/lock-down-data-api.sql) บันทึกผ่าน Supabase migration แล้ว ไม่ใช่การใช้ Prisma commerce schema migration ซึ่งยังรอเงื่อนไขเปิดร้าน
- เปิด RLS และถอน ALL PRIVILEGES ของ PUBLIC, anon, authenticated เฉพาะตารางร้าน 9 ตารางเดิม + 6 ตารางใหม่ที่มีอยู่ และ sequence ที่ผูกกับตารางเหล่านี้
- คงบทบาทเซิร์ฟเวอร์และ service_role เดิม ไม่เพิ่ม SECURITY DEFINER ไม่ใส่ policy allow-all ไม่ FORCE RLS และไม่เปลี่ยนข้อมูล/กุญแจ
- ถ้าชื่อตารางหลักไม่ครบ เจ้าของตารางผิด มี policy ที่ต้องทบทวน หรือมี inherited public grants เหลือ จะ abort ทั้ง transaction
- ไม่แก้ default privileges ของ Supabase แบบครอบคลุมทั้งระบบ เพราะอาจกระทบบริการอื่น ต้องตรวจตารางใหม่หลัง migration ทุกครั้ง และใช้ SQL นี้กับตารางใหม่ด้วย
- หากยืนยันว่าไม่มี integration อื่นใช้ Data API สามารถปิด Data API ของโปรเจกต์ใน dashboard เป็นชั้นป้องกันเพิ่มเติม ต้องตรวจผลกับบริการที่ใช้จริงก่อนเปลี่ยน

หลักฐานสิทธิ์เดิม (ไม่มีกุญแจ/ข้อมูลลูกค้า): [launch-data-api-before-rls-latest.json](launch-data-api-before-rls-latest.json) รวม ACL ราย grant, RLS, policies และ default privileges ของทั้ง direct/backend connection สำรอง pg_dump ที่ใช้ซ้อมก่อนหน้านี้ใช้ no-acl จึงต้องเก็บ permission snapshot นี้แยกสำหรับการทบทวน rollback

## ผลทดสอบ

[launch-data-api-test-latest.json](launch-data-api-test-latest.json) ทดสอบ PostgreSQL ในเครื่องเท่านั้น:

1. จำลองช่องโหว่: anon อ่านออเดอร์จำลองก่อนปิดสิทธิ์
2. หลังปิดสิทธิ์ 15 ตาราง จำนวนและ SHA-256 ของทุกแถวตรงเดิม รวมยอดเงินและ bytes เข้ารหัส
3. anon/authenticated และ role ที่รับเพียง PUBLIC อ่านทั้ง 15 ตารางไม่ได้ และ INSERT/UPDATE/DELETE/TRUNCATE/COPY ถูกปฏิเสธ
4. หากภายหลังเผลอให้ SELECT อีก RLS คืน 0 แถว ตัวตรวจแจ้ง blocked และ SQL รันซ้ำปิด grant ได้
5. Prisma อ่าน/สร้าง/แก้/ลบ fixture ผ่าน role NOSUPERUSER BYPASSRLS ที่มีสิทธิ์เหมือน backend จริงได้
6. เมื่อมี policy ที่ยังไม่ตรวจ SQL abort แบบ atomic และคง grant เดิมไว้
7. ใช้กับ schema เก่า 9 ตารางได้ ไม่สร้างตารางใหม่; baseline ไม่ครบจะปฏิเสธ

ชุดทดสอบ CI เรียก npm run test:data-api ด้วย SANDBOX_POSTGRES_URL ที่ชี้ loopback shop_sandbox เท่านั้น สร้างฐาน fixture ชื่อสุ่มแยกและล้างเฉพาะฐาน/roles ที่ตัวเองสร้าง ไม่โหลด .env หรือใช้ฐานร้าน

ตัวตรวจ audit และหน้าหลังบ้าน readiness แจ้ง blocked เมื่อ RLS ยังปิดหรือมี public role privileges เหลือ ผล metadata หลังเปลี่ยนฐานจริงผ่านทั้ง 9 ตารางแล้ว แต่โค้ดหน้าตรวจใหม่ยังไม่ deploy และการเปิดรับออเดอร์ยังต้องตรวจเงื่อนไขอื่นตาม runbook

เพื่อป้องกันช่องเดิมกลับมาในอนาคต เพิ่ม RLS และถอน public grants ของ 6 ตารางใหม่ใน Prisma commerce_safety ที่ยังไม่ใช้จริงแล้ว ไม่เปลี่ยน default privileges แบบครอบคลุม ต้องตรวจตารางอื่นใน public แยกทุกครั้ง

## ก่อนใช้กับฐานจริง

1. เจ้าของอนุมัติเปลี่ยนสิทธิ์ฐานจริงแยกจากการ deploy โค้ด เนื่องจากงานนี้กำหนดห้าม deploy/ทดสอบ write ลงฐานร้าน
2. ตรวจ project ร้านและ backend role ซ้ำ จัดเวลาบำรุงรักษาและเก็บ backup ใหม่พร้อม permission snapshot ก่อนเปลี่ยน ถ้ามี integration Data API ของงานอื่นต้องปรับแผนก่อน
3. ใช้ SQL ที่ตรวจไว้กับเป้าหมายที่ยืนยันแล้วผ่านเครื่องมือ migration ของ Supabase เพื่อมีประวัติ DDL ห้ามรัน baseline/reset/seed หรือเปลี่ยน ENCRYPTION_KEY
4. ตรวจ advisors ซ้ำ: rls_disabled_in_public ต้องหมด ตรวจ ACL/public grants และ backend product/order reads แบบอ่านอย่างเดียว
5. เปรียบเทียบจำนวน/row digests ก่อนและหลังในช่วงไม่มีรายการเปลี่ยน และตรวจเว็บ catalog/ติดตาม/แอดมิน งาน write ทดสอบบน sandbox เท่านั้น
6. ย้าย commerce schema ตามแผนที่อนุมัติ แล้วปิดสิทธิ์ตารางใหม่ก่อนเปิด Data API/ร้าน อย่าถือว่า Prisma drift check ตรวจ RLS ได้

## แผนย้อนกลับ

ถ้า SQL ล้มเหลวก่อน COMMIT จะย้อนสิทธิ์ใน transaction โดยอัตโนมัติ หากต้องย้อนหลัง COMMIT ให้ตรวจว่าเป็นปัญหาสิทธิ์จริงก่อน: เพิ่มสิทธิ์เฉพาะ backend role ที่จำเป็นหรือปิด Data API ไว้จะปลอดภัยกว่าคืน public grants เดิม

การคืนค่าเดิมต้องอ่าน RLS/ACL/policies จาก permission snapshot ของรอบนั้นและสร้าง SQL เฉพาะส่วนที่เปลี่ยน ไม่ restore/drop ตารางหรือทิ้งออเดอร์ใหม่ ไม่ GRANT ALL ให้บทบาทสาธารณะเพื่อแก้เว็บล่มโดยไม่ทบทวน เพราะจะเปิดช่องเดิมอีก ต้องได้รับอนุมัติและเก็บบันทึกเหตุการณ์
