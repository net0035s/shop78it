# รายงานตรวจโปรเจค Shop78it / ShopAuto 24/7
วันที่ตรวจ: 5 กันยายน 2026

## ผลประเมิน

โปรเจคมีหน้าร้าน ตะกร้า ชำระเงิน ติดตามออเดอร์ หลังบ้าน สต็อก คูปอง และหน้านโยบายแล้ว แต่ยังมีข้อบกพร่องสำคัญด้านข้อมูลลูกค้า การรับเงิน การจัดส่ง และสต็อก จึงยังไม่ควรถือว่าพร้อมรับเงินจริงอย่างเชื่อถือได้จากผลตรวจรอบนี้

ตรวจโค้ดและเส้นทางหลักของ Next.js/Prisma/Clerk พร้อมตรวจ TypeScript, ESLint, build และทดสอบโค้ดจริงด้วยข้อมูลจำลอง 11 สถานการณ์ การตรวจนี้ไม่ใช่คำรับรองว่าพบบัคทั้งหมด และไม่ใช่ผลตรวจ deployment ปัจจุบันบน Vercel

## ผลทดสอบและขอบเขต

| รายการ | ผล |
|---|---|
| TypeScript: `npx tsc --noEmit --incremental false` | ผ่าน |
| ชุดทดสอบการหมุนกุญแจเข้ารหัสเดิม: `npm run test-encryption` | ผ่าน |
| ชุดจำลองกรณีผิดพลาดที่เพิ่มในการตรวจ | ยืนยันพฤติกรรมผิดพลาดได้ 11 สถานการณ์ มีบางสถานการณ์ครอบคลุมหลายข้อ |
| ESLint ด้วย `next/core-web-vitals` โดยตรง ครอบคลุม 76 ไฟล์ใน src | 2 errors, 5 warnings |
| `npm run build` | Compile ผ่าน แต่ล้มเหลวระหว่าง Collecting page data เพราะ ENCRYPTION_KEY เป็นค่าเริ่มต้นที่ไม่ปลอดภัย |
| `npm ls next --all` | แจ้ง dependency ไม่เข้ากัน: Clerk 7.4.2 กับ Next 14.2.5 |
| `npm audit --json` | ติดต่อ registry ไม่สำเร็จ จึงไม่มีผลสแกน dependency ครบชุด |
| เบราว์เซอร์ในเครื่อง | หน้าแรกทั้ง localhost และ 127.0.0.1 แสดง Internal Server Error; log แสดง proxy socket hang up |
| ทดสอบมือถือ/เส้นทางซื้อจนจบ/แอดมินที่ล็อกอินจริง | ยังยืนยันไม่ได้ เพราะหน้าเว็บในเครื่องเปิดไม่สำเร็จ |
| รับเงินจริง ส่งอีเมล/Telegram เขียนฐานข้อมูลจริง | ไม่ได้ทำในการตรวจนี้ |

การทดสอบจำลองใช้ application source จริง แต่แทนฐานข้อมูล การชำระเงิน การเข้ารหัส และระบบแจ้งเตือนด้วยตัวจำลองในหน่วยความจำ จึงพิสูจน์ตรรกะของโปรแกรมได้ แต่ไม่ได้พิสูจน์การทำงานร่วมกันของผู้ให้บริการจริงหรือ transaction isolation ของ PostgreSQL

ไฟล์ทดสอบ: [scripts/audit-regressions-2026-09-05.cjs](<N:/ทำเว็บขาย24.7 bycodex/scripts/audit-regressions-2026-09-05.cjs>)  
รันซ้ำด้วย `node scripts/audit-regressions-2026-09-05.cjs` ชุดนี้ตรวจว่า “พฤติกรรมบัคยังเกิดอยู่” ไม่ใช่ชุดรับรองว่าเว็บถูกแก้แล้ว

## ต้องแก้ก่อนใช้งานจริง

### 1. Build ใช้งานจริงไม่ผ่านจากกุญแจเข้ารหัส — P1 / ทดสอบจริง
ระบบปฏิเสธ ENCRYPTION_KEY ปัจจุบันว่าเป็น unsafe default ขณะโหลด API ออเดอร์ หากใช้ค่านี้เข้ารหัสข้อมูลใหม่ก็จะถูกปฏิเสธโดย deriveEncryptionKey ด้วย ต้องสำรวจข้อมูลเดิม สำรอง และหมุนกุญแจอย่างถูกต้องก่อนเปลี่ยนค่า ไม่ควรแทนกุญแจแล้วหวังว่าข้อมูลเก่าจะถอดรหัสได้
หลักฐาน: [src/lib/encryption.ts:17](<N:/ทำเว็บขาย24.7 bycodex/src/lib/encryption.ts:17>) และ [docs/encryption-key-rotation.md](<N:/ทำเว็บขาย24.7 bycodex/docs/encryption-key-rotation.md>)

