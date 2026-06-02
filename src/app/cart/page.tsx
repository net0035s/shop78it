'use client'

import React, { useState, useEffect } from 'react'
import { ShoppingCart, ArrowLeft, Plus, Minus, Trash2, ShieldCheck, Ticket, Percent, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useCartStore } from '@/store/cartStore'
import { formatPrice } from '@/lib/products'
import Image from 'next/image'
import { toast } from 'react-hot-toast'

export default function CartPage() {
  const {
    items,
    updateQuantity,
    removeItem,
    getSubTotal,
    getDiscountAmount,
    getTotal,
    getItemCount,
    discount,
    discountRemovalReason,
    applyDiscount,
    removeDiscount,
    clearDiscountRemovalReason,
  } = useCartStore()
  const [couponCode, setCouponCode] = useState('')
  const [couponError, setCouponError] = useState('')
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false)

  // We handle hydration mismatch with a state check
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !discountRemovalReason) return
    toast.error(discountRemovalReason)
    clearDiscountRemovalReason()
  }, [mounted, discountRemovalReason, clearDiscountRemovalReason])

  if (!mounted) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-textMuted">กำลังโหลดตะกร้าสินค้าของคุณ...</p>
        </div>
      </div>
    )
  }

  const subtotal = getSubTotal()
  const discountAmount = getDiscountAmount()
  const finalTotal = getTotal()

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    setCouponError('')
    
    if (!couponCode.trim()) {
      setCouponError('กรุณากรอกรหัสคูปอง')
      return
    }

    const code = couponCode.toUpperCase().trim()
    setIsApplyingCoupon(true)

    try {
      const response = await fetch('/api/discount/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, items, subTotal: subtotal }),
      })
      const result = await response.json()

      if (!result.success) {
        setCouponError(result.error || 'โค้ดส่วนลดใช้ไม่ได้')
        return
      }

      applyDiscount(result.data)
      setCouponCode('')
    } catch (error) {
      setCouponError('ตรวจสอบโค้ดไม่ได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsApplyingCoupon(false)
    }
  }

  const handleRemoveCoupon = () => {
    setCouponCode('')
    removeDiscount()
    setCouponError('')
  }

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center animate-fade-in">
        <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center rounded-3xl bg-surfaceLight border border-border/60">
          <ShoppingCart className="w-10 h-10 text-textMuted opacity-50" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full animate-ping" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-textPrimary tracking-tight">
          ตะกร้าสินค้าของคุณยังว่างเปล่า
        </h1>
        <p className="text-textMuted text-sm sm:text-base mt-2 max-w-md mx-auto">
          ยังไม่มีการเพิ่มสินค้าลงในตะกร้าของคุณ ไปเลือกชมสินค้าดิจิทัลและโปรเกรสซอร์พรีเมียมของเราสิ!
        </p>
        <div className="mt-8">
          <Link
            href="/#products"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary-gradient hover:opacity-90 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-lg shadow-primary/25 transition-all btn-glow"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับไปเลือกสินค้า
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      {/* Breadcrumb Navigation */}
      <Link
        href="/#products"
        className="inline-flex items-center gap-2 text-textMuted hover:text-primary transition-colors text-sm mb-6 sm:mb-8 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        กลับไปเลือกสินค้าเพิ่มเติม
      </Link>

      <div className="flex items-center gap-3.5 mb-8">
        <div className="p-2 bg-primary/10 rounded-xl border border-primary/25">
          <ShoppingCart className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-textPrimary tracking-tight">ตะกร้าสินค้า</h1>
          <p className="text-xs sm:text-sm text-textMuted mt-0.5">มีสินค้าทั้งหมด {getItemCount()} ชิ้นในตะกร้า</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Product List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-border/60">
            {items.map((item) => {
              const product = item.product
              const itemTotal = product.price * item.quantity

              return (
                <div
                  key={product.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-surfaceLight/10"
                >
                  {/* Left: Product Info */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-surfaceLight/80 rounded-xl overflow-hidden shrink-0 border border-border">
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        sizes="(max-width: 640px) 64px, 80px"
                        className="object-cover"
                        priority
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-textPrimary truncate hover:text-primary transition-colors">
                        <Link href={`/#products`}>{product.name}</Link>
                      </h3>
                      <p className="text-xs text-textMuted mt-0.5 font-medium flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-surfaceLight border border-border text-[10px] text-textSecondary uppercase">
                          {product.category}
                        </span>
                        <span>•</span>
                        <span className="text-emerald-400 font-semibold">{product.deliveryInfo}</span>
                      </p>
                      <p className="text-sm font-bold text-textPrimary mt-2 sm:hidden">
                        {formatPrice(product.price)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Quantity Controls & Price */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-border/40 pt-3 sm:pt-0 sm:border-t-0">
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1 bg-surfaceLight/40 border border-border/80 rounded-xl p-1 shrink-0">
                      <button
                        onClick={() => updateQuantity(product.id, item.quantity - 1)}
                        className="p-1.5 rounded-lg hover:bg-surfaceLight text-textMuted hover:text-textPrimary active:scale-95 transition-all"
                        aria-label="ลดจำนวน"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-textPrimary">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(product.id, item.quantity + 1)}
                        className="p-1.5 rounded-lg hover:bg-surfaceLight text-textMuted hover:text-textPrimary active:scale-95 transition-all"
                        aria-label="เพิ่มจำนวน"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Price and Action */}
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-textPrimary">{formatPrice(itemTotal)}</p>
                        {item.quantity > 1 && (
                          <p className="text-[10px] text-textMuted mt-0.5">
                            {formatPrice(product.price)} / ชิ้น
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(product.id)}
                        className="p-2 rounded-xl bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-500 border border-red-500/10 hover:border-red-500/20 active:scale-95 transition-all shrink-0"
                        title="ลบออกจากตะกร้า"
                        id={`remove-${product.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Quick Notice */}
          <div className="flex items-start gap-2.5 px-4.5 py-3.5 bg-surfaceLight/20 border border-border/50 rounded-xl text-xs text-textMuted">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              <strong>จัดส่งสินค้าดิจิทัลอัตโนมัติ:</strong> คุณจะได้รับรหัสคีย์ บัญชี หรือลิงก์ใช้งานทันทีหลังยืนยันสลิปชำระเงิน สำเร็จตลอด 24 ชั่วโมง โดยข้อมูลการจัดส่งจะถูกส่งไปที่อีเมลที่กรอกในหน้าถัดไป
            </p>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 space-y-6 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

            <h2 className="text-lg font-bold text-textPrimary border-b border-border/60 pb-3">
              สรุปยอดคำสั่งซื้อ
            </h2>

            {/* Price Calculations */}
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between text-textSecondary">
                <span>ยอดรวมสินค้า</span>
                <span className="font-semibold text-textPrimary">{formatPrice(subtotal)}</span>
              </div>

              {/* Coupon Form */}
              {!discount ? (
                <form onSubmit={handleApplyCoupon} className="pt-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
                      <input
                        type="text"
                        placeholder="กรอกโค้ดส่วนลด"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-surfaceLight/40 border border-border rounded-lg text-textPrimary focus:outline-none focus:border-primary transition-all uppercase"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isApplyingCoupon || !couponCode.trim()}
                      className="px-4 py-2 bg-surfaceLight hover:bg-surfaceLight/80 border border-border rounded-lg text-xs font-bold text-textPrimary transition-all"
                    >
                      {isApplyingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ใช้โค้ด'}
                    </button>
                  </div>
                  {couponError && (
                    <p className="text-[11px] text-red-500 mt-1.5 font-medium">{couponError}</p>
                  )}
                </form>
              ) : (
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Percent className="w-4 h-4" />
                    <span>ใช้โค้ด {discount.code} สำเร็จแล้ว (-{formatPrice(discountAmount)})</span>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-textMuted hover:text-red-500 transition-colors"
                  >
                    ลบ
                  </button>
                </div>
              )}

              {discount && discountAmount > 0 && (
                <div className="flex justify-between text-textSecondary">
                  <span>ส่วนลดคูปอง ({discount.code})</span>
                  <span className="font-semibold text-emerald-400">-{formatPrice(discountAmount)}</span>
                </div>
              )}

              <div className="border-t border-border/60 pt-4 flex justify-between items-end">
                <span className="text-sm font-bold text-textPrimary">ยอดรวมสุทธิ</span>
                <span className="text-2xl font-extrabold text-primary-light tracking-tight">
                  {formatPrice(finalTotal)}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <div className="pt-2">
              <Link
                href="/checkout"
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-primary-gradient hover:opacity-90 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-lg shadow-primary/20 transition-all btn-glow"
                id="cart-checkout-btn"
              >
                ดำเนินการชำระเงิน
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="pt-2 border-t border-border/40 text-center space-y-2">
              <span className="text-[10px] text-textMuted font-medium block">
                ระบบชำระเงินปลอดภัยและคุ้มครองข้อมูลด้วยการเข้ารหัส
              </span>
              <div className="flex justify-center gap-4 opacity-40 text-textMuted">
                {/* Simulated payment badges */}
                <div className="text-[10px] border border-border px-2 py-0.5 rounded font-mono font-bold tracking-tight">
                  PROMPTPAY
                </div>
                <div className="text-[10px] border border-border px-2 py-0.5 rounded font-mono font-bold tracking-tight">
                  SSL SECURE
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
