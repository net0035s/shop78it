import { supportContact } from '@/lib/support'
import { assertOrderingReady } from '@/lib/launch-readiness'
export function StoreAvailability() {
  if (process.env.APP_MODE === 'sandbox') return <div role="status" className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-300">
    เว็บทดลอง · ใช้ข้อมูลจำลอง · ไม่มีการรับเงินจริง
  </div>
  try { assertOrderingReady(); return null } catch { /* The storefront explains why checkout is unavailable. */ }
  return <div role="status" className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-300">
    ร้านกำลังเตรียมระบบ ยังไม่เปิดรับคำสั่งซื้อ · <a href={supportContact().href} className="underline">วิธีสั่งซื้อและติดต่อร้าน</a>
  </div>
}
