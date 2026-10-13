# สถานะ Shop78it ปัจจุบัน — 13 ตุลาคม 2026

เว็บที่กำลังเตรียมเปิดร้าน: **https://shop78it.netlify.app** บน Netlify Free ตามที่เจ้าของเลือก `2fa-go` ไม่ได้เปลี่ยน

ขณะนี้เป็น sandbox แยกฐาน ทดลอง Stripe ด้วย test key และ webhook ของ sandbox รับออเดอร์ทดลองได้ แต่ **PAYMENTS_ENABLED=false / LAUNCH_APPROVED=false** ไม่มีการเปิดเงินจริง เจ้าของตั้ง Gmail ใน Netlify แล้ว ตรวจ SMTP authentication และ deployed email configuration ผ่าน เจ้าของอนุญาตส่งเมลทดสอบ 1 ฉบับ: Netlify ส่งลิงก์รับสินค้าออเดอร์ FDDA ผ่าน HTTP 202 และ notification job เป็น sent แล้ว ยังรอยืนยันว่าได้รับเมลและเปิดลิงก์ได้ Telegram ยังปิด ดู [รายงานอีเมล](netlify-email-latest.json)

เจ้าของจัดการ Manual ทั้ง 3 รายการแล้ว: completed 2 รายการ มีข้อมูลจัดส่งเข้ารหัสอ่านได้ และ refunded 1 รายการ หน้าติดตามสะท้อนตรงกับฐานทั้งหมด รอจัดส่ง Manual เหลือ 0 ดู [ผลตรวจ Manual](netlify-manual-delivery-latest.json)

ค่าการส่งอีเมลล่าสุดอยู่ใน Netlify ที่เจ้าของตั้งเอง ไฟล์ environment ในเครื่องอาจยังมีค่าว่างเดิม ห้าม import ไฟล์เก่าทับทั้งชุดขณะ redeploy ให้ build โดยใช้ environment ปัจจุบันของ Netlify

รายละเอียดอ้างอิง [deployment ล่าสุด](netlify-deployment-latest.json) และ [รายงานฝั่งผู้พัฒนา](netlify-developer-readiness-latest.json) สิ่งที่ต้องใช้ข้อมูลร้าน/บัญชีเจ้าของดู [งานส่งต่อ](launch-owner-handoff.md)

สำรองก่อนปรับการเชื่อมต่อ Netlify ซ้อมกู้คืนผ่านครบ 15 ตาราง/13 ออเดอร์ ข้อมูลเข้ารหัสอ่านได้ 39 ค่า กุญแจ recovery แยกจาก archive และยังรอเก็บนอกเครื่องตามที่เจ้าของเลือก รายงาน [สำรองและกู้คืน](netlify-recovery-latest.json) ไม่มีค่าลับใน Git

เว็บ Vercel เดิมและฐานต้นทางไม่ได้เปลี่ยนในรอบนี้ การ migration/rekey และ writer guard ของต้นทางอยู่ใน [ประวัติ Vercel](vercel-closed-source-history.md) ห้ามเชื่อม Netlify sandbox กลับฐานต้นทางหรือใช้ environment เก่า redeploy โดยลำพัง

การเปิด Live ต้องใช้ final-domain configuration, Clerk Live, ช่องทางรับเงินจริงและสต็อกจริง ตรวจฐาน/กุญแจและสำรองก่อนเปลี่ยน ตรวจ login/payment/webhook/delivery/maintenance/ข้อความบนโฮสต์ครบ แล้วจึงเปิดรับเงินจริงเป็นขั้นสุดท้าย
