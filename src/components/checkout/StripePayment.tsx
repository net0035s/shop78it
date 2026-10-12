'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CreditCard, Loader2 } from 'lucide-react'
import type { OrderSummary } from '@/types'

export default function StripePayment({ order, onChange, onBusyChange }: { order: OrderSummary; onChange: (order: OrderSummary) => void; onBusyChange: (busy: boolean) => void }) {
  const [configuration, setConfiguration] = useState<{ enabled: boolean; testMode: boolean } | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const callbacks = useRef({ onChange, onBusyChange }); callbacks.current = { onChange, onBusyChange }
  const inFlight = useRef(false)
  const locked = ['payment_processing', 'payment_review'].includes(order.status)
  const request = useCallback(async (action: 'checkout' | 'status' | 'cancel', automatic = false) => {
    if (inFlight.current) return
    inFlight.current = true
    if (!automatic) { setBusy(true); callbacks.current.onBusyChange(true); setError('') }
    try {
      const path = '/api/payment/stripe' + (action === 'checkout' ? '' : '/' + action)
      const result = await (await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNumber: order.orderNumber }) })).json()
      if (!result.success) throw new Error(result.error || 'ตรวจผล Stripe ไม่สำเร็จ')
      callbacks.current.onChange(result.data.order)
      if (!automatic) setError('')
      if (action === 'checkout' && result.data.url) {
        const url = new URL(result.data.url)
        if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('ลิงก์ชำระไม่ถูกต้อง')
        window.location.assign(url.toString())
      }
    } catch (failure) {
      if (!automatic) setError(failure instanceof Error ? failure.message : 'ตรวจสถานะก่อนชำระซ้ำ')
      // A network error may follow a successful provider request. Refresh the server's order lock.
      try {
        const result = await (await fetch('/api/orders?orderNumber=' + encodeURIComponent(order.orderNumber), { cache: 'no-store' })).json()
        if (result.success) callbacks.current.onChange(result.data)
      } catch { /* Keep the current lock and ask the buyer to retry status. */ }
    } finally {
      inFlight.current = false
      if (!automatic) { setBusy(false); callbacks.current.onBusyChange(false) }
    }
  }, [order.orderNumber])
  useEffect(() => {
    let cancelled = false
    fetch('/api/payment/stripe').then(r => r.json()).then(result => { if (!cancelled && result.success) setConfiguration(result.data) }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!locked) return
    void request('status', true)
    const timer = window.setInterval(() => void request('status', true), 10000)
    return () => window.clearInterval(timer)
  }, [locked, request])
  return <section className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
    <h3 className="flex items-center gap-2 font-bold"><CreditCard className="h-5 w-5 text-primary" />บัตร / PromptPay ผ่าน Stripe</h3>
    <p className="text-sm leading-relaxed text-textMuted">กรอกข้อมูลบัตรหรือสแกน QR บนหน้าชำระของ Stripe ระบบตรวจผลก่อนจัดส่งสินค้า ไม่ต้องอัปโหลดสลิป</p>
    {configuration?.testMode && <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-300">โหมดทดสอบ ใช้บัตรหรือขั้นตอนทดสอบของ Stripe เท่านั้น</p>}
    {configuration && !configuration.enabled && <p className="text-sm text-textMuted">Stripe ยังไม่พร้อมชำระเงิน กรุณาติดต่อร้านค้า</p>}
    {locked && <p className="text-sm text-textMuted">มีรายการ Stripe ค้างอยู่ กรุณาตรวจสถานะหรือชำระรายการเดิมต่อ ก่อนเปลี่ยนช่องทาง</p>}
    {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
    <button type="button" disabled={busy || !configuration?.enabled || (!locked && order.status !== 'pending')} onClick={() => void request('checkout')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-gradient px-4 py-3 font-bold text-white disabled:opacity-50">
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}{locked ? 'ชำระรายการ Stripe เดิมต่อ' : 'ไปชำระผ่าน Stripe'}
    </button>
    {locked && <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={() => void request('status')} className="rounded-xl border border-border px-4 py-2 text-sm">ตรวจสถานะการชำระ</button>
      <button type="button" disabled={busy} onClick={() => void request('cancel')} className="rounded-xl border border-border px-4 py-2 text-sm">ปิดรายการ Stripe เพื่อเปลี่ยนช่องทาง</button>
    </div>}
  </section>
}
