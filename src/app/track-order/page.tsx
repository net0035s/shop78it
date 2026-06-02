'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, History, ArrowRight, ShieldCheck, FileText, Key, Calendar, Mail, CornerDownRight, Loader2 } from 'lucide-react'
import { useOrderStore } from '@/store/orderStore'
import { formatPrice } from '@/lib/products'
import { formatDateWithTime } from '@/lib/utils'
import Link from 'next/link'

export default function TrackOrderPage() {
  const router = useRouter()
  const { setOrder } = useOrderStore()
  
  const [mounted, setMounted] = useState(false)
  const [orderNumberInput, setOrderNumberInput] = useState('')
  const [pastOrders, setPastOrders] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Load guest orders from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem('shopauto-guest-orders')
      if (stored) {
        const orders = JSON.parse(stored)
        setPastOrders(orders)
        
        // Background sync statuses for past orders
        if (orders.length > 0) {
          Promise.all(
            orders.map((o: any) =>
              fetch(`/api/orders?orderNumber=${o.orderNumber}`)
                .then(res => res.json())
                .then(res => res.success && res.data ? res.data : null)
                .catch(() => null)
            )
          ).then(results => {
            let changed = false
            const updatedOrders = orders.map((o: any, idx: number) => {
              const freshData = results[idx]
              if (freshData && freshData.status !== o.status) {
                changed = true
                return { ...o, status: freshData.status }
              }
              return o
            })
            if (changed) {
              localStorage.setItem('shopauto-guest-orders', JSON.stringify(updatedOrders))
              setPastOrders(updatedOrders)
            }
          })
        }
      }
    } catch (err) {
      console.error('Failed to load guest orders from history:', err)
    }
  }, [])

  if (!mounted) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-textMuted">กำลังโหลดหน้าประวัติการสั่งซื้อ...</p>
        </div>
      </div>
    )
  }

  const handleSearchOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setSearchError('')
    
    const query = orderNumberInput.trim()
    if (!query) {
      setSearchError('กรุณากรอกเลขที่ใบสั่งซื้อ (Order Number)')
      return
    }

    if (!query.startsWith('SA-')) {
      setSearchError('รูปแบบเลขใบสั่งซื้อไม่ถูกต้อง (ตัวอย่าง: SA-XXXXXXXX-XXXX)')
      return
    }

    setIsSearching(true)
    try {
      // Fetch order details from the server-side API
      const response = await fetch(`/api/orders?orderNumber=${query}`)
      const result = await response.json()

      if (result.success && result.data) {
        const foundOrder = result.data
        
        // 1. Add order to localStorage history list if not already present
        const stored = localStorage.getItem('shopauto-guest-orders')
        const orders = stored ? JSON.parse(stored) : []
        const isDuplicate = orders.some((o: any) => o.orderNumber === foundOrder.orderNumber)
        
        if (!isDuplicate) {
          const updated = [foundOrder, ...orders].slice(0, 50)
          localStorage.setItem('shopauto-guest-orders', JSON.stringify(updated))
          setPastOrders(updated)
        }

        // 2. Set this order as active in client Zustand store
        setOrder(foundOrder)

        // 3. Redirect user to Thank You page
        router.push('/thank-you')
      } else {
        setSearchError(result.error || 'ไม่พบออเดอร์นี้ในฐานข้อมูลระบบ กรุณาตรวจสอบรหัสให้ถูกต้อง')
      }
    } catch (err) {
      console.error('Error fetching order from server:', err)
      setSearchError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsSearching(false)
    }
  }

  const handleViewOrderDetails = (order: any) => {
    setOrder(order)
    router.push('/thank-you')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <div className="flex flex-col gap-2 mb-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-textPrimary tracking-tight">
          ติดตามออเดอร์ & ประวัติการสั่งซื้อ
        </h1>
        <p className="text-sm text-textMuted">
          ค้นหาคีย์ดิจิทัลหรือตรวจสอบประวัติออเดอร์ของคุณง่ายๆ โดยไม่ต้องสมัครสมาชิก
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* Upper Card: Search bar */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-textPrimary flex items-center gap-2">
                <Search className="w-4.5 h-4.5 text-primary" />
                ค้นหาด่วนด้วยหมายเลขออเดอร์
              </h2>
              <p className="text-xs text-textMuted mt-0.5">
                ป้อนรหัสออเดอร์เพื่อดึงคีย์สินค้าหรือบัญชีของคุณโดยตรงจากระบบฐานข้อมูลเซิร์ฟเวอร์
              </p>
            </div>

            <form onSubmit={handleSearchOrder} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-textMuted tracking-wider">
                  SA-
                </span>
                <input
                  type="text"
                  placeholder="ป้อนรหัสสั่งซื้อที่นี่ (ตัวอย่าง: SA-K8A9J2LZ-991A)"
                  value={orderNumberInput.replace(/^SA-/i, '')}
                  onChange={(e) => setOrderNumberInput(`SA-${e.target.value.toUpperCase()}`)}
                  className="w-full pl-11 pr-4 py-3 bg-surfaceLight/50 border border-border rounded-xl text-sm font-mono text-textPrimary placeholder:text-textMuted tracking-wider focus:outline-none focus:border-primary/60 transition-colors uppercase"
                  disabled={isSearching}
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-6 py-3 rounded-xl bg-primary-gradient hover:opacity-90 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-sm tracking-wide shadow-md flex items-center justify-center gap-2 shrink-0 transition-all btn-glow"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังค้นหา...
                  </>
                ) : (
                  <>
                    ค้นหาออเดอร์
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
            {searchError && (
              <p className="text-xs text-red-500 font-medium px-1 flex items-center gap-1">
                ⚠️ {searchError}
              </p>
            )}
          </div>
        </div>

        {/* Lower Section: Past Orders History */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border/80 pb-3">
            <History className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-textPrimary">ประวัติการสั่งซื้อในเบราว์เซอร์นี้</h2>
          </div>

          {pastOrders.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center border-dashed border-border/60">
              <FileText className="w-12 h-12 text-textMuted mx-auto mb-3 opacity-40" />
              <h3 className="text-textSecondary font-semibold mb-1">ไม่พบประวัติออเดอร์ในเครื่อง</h3>
              <p className="text-textMuted text-xs max-w-sm mx-auto">
                ยังไม่มีรายการซื้อสำเร็จที่ทำรายการผ่านเบราว์เซอร์นี้ หรือคุณอาจเคลียร์ข้อมูลการท่องเว็บ/คุกกี้ไปแล้ว 
                คุณสามารถใช้ช่องค้นหาด้านบนเพื่อดึงข้อมูลกลับมาได้ตลอดเวลาครับ
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pastOrders.map((order: any, idx: number) => (
                <div
                  key={order.orderNumber || idx}
                  className="glass-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5 transition-all hover:border-primary/20"
                >
                  {/* Left info block */}
                  <div className="space-y-3 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono font-bold text-sm text-textPrimary bg-surfaceLight border border-border px-2 py-0.5 rounded-lg">
                        {order.orderNumber}
                      </span>
                      {order.status === 'needs_manual_delivery' || order.status === 'partial' ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
                          รอดำเนินการ 👨‍💻
                        </span>
                      ) : order.status === 'completed' ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          เสร็จสิ้น ⚡
                        </span>
                      ) : order.status === 'cancelled' ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                          ❌ ออเดอร์ถูกยกเลิก
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-surfaceLight border border-border text-textMuted">
                          รอตรวจสอบ
                        </span>
                      )}
                    </div>

                    {/* Metadata row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-textMuted">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-textMuted" />
                        {formatDateWithTime(order.createdAt)}
                      </span>
                      <span className="flex items-center gap-1 truncate" title={order.customer?.email}>
                        <Mail className="w-3.5 h-3.5 text-textMuted" />
                        {order.customer?.email}
                      </span>
                    </div>

                    {/* Purchased items list */}
                    <div className="space-y-1.5">
                      {order.items?.map((item: any, itemIdx: number) => (
                        <div key={itemIdx} className="flex items-center gap-1.5 text-xs text-textSecondary pl-1">
                          <CornerDownRight className="w-3 h-3 text-textMuted" />
                          <span className="font-medium truncate max-w-xs sm:max-w-md">
                            {item.product?.name}
                          </span>
                          <span className="text-textMuted">
                            (x{item.quantity})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Action and price block */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 shrink-0 pt-3 sm:pt-0 border-t border-border/40 sm:border-t-0">
                    <div className="sm:text-right">
                      <span className="text-[10px] text-textMuted uppercase font-bold block">ยอดจ่ายสุทธิ</span>
                      <span className="text-lg font-extrabold text-primary-light">
                        {formatPrice(order.total)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleViewOrderDetails(order)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surfaceLight hover:bg-surfaceLight/80 border border-border text-xs font-bold text-textPrimary transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Key className="w-3.5 h-3.5 text-primary" />
                      ดูรายละเอียดออเดอร์
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Support Warning */}
        <div className="p-4 bg-surfaceLight/20 border border-border/50 rounded-2xl flex items-start gap-3 text-xs text-textMuted">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-textPrimary block mb-0.5">🔒 คุ้มครองข้อมูลและความปลอดภัยของผู้ซื้อ</strong>
            ข้อมูลสินค้าและคีย์ต่างๆ จะถูกจัดเก็บไว้ในอุปกรณ์ของคุณ (localStorage) เท่านั้น ทางร้านไม่มีการเก็บประวัติคุกกี้ที่ละเมิดข้อมูลความเป็นส่วนตัว หากต้องการสอบถามหรือเคลมสินค้า กรุณาเซฟรูปสลิปและใบเสร็จแจ้งแอดมินทุกครั้ง
          </div>
        </div>

      </div>
    </div>
  )
}
