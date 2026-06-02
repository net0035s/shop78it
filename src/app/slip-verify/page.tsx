import { ScanLine, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ตรวจสอบสลิป — ShopAuto 24/7',
  description: 'อัปโหลดสลิปการโอนเงินเพื่อยืนยันการสั่งซื้ออัตโนมัติ',
}

/**
 * TODO (Phase 2):
 * - อัปโหลดรูปสลิปการโอนเงิน (drag & drop / camera)
 * - ส่งไปตรวจสอบผ่าน POST /api/slip
 * - แสดงผลการตรวจสอบ (ยอดเงิน, เวลา, ผู้โอน)
 * - หากผ่าน → อัปเดตสถานะ Order → ส่งสินค้าอัตโนมัติ
 * - Integration กับ EasySlip API / SlipOK API
 * - แจ้งเตือนผ่าน LINE Notify หากมีปัญหา
 */
export default function SlipVerifyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <Link
        href="/checkout"
        className="inline-flex items-center gap-2 text-textMuted hover:text-primary transition-colors text-sm mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        กลับหน้าชำระเงิน
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <ScanLine className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-textPrimary">ตรวจสอบสลิป</h1>
      </div>

      {/* Upload area placeholder */}
      <div className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 transition-colors p-12 text-center bg-surfaceLight/30">
        <ScanLine className="w-16 h-16 text-textMuted mx-auto mb-4 opacity-30" />
        <h2 className="text-textSecondary font-semibold mb-2">อัปโหลดสลิปการโอนเงิน</h2>
        <p className="text-textMuted text-sm mb-4 max-w-sm mx-auto">
          ระบบจะตรวจสอบสลิปอัตโนมัติและยืนยันออเดอร์ภายในไม่กี่วินาที
          (จะพัฒนาใน Phase 2)
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-xs border border-primary/20">
          <ScanLine className="w-3.5 h-3.5" />
          รองรับ EasySlip API / SlipOK
        </div>
      </div>

      {/* Info boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {[
          { emoji: '⚡', title: 'ตรวจสอบทันที', desc: 'AI อ่านสลิปอัตโนมัติ ใช้เวลาไม่ถึง 3 วินาที' },
          { emoji: '🔒', title: 'ปลอดภัย 100%', desc: 'ข้อมูลสลิปถูกเข้ารหัส ไม่เก็บถาวร' },
        ].map(({ emoji, title, desc }) => (
          <div key={title} className="p-4 rounded-xl bg-surfaceLight border border-border">
            <div className="text-2xl mb-2">{emoji}</div>
            <h3 className="text-textPrimary font-semibold text-sm mb-1">{title}</h3>
            <p className="text-textMuted text-xs">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
