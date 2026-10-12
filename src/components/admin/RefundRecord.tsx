'use client'
import { useState } from 'react'
import { formatPrice } from '@/lib/products'
type Order = { id: string; total: number; status: string; auditEvents?: Array<{ id: string; action: string; createdAt: string; note: string | null }> }
export function RefundRecord({ order, onUpdated }: { order: Order; onUpdated: () => void }) {
  const [reference, setReference] = useState(''), [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const records = order.auditEvents?.filter(event => event.action === 'external_refund_recorded') || []
  if (order.status === 'refunded') return <div className="rounded-xl border border-border p-3 space-y-2"><p className="font-bold">ร้านบันทึกคืนเงินเต็มยอดแล้ว</p>{records.map(event => {
    let details: { amount?: number; reference?: string; reason?: string } = {}
    try { details = JSON.parse(event.note || '{}') } catch { /* Keep private audit data out of raw UI output. */ }
    return <div key={event.id} className="text-sm space-y-1 break-words">
      <p>ยอดคืน: {formatPrice(typeof details.amount === 'number' ? details.amount : order.total)}</p>
      {typeof details.reference === 'string' && <p>เลขอ้างอิง: {details.reference}</p>}
      {typeof details.reason === 'string' && <p>เหตุผลและหลักฐาน: {details.reason}</p>}
      <p className="text-textMuted">บันทึกเมื่อ {new Date(event.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</p>
    </div>
  })}</div>
  if (!['paid','completed','needs_manual_delivery'].includes(order.status) || order.total <= 0) return null
  async function save() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/orders/' + order.id + '/refund', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: order.total, reference, reason, confirmExternalRefund: confirmed }) })
      const body = await response.json()
      if (!response.ok || !body.success) throw new Error(body.error || 'บันทึกไม่สำเร็จ')
      onUpdated()
    } catch (error) { setError(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ') } finally { setBusy(false) }
  }
  return <div className="rounded-xl border border-amber-500/30 p-3 space-y-3">
    <p className="font-bold">บันทึกการคืนเงินเต็มยอดที่ทำแล้ว</p>
    <p className="text-sm text-textMuted">คืนเงินผ่านช่องทางที่ร้านตรวจยืนยันก่อน แล้วบันทึกหลักฐานที่นี่ ยอด {formatPrice(order.total)} ปุ่มนี้บันทึกประวัติและปิดการจัดส่งต่อ ไม่ได้สั่งโอนเงิน สินค้าที่เปิดเผยแล้วจะไม่กลับเข้าสต็อกอัตโนมัติ</p>
    <label className="block text-sm">เลขอ้างอิงคืนเงิน<input value={reference} onChange={event => setReference(event.target.value)} maxLength={240} className="block w-full bg-surface p-2 rounded" /></label>
    <label className="block text-sm">เหตุผลและหลักฐาน<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} className="block w-full bg-surface p-2 rounded" /></label>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />ตรวจแล้วว่าได้คืนเงินเต็มยอดให้ลูกค้าภายนอกระบบเรียบร้อย</label>
    <button type="button" disabled={busy || !confirmed || !reference.trim() || !reason.trim()} onClick={save} className="rounded bg-amber-500/20 px-3 py-2 disabled:opacity-40">{busy ? 'กำลังบันทึก…' : 'บันทึกคืนเงินที่ทำแล้ว'}</button>
    {error && <p role="alert" className="text-red-400">{error}</p>}
  </div>
}
