export interface PatchNote {
  version: string
  date: string
  title: string
  changes: string[]
  tags: string[]
}

export const patchNotes: PatchNote[] = [
  {
    version: 'v2.2-update',
    date: '2026-06-03',
    title: 'Telegram Sold-out Alert',
    tags: ['Enhancement', 'Telegram', 'Stock'],
    changes: [
      'Enhancement: เพิ่มระบบแจ้งเตือน Telegram ฉุกเฉิน เมื่อสต็อกสินค้า (DigitalStock) ถูกสั่งซื้อจนหมดเกลี้ยง (เหลือ 0 ชิ้น)',
    ],
  },
  {
    version: 'v2.0-beta',
    date: '2026-06-03',
    title: 'Beam Payment Gateway Beta',
    tags: ['Payment', 'Webhook', 'Major Update'],
    changes: [
      'Major Update: วางระบบชำระเงินอัตโนมัติ Beam Payment Gateway (QR PromptPay) พร้อมระบบ Webhook ตัดสต็อกและส่งสินค้าทันทีเมื่อชำระเงินสำเร็จ',
    ],
  },
  {
    version: 'v1.11.1',
    date: '2026-06-03',
    title: 'Hotfix ภาษาไทยหน้าแอดมิน',
    tags: ['Hotfix', 'UI', 'Encoding'],
    changes: [
      'Hotfix: แก้ไขปัญหา Encoding ภาษาไทยในหน้า Admin Menu',
    ],
  },
  {
    version: 'v1.11',
    date: '2026-06-03',
    title: 'แก้ไขการเข้าใช้งานระบบหลังบ้าน',
    tags: ['Security', 'Auth', 'Bug Fix'],
    changes: [
      'แก้ไข Middleware ให้ตรวจอีเมลจาก Clerk ได้เสถียรขึ้น และปรับระบบคลิกลับที่โลโก้ให้เปิดหน้าแอดมินได้ถูกต้อง',
    ],
  },
  {
    version: 'v1.10',
    date: '2026-06-03',
    title: 'ยกระดับมาตรฐาน PDPA, Accessibility และ TypeScript',
    tags: ['Compliance', 'Accessibility', 'TypeScript'],
    changes: [
      'เพิ่มระบบ Cookie Consent รองรับ PDPA',
      'ปรับการ์ดสินค้าให้ใช้คีย์บอร์ดเปิดดูสินค้าได้',
      'ปรับ TypeScript Types ในหน้า Admin ให้ชัดเจนขึ้น',
    ],
  },
  {
    version: 'v1.9',
    date: '2026-06-02',
    title: 'Phase 2 Optimization และ Privacy Quick Wins',
    tags: ['Optimization', 'Privacy', 'Clean up'],
    changes: [
      'ปรับปรุงประสิทธิภาพการดึงข้อมูล',
      'แก้ Memory Leak ของ Timer ในหน้าชำระเงิน',
      'ซ่อนรหัสผ่านในหน้าขอบคุณ',
      'ลบไฟล์ Dead Code เพื่อลดความซ้ำซ้อน',
    ],
  },
  {
    version: 'v1.8',
    date: '2026-06-02',
    title: 'ปรับโครงสร้างหน้าแอดมินและมาตรฐานข้อมูลค่าเงิน',
    tags: ['Refactor', 'Database', 'Critical Fix'],
    changes: [
      'แยกหน้า Admin ออกเป็น Component ย่อยเพื่อให้ดูแลง่ายขึ้น',
      'เปลี่ยนประเภทข้อมูลค่าเงินในฐานข้อมูลเป็น Decimal เพื่อลดความผิดพลาดของทศนิยม',
    ],
  },
  {
    version: 'v1.7',
    date: '2026-06-02',
    title: 'ปรับความโปร่งใสของข้อมูลและลิงก์ติดต่อ',
    tags: ['Clean up', 'UI', 'Trust'],
    changes: [
      'ลบหน้าติดตามออเดอร์ที่ซ้ำซ้อน',
      'ลบข้อมูล Recent Purchases จำลอง',
      'ปรับลิงก์ติดต่อให้ดึงค่าจาก Environment Variable',
    ],
  },
  {
    version: 'v1.6',
    date: '2026-06-02',
    title: 'เก็บกวาดความปลอดภัยและมาตรฐานสต็อก',
    tags: ['Bug Fix', 'Database', 'Security'],
    changes: [
      'เพิ่มระบบป้องกันการลบฐานข้อมูลใน Production',
      'แก้คำผิดในหน้าชำระเงิน',
      'ปรับมาตรฐานแจ้งเตือนสต็อกสินค้า',
      'ลบข้อมูลจำลองที่ซ้ำซ้อน',
    ],
  },
  {
    version: 'v1.5',
    date: '2026-06-02',
    title: 'ล็อกหน้าแอดมินและปกปิดข้อมูลระบบหลังบ้าน',
    tags: ['Security', 'Auth'],
    changes: [
      'ล็อก Middleware เพื่อป้องกันผู้ใช้ทั่วไปเข้าถึงหน้า Admin UI',
      'ปรับข้อความ Patch Notes ไม่ให้เปิดเผยรายละเอียดเส้นทางระบบหลังบ้าน',
    ],
  },
  {
    version: 'v1.4',
    date: '2026-06-02',
    title: 'เพิ่มระบบเข้ารหัสข้อมูลลับในฐานข้อมูล',
    tags: ['Security', 'Database'],
    changes: [
      'เพิ่มระบบเข้ารหัส AES-256 สำหรับข้อมูลสินค้าดิจิทัลและรหัสผ่านในฐานข้อมูล',
      'เพิ่มสคริปต์สำหรับเข้ารหัสข้อมูลลับเก่าที่เคยบันทึกไว้ก่อนเพิ่มระบบ Encryption',
    ],
  },
  {
    version: 'v1.3',
    date: '2026-06-02',
    title: 'ย้ายการคำนวณราคาไปฝั่ง Server',
    tags: ['Security', 'Backend'],
    changes: [
      'ย้ายการคำนวณราคาสินค้าและส่วนลดไปประมวลผลที่ Server-Side เพื่อป้องกันการปลอมแปลงราคา',
    ],
  },
  {
    version: 'v1.2',
    date: '2026-06-02',
    title: 'อัปเดตหน้าร้านเป็น Shop78it',
    tags: ['UI', 'Copywriting'],
    changes: [
      'เปลี่ยนชื่อร้านและข้อความหน้า Homepage เป็น Shop78it',
      'ปรับสถิติ รีวิว 5 ดาว 500+ และข้อความ Feature Bar',
      'ปรับไอคอนและข้อความให้เหมาะกับภาพลักษณ์ร้านมากขึ้น',
    ],
  },
  {
    version: 'v1.1',
    date: '2026-06-02',
    title: 'เพิ่มระบบ Patch Notes และปรับความปลอดภัยหน้าแอดมิน',
    tags: ['Feature', 'Security', 'Bug Fix'],
    changes: [
      'เพิ่มหน้า Patch Notes สำหรับบันทึกประวัติการอัปเดตระบบ',
      'อัปเดตความปลอดภัยเส้นทางระบบหลังบ้าน',
      'แก้บั๊กการนำทางจากโลโก้ให้ทำงานเสถียรขึ้น',
    ],
  },
]