### 2. รู้เลขออเดอร์ก็อ่านข้อมูลลูกค้าและคีย์สินค้าได้ — P1 / ยืนยันด้วยตัวจำลอง
GET /api/orders รับเพียง orderNumber แล้วส่งชื่อ อีเมล เบอร์โทร รหัสผ่าน คีย์ และ deliveredContent ที่ถอดรหัสแล้วออกมา ไม่มีการยืนยันเจ้าของออเดอร์ ตัวเลขสุ่มท้ายเลขออเดอร์มีเพียง 4 ตัวจาก Math.random จึงไม่เหมาะใช้เป็นรหัสอนุญาตเข้าถึงข้อมูลลับ ควรใช้บัญชีเจ้าของออเดอร์ หรือโทเค็น guest ที่สุ่มอย่างปลอดภัยร่วมกับการยืนยันทางอีเมล และจำกัดการเรียกดู
หลักฐาน: [src/app/api/orders/route.ts:326](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/orders/route.ts:326>), [src/lib/utils.ts:26](<N:/ทำเว็บขาย24.7 bycodex/src/lib/utils.ts:26>)

### 3. Next.js เก่าและไม่ตรงรุ่นที่ Clerk รองรับ — P1 / ตรวจ dependency และประกาศทางการ
ติดตั้ง Next 14.2.5 แต่ Clerk 7.4.2 ระบุ peer dependency เป็น Next 15/16 ในช่วงรุ่นที่กำหนด ทำให้ npm รายงาน invalid dependency และเสี่ยงติดตั้งใหม่หรือใช้งาน auth ไม่ตรงเงื่อนไขที่รองรับ นอกจากนี้ Next 14.2.5 อยู่ในช่วงที่มีประกาศช่องโหว่ เช่น DoS ของ App Router และ RSC cache poisoning ซึ่งผลกระทบแต่ละช่องโหว่ขึ้นกับวิธี deploy/cache
ควรเลือก Next และ Clerk รุ่นที่รองรับกันและได้รับแพตช์ปัจจุบัน แล้วทดสอบ auth ใหม่ ไม่ควรอัปเดตเฉพาะหนึ่งแพ็กเกจโดยไม่ตรวจคู่รุ่น
หลักฐาน: [package.json:23](<N:/ทำเว็บขาย24.7 bycodex/package.json:23>), `node_modules/@clerk/nextjs/package.json`
อ้างอิง: [Next.js security update](https://nextjs.org/blog/security-update-2025-12-11), [RSC cache poisoning advisory](https://github.com/vercel/next.js/security/advisories/GHSA-wfc6-r584-vfw7)
ไม่ได้ทดสอบโจมตีช่องโหว่ framework และไม่ได้ยืนยันว่า bypass หลังบ้านได้ เพราะ API แอดมินมี requireAdmin อีกชั้น

### 4. ชำระเงิน/จัดส่งพร้อมกันอาจรับซ้ำและตัดคีย์หลายครั้ง — P1 / โค้ดและจำลองการจัดส่งซ้อน
payment อ่าน pending ก่อนเรียกผู้ให้บริการ แล้ว update ตาม id อย่างเดียว ไม่มีการยึดสิทธิ์ประมวลผลออเดอร์ให้เหลือคำขอเดียว ส่วน fulfillPaidOrder ตรวจสถานะก่อนตัดสต็อก แต่ไม่ได้ล็อกออเดอร์ทั้งกระบวนการ
จำลองการเรียก fulfillment ซ้อนกันสำหรับ quantity=1 ได้ delivery 2 รายการคนละคีย์ แม้ transaction ป้องกันการแย่งคีย์เดียวกันอยู่แล้ว ควรมี payment attempt/รหัสธุรกรรมที่ไม่ซ้ำ และการเปลี่ยนสถานะที่ตรวจสถานะเดิมแบบ atomic
หลักฐาน: [src/app/api/payment/truemoney/route.ts:204](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/payment/truemoney/route.ts:204>), [src/app/api/payment/slipok/route.ts:239](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/payment/slipok/route.ts:239>), [src/lib/order-fulfillment.ts:39](<N:/ทำเว็บขาย24.7 bycodex/src/lib/order-fulfillment.ts:39>)

### 5. รับเงินสำเร็จ แต่บันทึก paid ล้มเหลวแล้วไม่มีเส้นทางกู้รายการ — P1 / จำลองข้อผิดพลาดได้
TrueMoney รับซองก่อนเขียน status=paid และการเขียนครั้งแรกอยู่นอก catch ที่กู้กรณี fulfillment ล้มเหลว หากฐานข้อมูลขัดข้อง จะคืน 500 ทั้งที่ซองถูกใช้แล้ว ขณะที่ออเดอร์อาจยัง pending ลูกค้าลองใหม่ด้วยซองเดิมไม่ได้ SlipOK มีช่องว่างคล้ายกันหลังตรวจและ log สลิปสำเร็จ
ควรบันทึกความพยายามชำระเงิน/เลขอ้างอิงและยอดที่รับ พร้อมระบบตรวจยอดย้อนหลังและกู้รายการ รวมถึงกรณีรับต่ำกว่ายอดหรือมากกว่ายอด ไม่ควรเก็บหลักฐานเพียง slipUrl marker
หลักฐาน: [src/app/api/payment/truemoney/route.ts:217](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/payment/truemoney/route.ts:217>), [src/app/api/payment/slipok/route.ts:239](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/payment/slipok/route.ts:239>), [prisma/schema.prisma:92](<N:/ทำเว็บขาย24.7 bycodex/prisma/schema.prisma:92>)

### 6. งานยกเลิกออเดอร์อาจคืนคีย์ที่ลูกค้าจ่ายแล้วกลับไปขาย — P1 / จำลอง race ได้
cron เลือก pending นอก transaction จากนั้นคืน DigitalStock ตาม orderIds ก่อนเปลี่ยนสถานะโดยตรวจ pending อีกครั้ง ถ้ามีการจ่าย/จัดส่งระหว่างสองช่วง คำสั่งคืนคีย์ยังทำงาน แม้เปลี่ยนออเดอร์เป็น cancelled ไม่ได้ ผลจำลองคือ cancelledCount=0 แต่ restoredDigitalStockCount=1
ควรยึดสถานะออเดอร์ที่ยกเลิกได้จริงภายใน transaction แล้วคืนเฉพาะของออเดอร์เหล่านั้น และทำให้การชำระเงินใช้กติกาสถานะร่วมกัน
หลักฐาน: [src/app/api/cron/clear-unpaid/route.ts:68](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/cron/clear-unpaid/route.ts:68>) และ [src/app/api/cron/cancel-orders/route.ts:66](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/cron/cancel-orders/route.ts:66>)

### 7. สต็อกสินค้า Manual ทั้งแสดงผิดและไม่ลดเมื่อจ่าย — P1 / ยืนยันสองสถานการณ์
หน้าร้านและรายการสินค้าแอดมินใช้จำนวน DigitalStock กับสินค้าทุกประเภท สินค้า manual ที่ stock=5 แต่ไม่มี digital key จึงแสดงหมด ขณะที่ตอนสร้างออเดอร์ตรวจ Product.stock แทน เมื่อจ่ายแล้ว fulfillment ข้ามการตัด stock ของ manual
ควรแยกแหล่งนับสต็อก auto/manual ให้ตรงกันทั้งระบบ เพิ่มช่องปรับสต็อก manual และตัด/จองแบบ atomic
หลักฐาน: [src/app/page.tsx:50](<N:/ทำเว็บขาย24.7 bycodex/src/app/page.tsx:50>), [src/app/api/admin/products/route.ts:63](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/admin/products/route.ts:63>), [src/app/api/orders/route.ts:135](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/orders/route.ts:135>), [src/lib/order-fulfillment.ts:78](<N:/ทำเว็บขาย24.7 bycodex/src/lib/order-fulfillment.ts:78>)

### 8. นำเข้าบัญชีแล้ว URL/รหัสผ่านเสีย — P1 / ยืนยันด้วยตัวจำลอง
ตัวแยกข้อมูลใช้ split(/[|:]/) ทำให้ `email|password|https://example.invalid/login` ถูกเก็บ loginUrl เป็น `https` และรหัสผ่านที่มี colon ก็แยกผิด หากขาดรหัสผ่านกลับเติมค่าเริ่มต้นให้เอง ควรใช้รูปแบบ CSV/JSON หรือ delimiter เดียวที่กำหนดชัด พร้อม preview และ reject บรรทัดผิด
หลักฐาน: [src/app/api/admin/stock/route.ts:56](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/admin/stock/route.ts:56>)

### 9. คูปองจำกัดหมวดลดให้ทั้งตะกร้า — P1 / ยืนยันด้วยตัวจำลอง
ตรวจเพียงว่ามีสินค้าอย่างน้อยหนึ่งชิ้นเข้าหมวด แต่คำนวณส่วนลดจากยอดรวมทั้งหมด ตัวอย่างสินค้าที่เข้าเงื่อนไข 100 บาท + ไม่เข้าเงื่อนไข 900 บาท ใช้คูปอง 50% ได้ลด 500 บาท แทน 50 บาท หากเจตนาคูปองคือจำกัดสินค้าตามหมวด ควรคิดจากยอดสินค้าเข้าเงื่อนไขเท่านั้น และอธิบายกติกาในหลังบ้านให้ชัด
หลักฐาน: [src/app/api/orders/route.ts:244](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/orders/route.ts:244>), [src/app/api/discount/apply/route.ts:16](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/discount/apply/route.ts:16>)

## ปัญหาการสั่งซื้อและหลังบ้าน

### 10. คูปองใช้เกิน maxUses ได้ — P2 / พบจากโค้ด
ตรวจ usedCount ตอนสร้าง pending แต่เพิ่มจำนวนเมื่อลูกค้าจ่าย ไม่มีการจองสิทธิ์หรือเช็กจำนวนแบบ atomic ตอนใช้จริง จึงเปิด pending หลายบิลก่อนเต็มโควตาและจ่ายทั้งหมดได้ ควรเพิ่มการจองสิทธิ์พร้อมวันหมดอายุ หรือยืนยันสิทธิ์ภายในกระบวนการชำระเงินที่สอดคล้องกัน
หลักฐาน: [src/app/api/orders/route.ts:218](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/orders/route.ts:218>), [src/lib/order-fulfillment.ts:191](<N:/ทำเว็บขาย24.7 bycodex/src/lib/order-fulfillment.ts:191>)

### 11. ลดจนเหลือ 0 บาทแล้วออเดอร์ค้าง — P2 / ยืนยันด้วยตัวจำลอง
สร้าง pending total=0 ได้ แต่ PromptPay/SlipOK/TrueMoney ปฏิเสธยอดไม่เป็นบวก ควรมีเส้นทางส่งสินค้าราคา 0 หลังตรวจสิทธิ์ หรือห้ามคูปองลดถึง 0 อย่างชัดเจน
หลักฐาน: [src/app/api/orders/route.ts:276](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/orders/route.ts:276>), [src/app/api/payment/promptpay/route.ts:55](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/payment/promptpay/route.ts:55>)

### 12. หลังบ้านเห็น/ค้นได้แค่ 50 ออเดอร์ล่าสุด — P1 เมื่อมีออเดอร์จำนวนมาก / พบจากโค้ด
หน้าแอดมิน fetch /api/admin/orders โดยไม่ส่ง page/limit แต่ API ตัดที่ 50 รายการ ส่วน pagination และค้นหาทำเฉพาะรายการที่โหลดมา ทำให้บิลเก่าหายจากการค้นหลังบ้าน ควรค้นหา/กรอง/แบ่งหน้าที่ server และส่ง total กลับมา
หลักฐาน: [src/app/admin11/page.tsx:220](<N:/ทำเว็บขาย24.7 bycodex/src/app/admin11/page.tsx:220>), [src/app/api/admin/orders/route.ts:22](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/admin/orders/route.ts:22>), [src/components/admin/OrderManager.tsx:35](<N:/ทำเว็บขาย24.7 bycodex/src/components/admin/OrderManager.tsx:35>)

### 13. แอดมินไม่เห็นรายการที่ลูกค้าซื้อสำหรับบิลยังไม่ส่ง — P1 / พบจากโค้ด
GET ออเดอร์หลังบ้าน include เฉพาะ deliveryItems ไม่ include orderItems และ modal แสดงรายละเอียดจาก deliveryItems ทำให้ pending/manual ที่ยังไม่มีของส่งมอบไม่เห็นสินค้าและจำนวนที่ต้องจัดส่ง ควรแสดงรายการสั่งซื้อแยกจากรายการส่งมอบ
หลักฐาน: [src/app/api/admin/orders/route.ts:24](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/admin/orders/route.ts:24>), [src/app/admin11/page.tsx:735](<N:/ทำเว็บขาย24.7 bycodex/src/app/admin11/page.tsx:735>)

### 14. รีเฟรชหน้าชำระเงินแล้วกลับไปเริ่มใหม่ — P2 / พบจากโค้ด
createdOrder และ step อยู่ใน useState และเริ่มที่ info เสมอ แม้บันทึก currentOrder ลง store แล้วก็ไม่ได้ใช้กู้ขั้นตอนชำระ หน้า track ไม่มีปุ่มชำระออเดอร์เดิมต่อ กรณีโอนแล้วรีเฟรชก่อนอัปโหลดสลิปจึงเสี่ยงหลงไปสร้างบิลใหม่
ควรกู้บิล pending จาก server และมี URL สำหรับชำระต่อที่ยืนยันเจ้าของแล้ว
หลักฐาน: [src/app/checkout/page.tsx:74](<N:/ทำเว็บขาย24.7 bycodex/src/app/checkout/page.tsx:74>), [src/app/checkout/page.tsx:272](<N:/ทำเว็บขาย24.7 bycodex/src/app/checkout/page.tsx:272>), [src/app/track/page.tsx:280](<N:/ทำเว็บขาย24.7 bycodex/src/app/track/page.tsx:280>)

### 15. หน้ารับสินค้าไม่อัปเดตของที่ส่งเพิ่ม และ Manual บางกรณีไม่มีเนื้อหาให้ดู — P1/P2 / พบจากโค้ด
thank-you sync เฉพาะ status ไม่แทน deliveryItems/deliveredContent และไม่มี polling จึงไม่รับของที่แอดมินส่งภายหลัง หน้านี้ไม่ได้แสดง deliveredContent ของ manual ด้วย ส่วน track แสดง manual content เฉพาะสินค้าที่ deliveryType=manual เดิม กรณีสินค้า auto หมดแล้วแอดมินส่งผ่าน deliveredContent จะไม่มีการ์ดที่แสดงเนื้อหานั้น
ควรอิงข้อมูลส่งมอบจาก server ต่อ OrderItem มีทั้งชนิด/จำนวนที่ส่งแล้วและคงค้าง ไม่จับคู่ด้วยชื่อสินค้าอย่างเดียว
หลักฐาน: [src/app/thank-you/page.tsx:25](<N:/ทำเว็บขาย24.7 bycodex/src/app/thank-you/page.tsx:25>), [src/app/thank-you/page.tsx:94](<N:/ทำเว็บขาย24.7 bycodex/src/app/thank-you/page.tsx:94>), [src/app/thank-you/page.tsx:472](<N:/ทำเว็บขาย24.7 bycodex/src/app/thank-you/page.tsx:472>), [src/app/track/page.tsx:220](<N:/ทำเว็บขาย24.7 bycodex/src/app/track/page.tsx:220>)

### 16. คีย์เดียวแสดงซ้ำ และการซ่อนวิธีใช้งานไม่คงอยู่ — P2 / ยืนยันด้วยตัวจำลอง
fulfillment สร้าง DeliveryItem พร้อมผูก DigitalStock แต่ GET ออเดอร์รวมทั้งสองแหล่ง จึงได้คีย์เดียวสองรายการ นอกจากนี้ mapping ไม่ส่ง showInstruction ทำให้ค่า false หาย และ fallback จาก stock.content อาจคืนคำแนะนำที่ตั้งใจซ่อนไว้
ควรใช้แหล่งส่งมอบเดียวหรือ deduplicate ด้วย stock/delivery id และส่ง flags ให้ครบ
หลักฐาน: [src/app/api/orders/route.ts:393](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/orders/route.ts:393>), [src/app/api/orders/route.ts:407](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/orders/route.ts:407>)

### 17. ราคาในประวัติเปลี่ยนตามราคาปัจจุบัน และหน้าเว็บปัดสตางค์ทิ้ง — P2 / ตัวจำลองและโค้ด
GET ออเดอร์คืน product.price ปัจจุบันแทน OrderItem.price ที่บันทึกตอนซื้อ ตัวจำลองซื้อที่ 100 แต่ภายหลังราคาสินค้า 200 ทำให้รายละเอียดแสดง 200 อีกทั้ง formatPrice ใช้ maximumFractionDigits=0 ทั้งที่ฐานข้อมูลรองรับทศนิยม ทำให้ราคาแสดงไม่ตรงจำนวนที่ต้องชำระเมื่อมีสตางค์ และสรุปด้านข้าง checkout ยังอิงราคาตะกร้าเก่า
ควรเก็บ snapshot ชื่อ/ราคา/ชนิดส่งมอบ และแสดงยอดสุดท้ายจาก server พร้อมทศนิยมที่ถูกต้อง
หลักฐาน: [src/app/api/orders/route.ts:371](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/orders/route.ts:371>), [src/lib/products.ts:109](<N:/ทำเว็บขาย24.7 bycodex/src/lib/products.ts:109>), [src/app/checkout/page.tsx:841](<N:/ทำเว็บขาย24.7 bycodex/src/app/checkout/page.tsx:841>)

### 18. สินค้าซ้ำหลายบรรทัดทำให้ตรวจสต็อกผ่านทั้งที่จำนวนรวมเกิน — P2 / ยืนยันด้วยตัวจำลอง
stock=1 แต่ส่ง productId เดียวกันสองรายการ quantity=1 จะสร้างออเดอร์ quantity รวม 2 ได้ เพราะตรวจแยกบรรทัด ควรรวม quantity ต่อ productId ก่อนตรวจ และกำหนดเพดานจำนวนรายการ/จำนวนชิ้น
หลักฐาน: [src/app/api/orders/route.ts:86](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/orders/route.ts:86>), [src/app/api/orders/route.ts:111](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/orders/route.ts:111>)

### 19. เวลาหมดอายุออเดอร์สามส่วนไม่ตรงกัน — P2 / พบจากโค้ดและ config
หน้าชำระ PromptPay จำกัด 60 นาที, cancel-orders ใช้ 65 นาที แต่ vercel.json เรียกเฉพาะ clear-unpaid วันละครั้งและใช้เกณฑ์ 24 ชั่วโมง ขณะ payment API ไม่ตรวจอายุออเดอร์โดยตรง ส่งผลให้ UI ปฏิเสธบิลที่ server ยังยอมรับ และออเดอร์อาจค้างเกือบ 48 ชั่วโมงก่อน cron รอบถัดไป
ควรเก็บ expiresAt เดียวและตรวจฝั่ง server ทุกช่องทาง ใน .env ที่อ่านพบยังไม่มี CRON_SECRET แต่ยังไม่ได้ตรวจค่าบน Vercel
หลักฐาน: [src/app/checkout/page.tsx:20](<N:/ทำเว็บขาย24.7 bycodex/src/app/checkout/page.tsx:20>), [src/app/api/cron/cancel-orders/route.ts:6](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/cron/cancel-orders/route.ts:6>), [src/app/api/cron/clear-unpaid/route.ts:6](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/cron/clear-unpaid/route.ts:6>), [vercel.json:2](<N:/ทำเว็บขาย24.7 bycodex/vercel.json:2>)

### 20. ตรวจข้อมูลฝั่ง server และป้องกันการเรียกถี่ไม่พอ — P2 / ตัวจำลองและโค้ด
ชื่อช่องว่างล้วน/อีเมลผิดรูปแบบยังสร้างบิลได้ ไม่มี rate limit ใน public orders/payment/discount ที่ตรวจพบ ไม่มีเพดานจำนวนรายการ และ SlipOK ไม่มีตรวจ MIME/ขนาดไฟล์ก่อนส่งต่อ นอกจากนี้ราคาสินค้าจากแอดมินตรวจเพียง truthy แล้ว parseFloat จึงไม่กันค่าติดลบครบถ้วน
ควรมี schema validation, ขอบเขตข้อมูลและจำนวน, timeout ของบริการภายนอก และจำกัดการเรียกตามเส้นทาง ทั้งนี้ยังไม่ได้ตรวจ WAF หรือขีดจำกัดที่ hosting ตั้งเพิ่มภายนอกโปรเจค
หลักฐาน: [src/app/api/orders/route.ts:79](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/orders/route.ts:79>), [src/app/api/payment/slipok/route.ts:141](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/payment/slipok/route.ts:141>), [src/app/api/admin/products/route.ts:109](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/admin/products/route.ts:109>)

### 21. เปลี่ยน slug หมวดหมู่แล้วสินค้าไม่ตาม — P2 / พบจากโค้ด
ระบบสินค้าเขียน category เป็น slug แต่ไม่บันทึก categoryId ให้สอดคล้อง และการเปลี่ยน slug แก้เฉพาะ Category ทำให้ตัวกรองหมวดใหม่ไม่พบสินค้าเก่า ควรใช้ foreign key เป็นหลัก หรือย้าย slug ของสินค้าทั้งชุดใน transaction
หลักฐาน: [src/app/api/admin/products/route.ts:123](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/admin/products/route.ts:123>), [src/app/api/admin/categories/route.ts:73](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/admin/categories/route.ts:73>), [src/components/product/ProductGrid.tsx:35](<N:/ทำเว็บขาย24.7 bycodex/src/components/product/ProductGrid.tsx:35>)

### 22. เปลี่ยนสถานะหลังบ้านโดยไม่มีข้อกำหนดการเปลี่ยนสถานะ — P2 / พบจากโค้ด
API อนุญาตเปลี่ยน completed กลับ pending ได้โดยไม่ตรวจสถานะเดิม ทำให้ payment เปิดจ่ายบิลเดิมอีกครั้งได้ และอนุญาต completed โดยไม่ตรวจหลักฐานจ่าย/ความครบถ้วนในการส่ง ควรกำหนดเส้นทางเปลี่ยนสถานะ บันทึกผู้แก้/เหตุผล และแยกคืนเงินออกจากยกเลิก
หลักฐาน: [src/app/api/admin/orders/route.ts:76](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/admin/orders/route.ts:76>), [src/app/api/admin/orders/[id]/route.ts:39](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/admin/orders/[id]/route.ts:39>)

### 23. อีเมลและการแจ้งเตือนไม่มีผลยืนยัน/ลองส่งใหม่ — P2 / พบจากโค้ด
เรียกส่งแบบไม่ await; mailer จับข้อผิดพลาดและคืน false ซึ่งผู้เรียกไม่ตรวจ จึงไม่มีสถานะส่งล้มเหลวหรือ retry และ thank-you เขียนว่าส่งสำเนาอีเมลแล้วเสมอ ใน runtime ที่หยุดงานหลังตอบ request การแจ้งเตือนที่ค้างอยู่ก็เสี่ยงส่งไม่ครบ
ควรมีคิวงานส่งพร้อมสถานะ/จำนวนครั้งที่ลอง และปุ่มส่งใหม่หลังบ้าน รวมทั้งข้อความลูกค้าที่ตรงกับสถานะจริง
หลักฐาน: [src/lib/order-fulfillment.ts:206](<N:/ทำเว็บขาย24.7 bycodex/src/lib/order-fulfillment.ts:206>), [src/lib/mailer.ts:187](<N:/ทำเว็บขาย24.7 bycodex/src/lib/mailer.ts:187>), [src/app/thank-you/page.tsx:508](<N:/ทำเว็บขาย24.7 bycodex/src/app/thank-you/page.tsx:508>)

### 24. รูปสำรองและรูปแชร์ไม่มีไฟล์; SEO/ชื่อร้านยังไม่สอดคล้อง — P2 / ตรวจไฟล์และโค้ด
ไม่มี public directory แต่หลายหน้าอ้าง /images/products/placeholder.png และ metadata อ้าง /images/og-banner.jpg จึงไม่มีรูปสำรองในโปรเจคนี้ ค่า metadata ใช้ NEXT_PUBLIC_SITE_URL แต่ .env ที่ตรวจมี NEXT_PUBLIC_BASE_URL แทน ทำให้ fallback เป็น localhost หาก hosting ไม่ตั้ง SITE_URL เพิ่ม ชื่อ metadata/อีเมลเป็น ShopAuto 24/7 แต่ footer เป็น Shop78it
ควรเพิ่ม assets จริง เลือกชื่อร้านหลัก และตั้ง site URL ให้ตรง พร้อม metadata รายหน้า/สินค้า
หลักฐาน: [src/app/layout.tsx:23](<N:/ทำเว็บขาย24.7 bycodex/src/app/layout.tsx:23>), [src/app/layout.tsx:47](<N:/ทำเว็บขาย24.7 bycodex/src/app/layout.tsx:47>), [src/components/product/ProductCard.tsx:14](<N:/ทำเว็บขาย24.7 bycodex/src/components/product/ProductCard.tsx:14>), [src/components/layout/Footer.tsx](<N:/ทำเว็บขาย24.7 bycodex/src/components/layout/Footer.tsx>)

### 25. ยอด Dashboard และขอบเขตวันอาจคลาดเคลื่อน — P2 / พบจากโค้ด
ยอดรวมคิดเฉพาะ completed จึงไม่รวม paid/needs_manual_delivery ที่รับเงินแล้ว และจัดเข้าวันตาม createdAt ไม่ใช่เวลารับเงินจริง ส่วนขอบเขตวันใช้ timezone ของ server หาก deploy ใน UTC จะไม่ตรงวันประเทศไทย
ควรแยกยอดรับเงินจริง/ยอดส่งสำเร็จ เก็บ paidAt และคำนวณวันด้วย Asia/Bangkok อย่างชัดเจน
หลักฐาน: [src/app/api/admin/stats/route.ts:22](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/admin/stats/route.ts:22>), [src/app/api/admin/stats/route.ts:55](<N:/ทำเว็บขาย24.7 bycodex/src/app/api/admin/stats/route.ts:55>)

### 26. การตรวจคุณภาพและการติดตั้งซ้ำยังไม่ครบ — P2 / ตรวจจริง
ไม่มีไฟล์ config ESLint; ตรวจด้วย next/core-web-vitals โดยตรงพบ 2 errors เรื่อง quote ใน JSX ที่ admin11/page.tsx:809 และ 5 warnings มีเพียงชุดทดสอบเข้ารหัสเดิม ไม่พบชุดทดสอบเส้นทางสั่งซื้อ/ชำระเงินหรือ CI ใน repo ที่ตรวจ README มีเพียงชื่อโปรเจค และไม่พบ Prisma migration directory
ควรเพิ่ม config/lint ที่รันแบบไม่โต้ตอบ, CI, migration ที่ติดตามเวอร์ชัน และคู่มือติดตั้ง/กู้ระบบ ทั้งนี้ migration/backup อาจจัดการภายนอก repo ซึ่งยังไม่ได้ตรวจ
หลักฐาน: [src/app/admin11/page.tsx:809](<N:/ทำเว็บขาย24.7 bycodex/src/app/admin11/page.tsx:809>), [package.json](<N:/ทำเว็บขาย24.7 bycodex/package.json>), [README.md](<N:/ทำเว็บขาย24.7 bycodex/README.md>), [prisma/schema.prisma](<N:/ทำเว็บขาย24.7 bycodex/prisma/schema.prisma>)

## สิ่งที่มีแล้วและควรรักษาไว้

- คำนวณราคาสินค้าจากฐานข้อมูลตอนสร้างออเดอร์ ไม่เชื่อราคาจาก client
- API แอดมินที่ตรวจมี requireAdmin ร่วมกับ middleware
- มีการเข้ารหัส AES-256-GCM และเครื่องมือหมุนกุญแจพร้อมคู่มือ
- การแย่ง DigitalStock เดียวกันมี conditional update และตรวจจำนวนใน transaction
- มีหน้า terms/privacy/refund, การปฏิเสธคุกกี้ และโหลด GA/Pixel หลัง accepted
- มีเส้นทาง needs_manual_delivery เมื่อสต็อกไม่พอหรือจัดส่งอัตโนมัติผิดพลาด

โค้ด generateMockDeliveryItems ยังอยู่ใน orders API แต่ไม่พบการเรียกใช้ในเส้นทางที่ตรวจ จึงไม่ได้สรุปว่าเว็บกำลังส่งคีย์ปลอมจากฟังก์ชันนี้

## สิ่งที่เว็บไซต์ควรเพิ่ม

| ด้าน | รายการที่ควรมี |
|---|---|
| ผู้ซื้อและคำสั่งซื้อ | ดูออเดอร์อย่างยืนยันตัวตนได้, ชำระบิลเดิมต่อ, ประวัติข้ามอุปกรณ์, สถานะจ่าย/ส่ง/คืนเงินที่แยกชัด |
| ชำระเงิน | เลขอ้างอิงธุรกรรม, payment attempts, ป้องกันจ่ายซ้ำ, กระทบยอดและกู้รายการ, แนวทางยอดขาด/ยอดเกิน |
| สต็อกและจัดส่ง | จอง/ตัดสต็อกอย่างสอดคล้อง, stock manual, ตรวจคีย์ซ้ำ, preview import, ส่งบางส่วนต่อ OrderItem, บันทึกคนจัดส่ง |
| หลังบ้าน | ค้นหาเลขออเดอร์/อีเมลจากทุกบิล, รายการสินค้าและจำนวน, ส่งอีเมลใหม่, สถานะส่งล้มเหลว, ปิดขาย/ซ่อนสินค้าแทนลบประวัติ |
| ความช่วยเหลือ | FAQ, วิธีชำระและรับสินค้า, เวลาจัดส่ง manual, วิธีเคลมพร้อมช่องทางติดต่อและเวลาตอบที่ชัด |
| นโยบายและความน่าเชื่อถือ | ระบุข้อมูลร้าน/ผู้ติดต่อ, อธิบายระยะรับประกันของแต่ละสินค้าให้ตรงกับการเคลม 7 วัน, ข้อมูลการเก็บรักษา/ขอลบข้อมูลและวันที่ปรับปรุงนโยบาย |
| การค้นหาและแชร์ | หน้าสินค้าลิงก์ถาวร, sitemap/robots, title และรูปแชร์จริง, ข้อมูลสินค้าแบบ structured data ตามข้อมูลจริง |
| การเข้าถึงและมือถือ | dialog semantics, focus trap/คืน focus/ปิดด้วย Escape, label ของช่องค้นหา/เรียง, ทดสอบจอ 360–430px และ keyboard |
| ข้อมูลลับในเครื่องผู้ซื้อ | เก็บ localStorage เท่าที่จำเป็น ปัจจุบัน currentOrder และ guest history มีข้อมูลส่งมอบทั้งหมด; หลีกเลี่ยงเก็บรหัสผ่านถาวรและโหลด tracking บนหน้ารับคีย์โดยไม่จำเป็น |
| คุกกี้ | ปุ่มกลับมาเปลี่ยนใจ/ถอนความยินยอม พร้อมหยุด tracking ที่เริ่มแล้ว |
| ดูแลระบบ | error monitoring, แจ้งเตือน payment/stock/queue ค้าง, backup และทดลอง restore, CI และทดสอบซื้อด้วย sandbox |
| Repository | ตรวจเนื้อหา prisma/dev.db ที่ยังถูก track ก่อนเผยแพร่ repo; ยังไม่ได้เปิดตรวจข้อมูลภายใน จึงไม่สรุปว่ามีข้อมูลจริงรั่ว |

รายการนโยบายด้านบนเป็นข้อเสนอด้านความชัดเจนของบริการ ไม่ใช่การรับรองความครบถ้วนทางกฎหมาย

## ลำดับดำเนินการที่เสนอ

1. แก้การยืนยันเจ้าของออเดอร์และวางแผนย้ายกุญแจเข้ารหัส พร้อมปรับ Next/Clerk ให้เข้ากัน
2. ทำ payment state/รหัสธุรกรรม/กู้รายการ และแก้ race ระหว่างจ่าย จัดส่ง และ cron
3. แก้ stock manual, parser นำเข้าบัญชี, คูปอง และข้อมูลที่แอดมินใช้จัดส่ง
4. แก้การชำระต่อ/รับสินค้า/ราคาประวัติ/อีเมล แล้วทดสอบกับฐานข้อมูล sandbox และผู้ให้บริการทดสอบ
5. เก็บ assets, SEO, accessibility, monitoring และคู่มือ จากนั้นตรวจหน้าจอ desktop/mobile และ flow ซื้อครบอีกครั้ง

รอบนี้เพิ่มเฉพาะรายงานและชุดจำลองตรวจบัค ไม่ได้แก้ source การทำงาน เปลี่ยน environment/key หรือ deploy และรักษาไฟล์ที่ผู้ใช้แก้ค้างไว้ก่อนเริ่มงาน

