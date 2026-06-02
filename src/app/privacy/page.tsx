import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
      <Link href="/" className="text-sm text-textMuted hover:text-primary transition-colors">
        กลับหน้าหลัก
      </Link>

      <article className="prose prose-invert mt-8 max-w-none rounded-2xl border border-border/60 bg-surface/60 p-6 sm:p-8 text-textSecondary">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-textPrimary">
          นโยบายความเป็นส่วนตัว (PDPA)
        </h1>

        <p>
          เว็บไซต์มีการเก็บรวบรวมข้อมูลส่วนบุคคลเท่าที่จำเป็น เช่น อีเมล ประวัติการสั่งซื้อ
          และข้อมูลการใช้งานเว็บไซต์ เพื่อใช้ในการจัดส่งสินค้าดิจิทัล แจ้งเตือนสถานะออเดอร์
          และดูแลการให้บริการหลังการขาย
        </p>

        <h2 className="text-xl font-bold text-textPrimary">วัตถุประสงค์ในการใช้ข้อมูล</h2>
        <p>
          ข้อมูลของลูกค้าจะถูกใช้เพื่อยืนยันคำสั่งซื้อ จัดส่งสินค้า แจ้งเตือนสถานะออเดอร์
          ตรวจสอบปัญหาการใช้งาน และปรับปรุงประสบการณ์การใช้งานเว็บไซต์ให้ดียิ่งขึ้น
        </p>

        <h2 className="text-xl font-bold text-textPrimary">การเปิดเผยข้อมูล</h2>
        <p>
          เราจะไม่นำข้อมูลส่วนบุคคลของท่านไปขาย ให้เช่า หรือส่งต่อให้บุคคลที่สามโดยไม่ได้รับอนุญาต
          เว้นแต่เป็นกรณีที่จำเป็นตามกฎหมาย หรือจำเป็นต่อการให้บริการตามคำสั่งซื้อของท่าน
        </p>

        <h2 className="text-xl font-bold text-textPrimary">คุกกี้ (Cookies)</h2>
        <p>
          ระบบอาจใช้คุกกี้เพื่อจดจำการใช้งานบางอย่าง เช่น ตะกร้าสินค้า การตั้งค่าหน้าเว็บ
          และข้อมูลที่ช่วยพัฒนาประสบการณ์การใช้งานของลูกค้า
        </p>
      </article>
    </div>
  )
}
