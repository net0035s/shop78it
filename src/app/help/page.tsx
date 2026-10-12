import Link from 'next/link'
import { supportContact } from '@/lib/support'
export default function HelpPage() {
  const contact = supportContact()
  return <div className="max-w-3xl mx-auto px-4 py-16 space-y-8">
    <Link href="/" className="text-primary">กลับหน้าร้าน</Link>
    <h1 className="text-3xl font-bold">วิธีสั่งซื้อ รับสินค้า และติดต่อร้าน</h1>
    <section className="rounded-2xl border border-border bg-surface/60 p-6 space-y-4">
      <h2 className="text-xl font-bold">สั่งซื้อและชำระเงิน</h2>
      <p>เลือกสินค้า ตรวจรายละเอียดและชนิดการจัดส่ง ใส่ตะกร้า แล้วกรอกอีเมลที่ใช้งานได้จริง เก็บหมายเลขออเดอร์ไว้สำหรับติดตาม</p>
      <p>บิลมีอายุ 60 นาที ชำระตามยอดที่หน้าออเดอร์แสดง รวมสตางค์ หากหมดเวลาให้สร้างบิลใหม่ หากสถานะกำลังตรวจเงินหรือรอตรวจสอบ กรุณารอและติดต่อร้านก่อนชำระซ้ำ</p>
      <h2 className="text-xl font-bold">รับสินค้า</h2>
      <p>สินค้าอัตโนมัติแสดงข้อมูลรับสินค้าหลังยืนยันยอดชำระ สินค้าที่ร้านจัดส่งเองจะขึ้นสถานะรอดำเนินการ โปรดตรวจเวลาจัดส่งและเงื่อนไขของสินค้าก่อนสั่งซื้อ</p>
      <p>เมื่อกลับมาอีกครั้งหรือเปลี่ยนอุปกรณ์ ใช้เลขออเดอร์และอีเมลเดิมที่หน้าติดตาม ระบบส่งลิงก์ยืนยันใช้ได้ครั้งเดียวภายใน 15 นาที กรุณาตรวจกล่องสแปมด้วย และอย่าส่งต่อลิงก์หรือข้อมูลสินค้า</p>
      <Link href="/track" className="inline-block text-primary">ติดตามออเดอร์และรับสินค้า</Link>
    </section>
    <section className="rounded-2xl border border-border bg-surface/60 p-6 space-y-3">
      <h2 className="text-xl font-bold">พบปัญหาหรือยอดชำระไม่ตรง</h2>
      <p>แจ้งหมายเลขออเดอร์ ช่องทางและเวลาชำระ พร้อมหลักฐานที่จำเป็นผ่านช่องทางส่วนตัวของร้าน หลีกเลี่ยงการโพสต์คีย์ รหัสผ่าน หรือข้อมูลบัญชีต่อสาธารณะ</p>
      <p>หากจ่ายแล้วแต่ยังไม่ได้สินค้า ให้ติดตามสถานะและติดต่อร้านก่อนจ่ายใหม่ กรณียอดขาด ยอดเกิน หรือขอคืนเงิน ร้านจะตรวจหลักฐานและแจ้งผลให้ทราบ ระบบไม่ได้โอนคืนให้อัตโนมัติ</p>
      <Link href="/refund" className="inline-block text-primary">อ่านนโยบายเปลี่ยนสินค้าและคืนเงิน</Link>
    </section>
    <section className="rounded-2xl border border-border bg-surface/60 p-6 space-y-3">
      <h2 className="text-xl font-bold">ติดต่อร้าน</h2>
      {contact.lineUrl && <a href={contact.lineUrl} target="_blank" rel="noopener noreferrer" className="block text-primary">ติดต่อผ่าน LINE</a>}
      {contact.emailAddress && <a href={'mailto:' + contact.emailAddress} className="block text-primary">{contact.emailAddress}</a>}
      {!contact.lineUrl && !contact.emailAddress && <p>ร้านกำลังเตรียมช่องทางช่วยเหลือ กรุณากลับมาตรวจอีกครั้งก่อนสั่งซื้อ</p>}
      <p className="text-sm text-textMuted">เวลาตอบและเวลาจัดส่งให้ยึดตามที่ร้านแจ้งไว้ในรายละเอียดสินค้าหรือช่องทางติดต่อ</p>
    </section>
  </div>
}
