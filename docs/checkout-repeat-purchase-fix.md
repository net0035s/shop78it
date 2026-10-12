# ซื้อซ้ำหลังออเดอร์จ่ายแล้ว — 12 ตุลาคม 2026

สาเหตุ: Checkout ใช้ currentOrderNumber ที่เบราว์เซอร์จำไว้เพื่อคืนออเดอร์ แต่ล้างเฉพาะสถานะ completed ออเดอร์ที่จ่ายแล้วและรอสินค้า Manual (needs_manual_delivery) จึงถูกคืนและส่งกลับไปหน้าบิลเดิมเมื่อเริ่มซื้อใหม่

แก้ src/app/checkout/page.tsx: หากเข้าหน้า Checkout โดยไม่ระบุ order ใน URL จะเก็บออเดอร์ที่จบการชำระแล้วไว้ในประวัติ ล้างเฉพาะตัวชี้ออเดอร์ปัจจุบันและสถานะฟอร์ม แล้วเปิดการซื้อใหม่ ไม่ล้างตะกร้าใหม่หรือข้อมูลในฐาน ออเดอร์ pending และ Stripe payment_processing/payment_review ยังชำระต่อได้ ลิงก์ที่ระบุ order โดยตรงยังเปิดบิลเดิม รวมถึงการกลับจาก Stripe และหน้าติดตาม

ทดสอบด้วยฐาน loopback ชั่วคราว, Clerk test และ SMTP sink: Browser E2E ผ่าน 12 กลุ่ม เพิ่มกรณีซื้อใหม่ในเบราว์เซอร์เดิมหลัง completed และหลัง needs_manual_delivery ตรวจเลขบิลใหม่ต่างจากเดิม บิลเดิมไม่เปลี่ยน ประวัติยังอยู่ และลิงก์บิลเดิมเปิดได้ กรณีคูปอง 100%, การส่ง Manual, การอ่านสินค้าหลัง reload และสิทธิ์ออเดอร์เดิมยังผ่าน TypeScript และ lint ผ่าน ไม่มีการรับเงินจริงหรือส่งอีเมลจริง

อัปเฉพาะ Preview Sandbox ตามที่เจ้าของอนุญาต ผล deployment และ Webhook หลังอัปติดตามใน launch-preview-deployment-latest.json และ launch-stripe-webhook-online-latest.json ไม่เปลี่ยน Production และไม่เปลี่ยนข้อมูล/กุญแจร้านเดิม
