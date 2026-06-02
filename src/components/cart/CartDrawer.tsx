'use client'

import { ShoppingCart, X, Plus, Minus, Trash2, ArrowRight, Tag, Loader2 } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { formatPrice } from '@/lib/products'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'

export function CartDrawer() {
  const items = useCartStore((s) => s.items)
  const isOpen = useCartStore((s) => s.isOpen)
  const closeCart = useCartStore((s) => s.closeCart)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const getSubTotal = useCartStore((s) => s.getSubTotal)
  const getDiscountAmount = useCartStore((s) => s.getDiscountAmount)
  const getTotal = useCartStore((s) => s.getTotal)
  const getItemCount = useCartStore((s) => s.getItemCount)
  const discount = useCartStore((s) => s.discount)
  const applyDiscount = useCartStore((s) => s.applyDiscount)
  const removeDiscount = useCartStore((s) => s.removeDiscount)

  const [discountCode, setDiscountCode] = useState('')
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false)
  const [discountError, setDiscountError] = useState('')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) return
    setIsApplyingDiscount(true)
    setDiscountError('')

    try {
      const response = await fetch('/api/discount/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode, items, subTotal: getSubTotal() }),
      })
      const result = await response.json()

      if (!result.success) {
        setDiscountError(result.error || 'โค้ดส่วนลดใช้ไม่ได้')
        return
      }

      applyDiscount(result.data)
      setDiscountCode('')
    } catch (error) {
      setDiscountError('ตรวจสอบโค้ดไม่ได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsApplyingDiscount(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
          onClick={closeCart}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col',
          'bg-surface border-l border-border shadow-2xl',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-textPrimary text-lg">ตะกร้าสินค้า</h2>
            {isMounted && getItemCount() > 0 && (
              <span className="w-5 h-5 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center">
                {getItemCount()}
              </span>
            )}
          </div>
          <button
            onClick={closeCart}
            className="p-2 rounded-lg text-textMuted hover:text-textPrimary hover:bg-surfaceLight transition-all"
            id="close-cart-drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!isMounted || items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-full bg-surfaceLight flex items-center justify-center mb-4">
                <ShoppingCart className="w-10 h-10 text-textMuted" />
              </div>
              <h3 className="text-textPrimary font-semibold mb-2">ตะกร้าว่างเปล่า</h3>
              <p className="text-textMuted text-sm mb-6">
                เลือกสินค้าที่ต้องการแล้วเพิ่มในตะกร้า
              </p>
              <button
                onClick={closeCart}
                className="text-primary text-sm font-medium hover:underline"
              >
                เลือกดูสินค้า →
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.product.id}
                className="flex gap-3 p-3 bg-surfaceLight rounded-xl border border-border/50"
              >
                {/* Image */}
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-surface flex-shrink-0">
                  <Image
                    src={item.product.image}
                    alt={item.product.name}
                    fill
                    className="object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  <div className="absolute inset-0 bg-gradient-radial from-primary/20 to-surface" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-textPrimary text-sm font-medium line-clamp-1">
                    {item.product.name}
                  </p>
                  <p className="text-primary font-bold text-sm mt-0.5">
                    {formatPrice(item.product.price)}
                  </p>

                  {/* Quantity */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-6 h-6 rounded-md bg-surface border border-border flex items-center justify-center text-textSecondary hover:border-primary/60 hover:text-primary transition-all"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-textPrimary text-sm font-medium w-6 text-center">
                      {item.quantity}
                    </span>
                    <button
                      disabled={item.quantity >= (item.product.stock || 0)}
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className={cn(
                        "w-6 h-6 rounded-md bg-surface border flex items-center justify-center transition-all",
                        item.quantity >= (item.product.stock || 0)
                          ? "border-border/40 text-textMuted/40 cursor-not-allowed"
                          : "border-border text-textSecondary hover:border-primary/60 hover:text-primary"
                      )}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeItem(item.product.id)}
                  className="self-start p-1.5 rounded-lg text-textMuted hover:text-danger hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {isMounted && items.length > 0 && (
          <div className="p-5 border-t border-border space-y-4">
            {/* Discount Section */}
            <div className="space-y-2">
              {discount ? (
                <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-xs font-bold text-emerald-400 block">{discount.code}</span>
                      <span className="text-[10px] text-emerald-500/80">ใช้โค้ดส่วนลดแล้ว</span>
                    </div>
                  </div>
                  <button onClick={removeDiscount} className="p-1 hover:bg-emerald-500/20 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-emerald-500" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
                      <input
                        type="text"
                        placeholder="โค้ดส่วนลด (ถ้ามี)"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                        className="w-full pl-9 pr-3 py-2 bg-surfaceLight border border-border rounded-xl text-sm focus:outline-none focus:border-primary/50 text-textPrimary uppercase"
                      />
                    </div>
                    <button
                      onClick={handleApplyDiscount}
                      disabled={!discountCode.trim() || isApplyingDiscount}
                      className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center min-w-[70px]"
                    >
                      {isApplyingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ใช้โค้ด'}
                    </button>
                  </div>
                  {discountError && <p className="text-[10px] text-red-400 pl-1">{discountError}</p>}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-textSecondary">ราคารวม (Subtotal)</span>
                <span className="text-textPrimary font-semibold">{formatPrice(getSubTotal())}</span>
              </div>
              {discount && (
                <div className="flex justify-between items-center text-sm text-emerald-400 font-medium">
                  <span>ส่วนลด (Discount)</span>
                  <span>-{formatPrice(getDiscountAmount())}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-border/50">
                <span className="text-textPrimary font-bold">ยอดชำระสุทธิ (Net Total)</span>
                <span className="text-primary-light text-xl font-extrabold">
                  {formatPrice(getTotal())}
                </span>
              </div>
            </div>

            <Link
              href="/checkout"
              onClick={closeCart}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-gradient text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
              id="proceed-to-checkout"
            >
              ดำเนินการชำระเงิน
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </>
  )
}

/** ปุ่มลอยมุมขวาล่าง */
export function FloatingCartButton() {
  const openCart = useCartStore((s) => s.openCart)
  const itemCount = useCartStore((s) => s.getItemCount())
  const getTotal = useCartStore((s) => s.getTotal)

  // Guard against hydration mismatch — itemCount comes from localStorage via Zustand
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])

  if (!isMounted || itemCount === 0) return null

  return (
    <button
      onClick={openCart}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-primary-gradient text-white rounded-full shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all animate-slide-up"
      id="floating-cart-button"
    >
      <ShoppingCart className="w-5 h-5" />
      <span className="font-semibold text-sm">{itemCount} ชิ้น</span>
      <span className="font-bold">{formatPrice(getTotal())}</span>
    </button>
  )
}
