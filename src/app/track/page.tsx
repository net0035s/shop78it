'use client'

import React, { useState, useEffect } from 'react'
import { Search, Package, Clock, CheckCircle, XCircle, ArrowRight, Loader2, FileText, ShoppingBag, Copy, Check } from 'lucide-react'
import { useOrderStore } from '@/store/orderStore'
import { OrderSummary } from '@/types'
import { formatPrice } from '@/lib/products'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const LINE_URL = process.env.NEXT_PUBLIC_LINE_URL || '#'

export default function TrackOrderPage() {
  const router = useRouter()
  const [orderNumber, setOrderNumber] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchedOrder, setSearchedOrder] = useState<OrderSummary | null>(null)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const [copiedId, setCopiedId] = useState('')
  
  const { orderHistory, setOrder } = useOrderStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(''), 1800)
  }

  const getDeliveryLines = (item: any) => {
    return [
      item.licenseKey && { label: 'ข้อมูลสินค้า', value: item.licenseKey },
      item.creditCode && { label: 'รหัสเครดิต', value: item.creditCode },
      item.email && { label: 'อีเมลใช้งาน', value: item.email },
      item.password && { label: 'รหัสผ่าน', value: item.password },
      item.loginUrl && { label: 'ลิงก์เข้าใช้งาน', value: item.loginUrl },
      item.instructions && { label: 'วิธีใช้งาน', value: item.instructions },
    ].filter(Boolean) as { label: string; value: string }[]
  }

  const handleSearch = async (e?: React.FormEvent, searchVal?: string) => {
    if (e) e.preventDefault()
    
    const targetOrder = (searchVal || orderNumber).trim()
    if (!targetOrder) return

    setOrderNumber(targetOrder)
    setIsSearching(true)
    setError('')
    setSearchedOrder(null)

    try {
      const res = await fetch(`/api/orders?orderNumber=${encodeURIComponent(targetOrder)}`)
      const result = await res.json()

      if (result.success) {
        setSearchedOrder(result.data)
      } else {
        setError(result.error || 'ไม่พบออเดอร์ในระบบ กรุณาตรวจสอบหมายเลขอีกครั้ง')
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อระบบหลังบ้าน กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsSearching(false)
    }
  }

  const renderStatus = (status: string) => {
    switch(status) {
      case 'completed':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-sm font-bold border border-emerald-500/20">
            <CheckCircle className="w-4 h-4" /> ออเดอร์สำเร็จ (ส่งแล้ว)
          </div>
        )
      case 'needs_manual_delivery':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-sm font-bold border border-orange-500/20">
            <Clock className="w-4 h-4" /> รอแอดมินจัดส่ง
          </div>
        )
      case 'cancelled':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-sm font-bold border border-red-500/20">
            <XCircle className="w-4 h-4" /> ยกเลิก
          </div>
        )
      default: // pending
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-bold border border-primary/20">
            <Clock className="w-4 h-4" /> รอชำระเงิน
          </div>
        )
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-20 animate-fade-in">
      <div className="text-center mb-10">
        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
          <Package className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-textPrimary tracking-tight mb-4">
          ติดตามสถานะออเดอร์
        </h1>
        <p className="text-textMuted text-lg">
          กรอกหมายเลขคำสั่งซื้อของคุณ (เช่น SA-...) เพื่อตรวจสอบสถานะล่าสุด
        </p>
      </div>

      {/* Search Box */}
      <div className="max-w-2xl mx-auto mb-12">
        <form onSubmit={(e) => handleSearch(e)} className="relative flex items-center">
          <Search className="absolute left-4 w-6 h-6 text-textMuted" />
          <input
            type="text"
            placeholder="ค้นหา Order ID (เช่น SA-ABCDEFG)"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className="w-full pl-14 pr-32 py-4 bg-surfaceLight border border-border rounded-2xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-lg text-textPrimary uppercase transition-all"
          />
          <button
            type="submit"
            disabled={isSearching || !orderNumber.trim()}
            className="absolute right-2 px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primaryDark transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ค้นหา'}
          </button>
        </form>
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-500 text-sm font-medium">{error}</p>
          </div>
        )}
      </div>

      {/* Result Section */}
      {searchedOrder && (
        <div className="max-w-2xl mx-auto bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-xl shadow-black/5 animate-slide-up">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6 mb-6">
            <div>
              <p className="text-textMuted text-sm font-medium mb-1">หมายเลขคำสั่งซื้อ</p>
              <h2 className="text-2xl font-black text-textPrimary font-mono">
                {searchedOrder.orderNumber}
              </h2>
            </div>
            <div className="text-left md:text-right">
              {renderStatus(searchedOrder.status)}
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between">
              <span className="text-textSecondary">ชื่อผู้สั่งซื้อ:</span>
              <span className="text-textPrimary font-medium">{searchedOrder.customer.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-textSecondary">อีเมล:</span>
              <span className="text-textPrimary font-medium">{searchedOrder.customer.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-textSecondary">ยอดชำระสุทธิ:</span>
              <span className="text-primary font-bold text-lg">{formatPrice(searchedOrder.total)}</span>
            </div>
          </div>

          {((searchedOrder.deliveryItems?.length ?? 0) > 0 || searchedOrder.items?.some((item: any) => item.product.deliveryType === 'manual')) && (
            <div className="space-y-4 mb-8">
              {(searchedOrder.deliveryItems ?? []).map((item: any, idx) => {
                const lines = getDeliveryLines(item)
                return (
                  <div key={`auto-${idx}`} className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <p className="font-bold text-textPrimary">{item.productName}</p>
                        <p className="text-xs text-emerald-400 font-bold mt-1">จัดส่งแล้ว</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {lines.map((line, lineIdx) => {
                        const copyKey = `auto-${idx}-${lineIdx}`
                        return (
                          <div key={copyKey} className="flex flex-col sm:flex-row gap-2">
                            <div className="flex-1">
                              <p className="text-[11px] text-textMuted font-bold mb-1">{line.label}</p>
                              <div className="px-3 py-2 rounded-xl bg-surfaceLight border border-border text-sm text-textPrimary whitespace-pre-wrap break-all">
                                {line.value}
                              </div>
                            </div>
                            <button
                              onClick={() => handleCopy(line.value, copyKey)}
                              className="sm:self-end px-3 py-2 rounded-xl bg-surfaceLight border border-border text-textPrimary hover:border-primary/50 transition-all flex items-center justify-center gap-2 text-xs font-bold"
                            >
                              {copiedId === copyKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                              {copiedId === copyKey ? 'คัดลอกแล้ว' : 'คัดลอก'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {(searchedOrder.items ?? []).filter((item: any) => item.product.deliveryType === 'manual').map((item: any, idx) => {
                const manualContent = String((searchedOrder as any).deliveredContent ?? '').trim()
                const copyKey = `manual-${idx}`
                return (
                  <div key={copyKey} className={`p-4 rounded-2xl border ${searchedOrder.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-orange-500/20 bg-orange-500/5'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <p className="font-bold text-textPrimary">{item.product.name} <span className="text-xs text-textMuted font-normal">x{item.quantity}</span></p>
                        <p className={`text-xs font-bold mt-1 ${searchedOrder.status === 'completed' ? 'text-emerald-400' : 'text-orange-400'}`}>
                          {searchedOrder.status === 'completed' ? 'ดำเนินการเสร็จแล้ว' : 'รอดำเนินการโดยแอดมิน'}
                        </p>
                      </div>
                    </div>

                    {searchedOrder.status === 'completed' && manualContent ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1">
                          <p className="text-[11px] text-textMuted font-bold mb-1">ข้อมูลการจัดส่ง</p>
                          <div className="px-3 py-2 rounded-xl bg-surfaceLight border border-border text-sm text-textPrimary whitespace-pre-wrap break-all">
                            {manualContent}
                          </div>
                        </div>
                        <button
                          onClick={() => handleCopy(manualContent, copyKey)}
                          className="sm:self-end px-3 py-2 rounded-xl bg-surfaceLight border border-border text-textPrimary hover:border-primary/50 transition-all flex items-center justify-center gap-2 text-xs font-bold"
                        >
                          {copiedId === copyKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          {copiedId === copyKey ? 'คัดลอกแล้ว' : 'คัดลอก'}
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-textSecondary leading-relaxed">
                        สินค้าชิ้นนี้ต้องดำเนินการโดยแอดมิน โปรดติดต่อและส่งหมายเลขออเดอร์ไปที่ Line OA เพื่อดำเนินการต่อ
                        <div className="mt-3">
                          <a href={LINE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#00B900] text-white text-xs font-bold">
                            ติดต่อ Line OA
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {searchedOrder.status === 'completed' && (
            <button
              onClick={() => {
                setOrder(searchedOrder)
                router.push('/thank-you')
              }}
              className="w-full py-4 rounded-xl bg-primary-gradient text-white font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
              ดูข้อมูลสินค้าที่ได้รับ <ArrowRight className="w-5 h-5" />
            </button>
          )}

          {searchedOrder.status === 'pending' && (
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-center">
              <p className="text-orange-500 text-sm font-medium mb-3">
                ออเดอร์นี้ยังไม่ได้รับการยืนยันการชำระเงิน หรือรอแอดมินตรวจสอบสลิป
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recent Orders from LocalStorage */}
      {!searchedOrder && orderHistory.length > 0 && (
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-textMuted" />
            <h3 className="text-lg font-bold text-textPrimary">ประวัติการสั่งซื้อล่าสุดของคุณ</h3>
          </div>
          <div className="space-y-3">
            {orderHistory.map((id) => (
              <button
                key={id}
                onClick={() => handleSearch(undefined, id)}
                className="w-full flex items-center justify-between p-4 bg-surfaceLight border border-border hover:border-primary/50 rounded-2xl transition-all group text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center border border-border">
                    <ShoppingBag className="w-5 h-5 text-textMuted group-hover:text-primary transition-colors" />
                  </div>
                  <div>
                    <p className="font-mono font-bold text-textPrimary">{id}</p>
                    <p className="text-xs text-textMuted">แตะเพื่อตรวจสอบสถานะ</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-textMuted group-hover:text-primary transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
