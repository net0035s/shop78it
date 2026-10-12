'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useOrderStore } from '@/store/orderStore'
import { formatPrice } from '@/lib/products'
import type { OrderSummary } from '@/types'

const statuses: Record<string,string> = { refunded: 'ร้านบันทึกคืนเงินเต็มยอดแล้ว — ติดต่อร้านเพื่อดูหลักฐาน', pending: 'รอชำระเงิน', payment_processing: 'กำลังตรวจสอบการชำระเงิน — ห้ามชำระซ้ำ', payment_review: 'รอร้านค้าตรวจผลชำระเงิน — ห้ามชำระซ้ำ', paid: 'รับเงินแล้ว กำลังจัดส่ง', needs_manual_delivery: 'รับเงินแล้ว รอร้านค้าจัดส่งส่วนที่เหลือ', completed: 'จัดส่งครบแล้ว', cancelled: 'ยกเลิกออเดอร์' }
type TrackingSummary = Pick<OrderSummary, 'orderNumber' | 'status' | 'total'> & { items: { orderItemId: string; name: string; quantity: number; unitPrice: number }[] }
function receipt(order: OrderSummary): TrackingSummary {
  return { orderNumber: order.orderNumber, status: order.status, total: order.total, items: order.items.map(item => ({ orderItemId: item.orderItemId || item.product.id, name: item.product.name, quantity: item.quantity, unitPrice: item.product.price })) }
}
export default function TrackPage() {
  const { orderHistory, currentOrderNumber, setOrder, addOrderToHistory } = useOrderStore()
  const [number, setNumber] = useState(''), [email, setEmail] = useState('')
  const [order, setResult] = useState<TrackingSummary | null>(null), [authorized, setAuthorized] = useState(false)
  const [emailAvailable, setEmailAvailable] = useState(true)
  const [lookup, setLookup] = useState<{number: string; email: string} | null>(null)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [needsAccess, setNeedsAccess] = useState(false)
  const [mounted, setMounted] = useState(false)
  const exchangeStarted = useRef(false), requestVersion = useRef(0), refreshing = useRef(false)
  const search = useCallback(async (value: string, lookupEmail = email, background = false) => {
    if (background && refreshing.current) return
    if (background) refreshing.current = true
    const version = ++requestVersion.current, normalized = value.trim().toUpperCase()
    if (!background) { setBusy(true); setError(''); setNotice(''); setResult(null); setNeedsAccess(false); setAuthorized(false); setLookup(null); setNumber(normalized) }
    try {
      let result = await (await fetch('/api/orders?orderNumber=' + encodeURIComponent(normalized), { cache: 'no-store' })).json()
      if (version !== requestVersion.current) return
      const hasAccess = result.success === true
      if (!hasAccess && result.code === 'ORDER_ACCESS_REQUIRED') {
        if (!lookupEmail.trim()) { setNeedsAccess(true); setAuthorized(false); setError('กรอกอีเมลที่ใช้สั่งซื้อเพื่อดูสถานะและรายการสินค้า'); return }
        result = await (await fetch('/api/orders/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ orderNumber: normalized, email: lookupEmail.trim() }) })).json()
      }
      if (version !== requestVersion.current) return
      if (!result.success) { setError(result.error); return }
      setResult(hasAccess ? receipt(result.data) : result.data)
      setAuthorized(hasAccess); setNeedsAccess(false); setError('')
      if (!hasAccess) setEmailAvailable(result.accessEmailAvailable === true)
      setLookup(previous => previous?.number === normalized && previous.email === lookupEmail.trim() ? previous : { number: normalized, email: lookupEmail.trim() })
      addOrderToHistory(result.data.orderNumber)
      if (hasAccess) setOrder(result.data)
    } catch { if (version === requestVersion.current) setError('เชื่อมต่อไม่ได้ กรุณาลองใหม่') }
    finally { if (background) refreshing.current = false; if (version === requestVersion.current) setBusy(false) }
  }, [email, setOrder, addOrderToHistory])
  useEffect(() => { const version = requestVersion; setMounted(true); return () => { version.current++ } }, [])
  useEffect(() => {
    if (!lookup) return
    const refresh = () => { if (document.visibilityState === 'visible') void search(lookup.number, lookup.email, true) }
    const timer = window.setInterval(refresh, 10000)
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [lookup, search])
  useEffect(() => {
    if (!mounted || exchangeStarted.current) return
    const token = new URLSearchParams(window.location.hash.slice(1)).get('access')
    if (!token) return
    exchangeStarted.current = true
    window.history.replaceState(null, '', window.location.pathname)
    setBusy(true)
    fetch('/api/orders/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).then(r => r.json()).then(result => {
      if (!result.success) { setError(result.error); return }
      void search(result.data.orderNumber)
    }).catch(() => setError('ยืนยันลิงก์ไม่ได้ กรุณาขอลิงก์ใหม่')).finally(() => setBusy(false))
  }, [mounted, search])
  const sendLink = async () => {
    setBusy(true); setError('')
    try {
      const result = await (await fetch('/api/orders/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNumber: order?.orderNumber || number, email: lookup?.email || email }) })).json()
      if (!result.success) setError(result.error); else setNotice(result.message)
    } catch { setError('ขอลิงก์ไม่สำเร็จ กรุณาลองอีกครั้ง') }
    finally { setBusy(false) }
  }
  return <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
    <h1 className="text-3xl font-bold">ติดตามและรับสินค้า</h1>
    <p className="text-textMuted">กรอกเลขออเดอร์และอีเมลเพื่อดูสถานะและรายการสินค้าได้ทันที ข้อมูลจัดส่งเปิดได้จากเครื่องที่ซื้อหรือหลังยืนยันอีเมล</p>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void search(number) }}>
      <label htmlFor="track-number" className="block">หมายเลขออเดอร์</label>
      <input id="track-number" value={number} onChange={e => setNumber(e.target.value)} required maxLength={100} className="w-full rounded-xl border border-border bg-surfaceLight p-3" placeholder="SA-..." />
      <label htmlFor="track-email" className="block">อีเมลที่ใช้สั่งซื้อ</label>
      <input id="track-email" type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} className="w-full rounded-xl border border-border bg-surfaceLight p-3" placeholder="กรอกอีเมลเมื่อค้นหาจากเครื่องอื่น" />
      <button disabled={busy || !number.trim()} className="rounded-xl bg-primary px-5 py-3 text-white disabled:opacity-50">{busy ? 'กำลังตรวจสอบ…' : 'ค้นหาออเดอร์'}</button>
    </form>
    {error && <p role="alert" className="text-rose-400">{error}</p>}
    {notice && <p role="status" className="text-emerald-400">{notice}</p>}
    {order && <section className="rounded-2xl border border-border p-5 space-y-4">
      <h2 className="font-mono break-all font-bold">{order.orderNumber}</h2><p role="status" className="text-primary font-bold">{statuses[order.status] || 'กำลังดำเนินการ'}</p>
      <p>ยอดสุทธิ {formatPrice(order.total)}</p>
      <ul className="space-y-2">{order.items.map(item => <li key={item.orderItemId}>{item.name} × {item.quantity} — {formatPrice(item.unitPrice * item.quantity)}</li>)}</ul>
      {authorized && order.status === 'pending' && <Link href={'/checkout?order=' + encodeURIComponent(order.orderNumber)} className="block text-primary">ชำระบิลนี้ต่อ</Link>}
      {authorized && ['completed', 'needs_manual_delivery', 'paid'].includes(order.status) && <Link href="/thank-you" className="block text-primary">เปิดข้อมูลสินค้าที่ได้รับ</Link>}
      <p className="text-textMuted text-sm">อัปเดตสถานะอัตโนมัติทุก 10 วินาทีขณะเปิดหน้านี้</p>
      <button onClick={() => void search(order.orderNumber, lookup?.email || email)} disabled={busy} className="text-primary">อัปเดตสถานะ</button>
    </section>}
    {(needsAccess || (order && !authorized && ['paid', 'completed', 'needs_manual_delivery'].includes(order.status))) && <section className="space-y-3 p-5 rounded-xl border border-border">
      <p>คีย์สินค้า รหัสผ่าน และข้อความจัดส่งต้องยืนยันสิทธิ์เพิ่มเติม หากเปิดจากเครื่องที่ซื้อจะรับสินค้าได้ทันที</p>
      {emailAvailable ? <button onClick={() => void sendLink()} disabled={busy || !email.trim()} className="text-primary">ส่งลิงก์ยืนยันเพื่อเปิดข้อมูลจัดส่ง</button>
        : <p className="text-textMuted">เว็บทดสอบยังปิดการส่งอีเมล กรุณาเปิดข้อมูลจัดส่งจากหน้าออเดอร์ในเครื่องที่ซื้อ</p>}
    </section>}
    {mounted && !order && <section className="space-y-3"><h2 className="font-bold">ออเดอร์ล่าสุดในเครื่องนี้</h2>{Array.from(new Set([currentOrderNumber, ...orderHistory].filter(Boolean))).map(id => <button key={id} onClick={() => void search(id!)} className="block w-full text-left rounded-xl border border-border bg-surface p-3 font-mono break-all">{id}</button>)}</section>}
  </div>
}
