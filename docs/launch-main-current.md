# สถานะ Shop78it ปัจจุบัน — 13 ตุลาคม 2026

เว็บที่กำลังเตรียมเปิดร้าน: **https://shop78it.netlify.app** บน Netlify Free ตามที่เจ้าของเลือก `2fa-go` ไม่ได้เปลี่ยน

ขณะนี้เป็น sandbox แยกฐาน ทดลอง Stripe ด้วย test key และ webhook ของ sandbox รับออเดอร์ทดลองได้ แต่ **PAYMENTS_ENABLED=false / LAUNCH_APPROVED=false** ไม่มีการเปิดเงินจริง SMTP/Telegram ยังปิด

รายละเอียดอ้างอิง [deployment ล่าสุด](netlify-deployment-latest.json) และ [รายงานฝั่งผู้พัฒนา](netlify-developer-readiness-latest.json) สิ่งที่ต้องใช้ข้อมูลร้าน/บัญชีเจ้าของดู [งานส่งต่อ](launch-owner-handoff.md)

สำรองก่อนปรับการเชื่อมต่อ Netlify ซ้อมกู้คืนผ่านครบ 15 ตาราง/13 ออเดอร์ ข้อมูลเข้ารหัสอ่านได้ 39 ค่า กุญแจ recovery แยกจาก archive และยังรอเก็บนอกเครื่องตามที่เจ้าของเลือก รายงาน [สำรองและกู้คืน](netlify-recovery-latest.json) ไม่มีค่าลับใน Git

เว็บ Vercel เดิมและฐานต้นทางไม่ได้เปลี่ยนในรอบนี้ การ migration/rekey และ writer guard ของต้นทางอยู่ใน [ประวัติ Vercel](vercel-closed-source-history.md) ห้ามเชื่อม Netlify sandbox กลับฐานต้นทางหรือใช้ environment เก่า redeploy โดยลำพัง

การเปิด Live ต้องใช้ final-domain configuration, Clerk Live, ช่องทางรับเงินจริงและสต็อกจริง ตรวจฐาน/กุญแจและสำรองก่อนเปลี่ยน ตรวจ login/payment/webhook/delivery/maintenance/ข้อความบนโฮสต์ครบ แล้วจึงเปิดรับเงินจริงเป็นขั้นสุดท้าย
