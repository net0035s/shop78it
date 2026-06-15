'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Copy, Check, Download, ShoppingBag, ArrowRight, ExternalLink, Key, Mail, ShieldAlert, Cpu, Clock, Eye, EyeOff } from 'lucide-react'
import { useOrderStore } from '@/store/orderStore'
import { formatPrice } from '@/lib/products'
import { formatDateWithTime } from '@/lib/utils'
import Link from 'next/link'

const LINE_URL = process.env.NEXT_PUBLIC_LINE_URL || '#'

export default function ThankYouPage() {
  const router = useRouter()
  const { currentOrder, clearOrder, setOrder } = useOrderStore()
  const [mounted, setMounted] = useState(false)
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({})
  const [visiblePasswords, setVisiblePasswords] = useState<{ [key: string]: boolean }>({})

  useEffect(() => {
    setMounted(true)

    // Background sync order status from server
    if (currentOrder?.orderNumber) {
      fetch(`/api/orders?orderNumber=${currentOrder.orderNumber}`)
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data && result.data.status !== currentOrder.status) {
            setOrder({ ...currentOrder, status: result.data.status })
          }
        })
        .catch(err => console.error('Failed to sync order status:', err))
    }
  }, [currentOrder?.orderNumber, currentOrder?.status, setOrder])

  useEffect(() => {
    if (mounted && currentOrder) {
      try {
        const stored = localStorage.getItem('shopauto-guest-orders')
        const orders = stored ? JSON.parse(stored) : []
        const isDuplicate = orders.some((o: any) => o.orderNumber === currentOrder.orderNumber)
        if (!isDuplicate) {
          const updated = [currentOrder, ...orders].slice(0, 50)
          localStorage.setItem('shopauto-guest-orders', JSON.stringify(updated))
        }
      } catch (err) {
        console.error('Failed to save order to history:', err)
      }
    }
  }, [mounted, currentOrder])

  if (!mounted) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 flex items-center justify-center min-h-[70vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-textMuted">กำลังโหลดรายละเอียดการจัดส่งสินค้า...</p>
        </div>
      </div>
    )
  }

  if (!currentOrder) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-textPrimary">ไม่พบข้อมูลออเดอร์ล่าสุด</h1>
        <p className="text-sm text-textMuted mt-2">
          ขออภัยด้วยครับ เราไม่สามารถหาคำสั่งซื้อที่เสร็จสมบูรณ์ของคุณได้ในเซสชันปัจจุบัน
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/#products"
            className="px-6 py-2.5 rounded-xl bg-primary-gradient text-white font-semibold text-sm shadow-md"
          >
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    )
  }


  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedStates((prev) => ({ ...prev, [id]: true }))
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [id]: false }))
    }, 2000)
  }

  const deliveryItems = currentOrder?.deliveryItems || []
  const hasAuto = deliveryItems.length > 0
  const manualCartItems = currentOrder?.items?.filter((item: any) => {
    return !deliveryItems.some((dItem: any) => dItem.productName === item.product.name)
  }) || []
  const hasManual = manualCartItems.length > 0

  const handleDownloadTxt = () => {
    if (!currentOrder || !currentOrder.deliveryItems) return

    let textContent = `==================================================\n`
    textContent += `      ShopAuto 24/7 - สรุปรายละเอียดการจัดส่งสินค้า\n`
    textContent += `==================================================\n\n`
    textContent += `เลขที่ใบสั่งซื้อ: ${currentOrder.orderNumber}\n`
    textContent += `วันที่สั่งซื้อ: ${formatDateWithTime(currentOrder.createdAt)}\n`
    textContent += `ข้อมูลผู้ซื้อ: ${currentOrder.customer.name} (${currentOrder.customer.email})\n`
    textContent += `ยอดชำระสุทธิ: ${currentOrder.total} บาท\n\n`
    textContent += `--------------------------------------------------\n`
    textContent += `รายการสินค้าดิจิทัลจัดส่งแล้ว:\n`
    textContent += `--------------------------------------------------\n\n`

    currentOrder.deliveryItems.forEach((item, index) => {
      textContent += `${index + 1}. สินค้า: ${item.productName}\n`
      textContent += `ประเภท: ${item.type}\n`
      
      if (item.creditCode) {
        textContent += `โค้ดเครดิต AI: ${item.creditCode} (${item.creditAmount} - ${item.platform})\n`
      }
      if (item.email) {
        textContent += `บัญชีผู้ใช้งาน (Email): ${item.email}\n`
      }
      if (item.password) {
        textContent += `รหัสผ่าน (Password): ${item.password}\n`
      }
      if (item.loginUrl) {
        textContent += `ลิงก์เข้าใช้งาน: ${item.loginUrl}\n`
      }
      if (item.licenseKey) {
        textContent += `คีย์ผลิตภัณฑ์: ${item.licenseKey}\n`
      }
      if (item.expiresAt) {
        textContent += `วันหมดอายุ / ประกันสินค้า: ${item.expiresAt}\n`
      }
      if (item.showInstruction !== false) {
        const instructionText = item.instructions || 'เปิดใช้งานสินค้าตามคำแนะนำของทางร้าน'
        textContent += `วิธีใช้งาน:\n${instructionText.split('\n').map(line => `  ${line}`).join('\n')}\n`
      }
      textContent += `\n--------------------------------------------------\n\n`
    })

    textContent += `ขอบคุณที่ใช้บริการ ShopAuto 24/7\n`
    textContent += `ระบบจัดส่งสินค้าดิจิทัลอัตโนมัติตลอด 24 ชั่วโมง\n`

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ShopAuto-Order-${currentOrder.orderNumber}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 animate-fade-in">
      {/* Top Celebration */}
      <div className="text-center space-y-4 mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2 relative">
          <CheckCircle2 className="w-8 h-8 relative z-10" />
          <span className="absolute inset-0 rounded-full bg-emerald-500/5 animate-ping" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-textPrimary tracking-tight">
          ชำระเงินเสร็จสมบูรณ์!
        </h1>
        <p className="text-sm sm:text-base text-textMuted max-w-lg mx-auto">
          ขอบคุณที่สั่งซื้อสินค้ากับ <span className="text-primary font-bold">ShopAuto 24/7</span> ระบบ AI ตรวจสลิปได้เรียบร้อย และทำการส่งมอบสินค้าดิจิทัลให้คุณทันทีด้านล่าง
        </p>

        {/* Order Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-surfaceLight/30 border border-border/60 rounded-2xl text-xs max-w-2xl mx-auto text-left">
          <div>
            <span className="text-textMuted block">เลขที่ออเดอร์</span>
            <span className="font-mono font-bold text-textPrimary truncate block mt-0.5">{currentOrder.orderNumber}</span>
          </div>
          <div>
            <span className="text-textMuted block">ยอดชำระสุทธิ</span>
            <span className="font-semibold text-textPrimary block mt-0.5">{formatPrice(currentOrder.total)}</span>
          </div>
          <div>
            <span className="text-textMuted block">ส่งไปยังอีเมล</span>
            <span className="font-semibold text-textPrimary truncate block mt-0.5" title={currentOrder.customer.email}>
              {currentOrder.customer.email}
            </span>
          </div>
          <div>
            <span className="text-textMuted block">สถานะจัดส่ง</span>
            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold mt-0.5">
              สำเร็จ ⚡
            </span>
          </div>
        </div>
      </div>

      {/* Main Delivery Area */}
      <div className="space-y-8 mt-8">
        {hasAuto && (
          <div className="space-y-6 p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-500/20 pb-4">
              <h2 className="text-lg font-bold text-textPrimary flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                รายการจัดส่งอัตโนมัติสำเร็จ
              </h2>
              <button
                onClick={handleDownloadTxt}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surfaceLight hover:bg-surfaceLight/80 border border-emerald-500/30 text-xs font-bold text-emerald-400 transition-all hover:scale-95"
                title="ดาวน์โหลดไฟล์ข้อมูล"
              >
                <Download className="w-4 h-4" />
                ดาวน์โหลดคีย์ (.TXT)
              </button>
            </div>

            <div className="space-y-6">
            {(currentOrder.deliveryItems ?? []).map((item, idx) => {
              const itemUniqueId = `item-${idx}`

              return (
                <div key={idx} className="bg-surface border border-border shadow-sm rounded-2xl p-5 sm:p-6 space-y-4 relative overflow-hidden transition-all duration-300 hover:border-primary/30">
                  {/* Category glow element */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

                  {/* Item Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
                    <div>
                      <h3 className="font-bold text-textPrimary text-sm sm:text-base flex items-center gap-2">
                        {item.type === 'ai-credit' && <Cpu className="w-4 h-4 text-primary shrink-0" />}
                        {item.type === 'login-info' && <Mail className="w-4 h-4 text-primary shrink-0" />}
                        {item.type === 'license-key' && <Key className="w-4 h-4 text-primary shrink-0" />}
                        {item.productName}
                      </h3>
                      <p className="text-[10px] text-textMuted mt-0.5 uppercase tracking-wide">
                        ประเภท: {item.type} {item.expiresAt ? `• ประกัน: ${item.expiresAt}` : ''}
                      </p>
                    </div>

                    {/* Delivery badge */}
                    <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 w-fit">
                      จัดส่งทันที
                    </span>
                  </div>

                  {/* Delivery details display based on type */}
                  <div className="space-y-4 pt-1">
                    {/* 1. AI Credits display */}
                    {item.type === 'ai-credit' && item.creditCode && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-3 bg-surfaceLight/30 border border-border/50 rounded-xl">
                            <span className="text-[10px] text-textMuted block font-bold uppercase tracking-wider">แพลตฟอร์ม AI</span>
                            <span className="text-sm font-bold text-textPrimary mt-0.5 block">{item.platform}</span>
                          </div>
                          <div className="p-3 bg-surfaceLight/30 border border-border/50 rounded-xl">
                            <span className="text-[10px] text-textMuted block font-bold uppercase tracking-wider">มูลค่าเครดิต</span>
                            <span className="text-sm font-bold text-emerald-400 mt-0.5 block">{item.creditAmount}</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] text-textMuted font-bold uppercase tracking-wider mb-1.5">รหัสโค้ดเครดิต AI</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={item.creditCode}
                              className="flex-1 px-4 py-3 bg-surfaceLight border border-border rounded-xl text-sm font-mono font-bold text-primary-light focus:outline-none"
                            />
                            <button
                              onClick={() => handleCopy(item.creditCode || '', `${itemUniqueId}-code`)}
                              className="px-4 bg-surfaceLight hover:bg-surfaceLight/80 border border-border rounded-xl flex items-center justify-center text-textPrimary transition-all shrink-0 active:scale-95"
                              title="คัดลอกโค้ด"
                            >
                              {copiedStates[`${itemUniqueId}-code`] ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. Login accounts display */}
                    {item.type === 'login-info' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Email input */}
                          <div>
                            <label className="block text-[10px] text-textMuted font-bold uppercase tracking-wider mb-1.5">อีเมลบัญชีใช้งาน (Email)</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                readOnly
                                value={item.email}
                                className="flex-1 px-4 py-2.5 bg-surfaceLight border border-border rounded-xl text-xs sm:text-sm font-medium text-textPrimary focus:outline-none"
                              />
                              <button
                                onClick={() => handleCopy(item.email || '', `${itemUniqueId}-email`)}
                                className="p-2.5 bg-surfaceLight hover:bg-surfaceLight/80 border border-border rounded-xl flex items-center justify-center text-textPrimary transition-all shrink-0 active:scale-95"
                              >
                                {copiedStates[`${itemUniqueId}-email`] ? (
                                  <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Password input */}
                          <div>
                            <label className="block text-[10px] text-textMuted font-bold uppercase tracking-wider mb-1.5">รหัสผ่าน (Password)</label>
                            <div className="flex gap-2">
                              <input
                                type={visiblePasswords[`${itemUniqueId}-pass`] ? 'text' : 'password'}
                                readOnly
                                value={item.password}
                                className="flex-1 px-4 py-2.5 bg-surfaceLight border border-border rounded-xl text-xs sm:text-sm font-mono font-bold text-textPrimary focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setVisiblePasswords(prev => ({
                                  ...prev,
                                  [`${itemUniqueId}-pass`]: !prev[`${itemUniqueId}-pass`],
                                }))}
                                className="p-2.5 bg-surfaceLight hover:bg-surfaceLight/80 border border-border rounded-xl flex items-center justify-center text-textPrimary transition-all shrink-0 active:scale-95"
                                aria-label={visiblePasswords[`${itemUniqueId}-pass`] ? 'Hide password' : 'Show password'}
                              >
                                {visiblePasswords[`${itemUniqueId}-pass`] ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.password || '', `${itemUniqueId}-pass`)}
                                className="p-2.5 bg-surfaceLight hover:bg-surfaceLight/80 border border-border rounded-xl flex items-center justify-center text-textPrimary transition-all shrink-0 active:scale-95"
                              >
                                {copiedStates[`${itemUniqueId}-pass`] ? (
                                  <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {item.loginUrl && (
                          <div className="pt-1">
                            <a
                              href={item.loginUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-light transition-colors hover:underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              เปิดหน้าล็อกอินเข้ารับบริการ
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. License key display */}
                    {item.type === 'license-key' && item.licenseKey && (
                      <div>
                        <label className="block text-[10px] text-textMuted font-bold uppercase tracking-wider mb-1.5">คีย์เปิดใช้งานผลิตภัณฑ์ (License Key)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={item.licenseKey}
                            className="flex-1 px-4 py-3 bg-surfaceLight border border-border rounded-xl text-sm font-mono font-bold text-primary-light tracking-wide focus:outline-none"
                          />
                          <button
                            onClick={() => handleCopy(item.licenseKey || '', `${itemUniqueId}-key`)}
                            className="px-4 bg-surfaceLight hover:bg-surfaceLight/80 border border-border rounded-xl flex items-center justify-center text-textPrimary transition-all shrink-0 active:scale-95"
                          >
                            {copiedStates[`${itemUniqueId}-key`] ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 4. Login link display */}
                    {item.type === 'login-link' && item.loginUrl && (
                      <div className="space-y-3">
                        <label className="block text-[10px] text-textMuted font-bold uppercase tracking-wider mb-1">ลิงก์เข้าใช้งานพรีเมียมส่วนตัว</label>
                        <div className="flex flex-col sm:flex-row gap-2.5">
                          <a
                            href={item.loginUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 px-4 py-3 bg-primary-gradient hover:opacity-90 active:scale-[0.99] text-center font-bold text-xs sm:text-sm text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            คลิกเพื่อลงชื่อเข้าใช้ทันที
                          </a>
                          <button
                            onClick={() => handleCopy(item.loginUrl || '', `${itemUniqueId}-link`)}
                            className="px-5 py-3 bg-surfaceLight hover:bg-surfaceLight/80 border border-border text-xs font-bold text-textPrimary rounded-xl transition-all active:scale-95 shrink-0"
                          >
                            {copiedStates[`${itemUniqueId}-link`] ? 'คัดลอกสำเร็จแล้ว' : 'คัดลอกลิงก์'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Instructions area */}
                    {item.showInstruction !== false && (
                      <div className="bg-surfaceLight/30 border border-border/40 rounded-xl p-3.5 space-y-1.5 text-xs">
                        <p className="font-bold text-textPrimary">💡 วิธีเปิดใช้งานและข้อมูลเพิ่มเติม:</p>
                        <div className="text-textMuted leading-relaxed whitespace-pre-line text-[11px] sm:text-xs">
                          {item.instructions || 'เปิดใช้งานสินค้าตามคำแนะนำของทางร้าน'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            </div>
          </div>
        )}

        {hasManual && (
          <div className={`space-y-6 p-6 rounded-2xl border ${
            currentOrder.status === 'cancelled' ? 'bg-red-500/5 border-red-500/20' : 
            currentOrder.status === 'completed' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-orange-500/5 border-orange-500/20'}`}>
            <div className={`flex items-center justify-between border-b pb-4 ${
              currentOrder.status === 'cancelled' ? 'border-red-500/20' : 
              currentOrder.status === 'completed' ? 'border-emerald-500/20' : 'border-orange-500/20'}`}>
              <h2 className="text-lg font-bold text-textPrimary flex items-center gap-2">
                {currentOrder.status === 'cancelled' ? (
                  <>
                    <ShieldAlert className="w-5 h-5 text-red-400" />
                    ออเดอร์ถูกยกเลิก
                  </>
                ) : currentOrder.status === 'completed' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    รายการที่จัดส่งโดยแอดมิน
                  </>
                ) : (
                  <>
                    <Clock className="w-5 h-5 text-orange-400" />
                    รายการรอดำเนินการโดยแอดมิน
                  </>
                )}
              </h2>
            </div>
            <div className="space-y-4">
              {currentOrder.status === 'cancelled' && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <div>
                    <strong className="block mb-1 text-red-300">หากคุณชำระเงินแล้ว กรุณาติดต่อแอดมินเพื่อดำเนินการคืนเงิน</strong>
                    รายการนี้ถูกยกเลิกโดยระบบหรือผู้ดูแล โปรดติดต่อเพื่อสอบถามข้อมูลเพิ่มเติม
                  </div>
                </div>
              )}
              {manualCartItems.map((item: any, idx: number) => (
                <div key={`manual-${idx}`} className={`bg-surface shadow-sm rounded-2xl p-5 border-l-4 ${
                  currentOrder.status === 'cancelled' ? 'border-l-red-500/50' : 
                  currentOrder.status === 'completed' ? 'border-l-emerald-500/50' : 'border-l-orange-500/50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-textPrimary">{item.product.name} <span className="text-textMuted text-xs font-normal ml-1">(x{item.quantity})</span></h3>
                      <p className="text-xs text-textMuted mt-1">สินค้าประเภทจัดส่งโดยแอดมิน กรุณารอรับทางแชทหรืออีเมล</p>
                    </div>
                    {currentOrder.status === 'cancelled' ? (
                       <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold">❌ ออเดอร์ถูกยกเลิก</span>
                    ) : currentOrder.status === 'completed' ? (
                       <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">✅ แอดมินดำเนินการเรียบร้อยแล้ว</span>
                    ) : (
                       <span className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold">รอแอดมินดำเนินการ</span>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Contact Button */}
              {currentOrder.status !== 'completed' && (
                <div className="text-center mt-6">
                  <a href={LINE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#00B900] text-white font-bold text-sm tracking-wide shadow-md shadow-[#00B900]/20 hover:opacity-90 active:scale-95 transition-all">
                    💬 ติดต่อสอบถามแอดมิน (Line OA)
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info Warning */}
      <div className="mt-8 p-4 bg-surfaceLight/20 border border-border/50 rounded-2xl text-xs text-textMuted leading-relaxed space-y-1">
        <p>📧 <strong>หมายเหตุเพิ่มเติม:</strong></p>
        <p>รายละเอียดสินค้าและคีย์ทั้งหมดได้รับการจัดส่งสำเนาไปยังกล่องข้อความอีเมลของคุณที่ <strong className="text-textPrimary">{currentOrder.customer.email}</strong> เรียบร้อยแล้ว (หากไม่พบ กรุณาตรวจสอบในโฟลเดอร์ Junk Mail หรือสแปม)</p>
        <p>หากพบปัญหาในการใช้งานหรือคีย์มีปัญหา ท่านสามารถแจ้งสอบถามซัพพอร์ตได้ตลอด 24 ชั่วโมง ผ่านระบบติดต่อฝ่ายบริการลูกค้า</p>
      </div>

      {/* Final Action Buttons */}
      <div className="mt-10 pt-6 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          onClick={() => {
            clearOrder()
            router.push('/')
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-surfaceLight hover:bg-surfaceLight/80 text-textPrimary border border-border font-bold text-sm tracking-wide transition-all active:scale-95"
        >
          กลับหน้าหลัก
        </button>

        <Link
          href="/#products"
          onClick={() => clearOrder()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-primary-gradient hover:opacity-90 active:scale-95 text-white font-bold text-sm tracking-wide shadow-lg shadow-primary/20 transition-all btn-glow"
        >
          ช็อปสินค้าอื่นต่อ
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
