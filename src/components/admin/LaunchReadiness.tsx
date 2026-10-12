'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ReadinessCheck } from '@/lib/launch-readiness'

type Operations = Record<string, number>
const operationLabels: Record<string, string> = {
  reviewPayments: 'ออเดอร์ที่ต้องตรวจผลรับเงิน', stalledPayments: 'การตรวจรับเงินค้างเกิน 5 นาที',
  paidAwaitingDelivery: 'รับเงินแล้วแต่ยังรอจัดส่ง', manualDelivery: 'รอร้านจัดส่ง',
  expiredReservations: 'ออเดอร์หมดอายุรอคืนสต็อก', failedNotifications: 'ข้อความที่ลองส่งครบแล้วแต่ไม่สำเร็จ',
  stuckNotifications: 'งานส่งข้อความค้าง',
}
export function LaunchReadiness() {
  const [data, setData] = useState<{ checks: ReadinessCheck[]; operations: Operations | null; ordersEnabled: boolean; paymentsEnabled: boolean } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function refresh() {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/admin/readiness', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok || !body.success) throw new Error()
      setData(body.data)
    } catch { setError('ตรวจสถานะไม่สำเร็จ กรุณาลองใหม่') } finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  return <section className="rounded-2xl border border-border bg-surface/60 p-5 space-y-4">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-bold text-textPrimary">ความพร้อมเปิดร้านและงานที่ต้องดูแล</h2>
      <button type="button" disabled={loading} onClick={refresh} className="text-sm text-primary disabled:opacity-50">{loading ? 'กำลังตรวจ…' : 'ตรวจอีกครั้ง'}</button>
    </div>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {data && <>
      <p className="text-sm text-textMuted">รับออเดอร์: {data.ordersEnabled ? 'เปิด' : 'ปิด'} · รับชำระเงิน: {data.paymentsEnabled ? 'เปิด' : 'ปิด'} · ผลตั้งค่าเพียงอย่างเดียวยังไม่ยืนยันว่าพร้อมขายจริง</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.checks.map(check => <li key={check.id} className="rounded-xl bg-surfaceLight/40 p-3">
          <p className="text-sm font-semibold">{check.label} <span className={check.status === 'pass' ? 'text-emerald-400' : 'text-amber-400'}>{check.status === 'pass' ? '✓' : check.status === 'pending' ? 'รอตรวจ' : 'ต้องแก้'}</span></p>
          <p className="mt-1 text-xs text-textMuted">{check.detail}</p>
        </li>)}
      </ul>
      {data.operations && <div className="space-y-2">
        {Object.entries(data.operations).filter(([, count]) => count > 0).map(([key, count]) =>
          <p key={key} className="text-sm text-amber-400">{operationLabels[key]}: {count} รายการ</p>)}
        {Object.values(data.operations).every(count => count === 0) && <p className="text-sm text-emerald-400">ยังไม่พบงานค้างจากการตรวจครั้งนี้</p>}
        <Link href="/admin11" className="inline-block text-sm text-primary">จัดการในรายการออเดอร์</Link>
      </div>}
    </>}
  </section>
}
