import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
      <Link href="/" className="text-sm text-textMuted hover:text-primary transition-colors">
        กลับหน้าหลัก
      </Link>

      <article className="prose prose-invert mt-8 max-w-none rounded-2xl border border-border/60 bg-surface/60 p-6 sm:p-8 text-textSecondary">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-textPrimary">
          ข้อตกลงและเงื่อนไขการใช้บริการ
        </h1>

        <p>
          เว็บไซต์นี้ให้บริการจำหน่ายรหัสสินค้าดิจิทัล บัญชีซอฟต์แวร์ และบริการที่เกี่ยวข้องกับสินค้าดิจิทัล
          การสั่งซื้อสินค้าผ่านเว็บไซต์นี้ถือว่าผู้ซื้อได้อ่าน เข้าใจ และยอมรับข้อตกลงและเงื่อนไขทั้งหมดแล้ว
        </p>

        <h2 className="text-xl font-bold text-textPrimary">การจัดส่งสินค้า</h2>
        <p>
          รหัสผ่าน คีย์สินค้า รายละเอียดบัญชี หรือข้อมูลการจัดส่งอื่น ๆ จะถูกจัดส่งให้ลูกค้าผ่านทางอีเมล
          และ/หรือแสดงบนหน้าเว็บไซต์หลังจากระบบตรวจสอบการชำระเงินเรียบร้อยแล้ว
        </p>

        <h2 className="text-xl font-bold text-textPrimary">ความรับผิดชอบของผู้ซื้อ</h2>
        <p>
          ผู้ซื้อต้องเก็บรักษาข้อมูลการเข้าถึง เช่น รหัสผ่าน คีย์สินค้า และรายละเอียดบัญชี ไว้เป็นความลับ
          และไม่ควรส่งต่อข้อมูลดังกล่าวให้บุคคลอื่นโดยไม่จำเป็น
        </p>

        <h2 className="text-xl font-bold text-textPrimary">ข้อห้ามในการใช้งาน</h2>
        <p>
          ห้ามนำสินค้า บัญชี หรือรหัสที่ได้รับจากเว็บไซต์นี้ไปใช้ในทางที่ผิดกฎหมาย ละเมิดสิทธิ์ของผู้อื่น
          หรือใช้งานในลักษณะที่ขัดต่อข้อกำหนดของผู้ให้บริการต้นทาง
        </p>
      </article>
    </div>
  )
}
