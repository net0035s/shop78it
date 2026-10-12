import Link from 'next/link'

export default function RefundPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
      <Link href="/" className="text-sm text-textMuted hover:text-primary transition-colors">
        กลับหน้าหลัก
      </Link>

      <article className="prose prose-invert mt-8 max-w-none rounded-2xl border border-border/60 bg-surface/60 p-6 sm:p-8 text-textSecondary">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-textPrimary">
          นโยบายการเปลี่ยนและการคืนเงิน
        </h1>

        <p>
          เนื่องจากสินค้าของเราเป็นประเภทสินค้านามธรรม (Digital Goods) เช่น รหัสซอฟต์แวร์
          และบัญชีระบบสมาชิก (Subscriptions) กรุณาตรวจรายละเอียดและเงื่อนไขก่อนซื้อ
          เมื่อจัดส่งแล้ว กรณีเปลี่ยนใจจะพิจารณาตามเงื่อนไขสินค้า ส่วนสินค้าที่ใช้ไม่ได้ จัดส่งผิด หรือชำระเงินผิดพลาด สามารถแจ้งตรวจสอบได้ตามขั้นตอนด้านล่าง
        </p>

        <h2 className="text-xl font-bold text-textPrimary">กรณีที่สามารถแจ้งตรวจสอบได้</h2>
        <ol>
          <li>รหัสสินค้า (Key) หรือบัญชีไม่สามารถใช้งานได้จริงตามที่ระบุ</li>
          <li>เกิดข้อผิดพลาดจากระบบของเว็บไซต์ทำให้จัดส่งสินค้าผิดพลาด</li>
        </ol>

        <h2 className="text-xl font-bold text-textPrimary">การแจ้งเคลม</h2>
        <p>
          หากพบปัญหา ลูกค้าสามารถติดต่อแจ้งเคลมพร้อมแนบหลักฐาน เช่น Order ID และภาพหน้าจอ
          ภายใน 7 วันหลังจากการสั่งซื้อ ทางเราจะตรวจสอบและพิจารณาออกสินค้าทดแทน
          หรือคืนเงินเป็นกรณีไป
        </p>

        <h2 className="text-xl font-bold text-textPrimary">จ่ายแล้วไม่ได้สินค้า ยอดขาด หรือยอดเกิน</h2>
        <p>อย่าชำระซ้ำจนกว่าร้านตรวจผลรับเงิน แจ้งหมายเลขออเดอร์ ช่องทางชำระ และหลักฐานผ่านช่องทางส่วนตัว ร้านจะตรวจและแจ้งวิธีดำเนินการหรือคืนเงินเป็นกรณีไป ไม่มีการโอนคืนอัตโนมัติจากหน้าเว็บ</p>
        <Link href="/help" className="text-primary">วิธีติดต่อร้านและติดตามออเดอร์</Link>

        <p className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-4 text-orange-300">
          กรุณาเก็บหลักฐานการสั่งซื้อและภาพหน้าจอปัญหาไว้ให้ครบถ้วน เพื่อให้ทีมงานตรวจสอบได้รวดเร็วขึ้น
        </p>
      </article>
    </div>
  )
}
