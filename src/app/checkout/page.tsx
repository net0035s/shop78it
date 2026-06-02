'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CreditCard, ArrowLeft, ShieldCheck, Check, ShoppingBag, Tag, Loader2, X } from 'lucide-react'
import Link from 'next/link'
import { useCartStore } from '@/store/cartStore'
import { useOrderStore } from '@/store/orderStore'
import { formatPrice } from '@/lib/products'
import { toast } from 'react-hot-toast'
import CustomerForm from '@/components/checkout/CustomerForm'
import PaymentQR from '@/components/checkout/PaymentQR'
import { CheckoutFormData, OrderSummary } from '@/types'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n'

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()

  // Read store values via selector - Zustand re-renders on change
  const items = useCartStore((s) => s.items)
  const discount = useCartStore((s) => s.discount)
  const getSubTotal = useCartStore((s) => s.getSubTotal)
  const getDiscountAmount = useCartStore((s) => s.getDiscountAmount)
  const getTotal = useCartStore((s) => s.getTotal)
  const clearCart = useCartStore((s) => s.clearCart)
  const applyDiscount = useCartStore((s) => s.applyDiscount)
  const removeDiscount = useCartStore((s) => s.removeDiscount)
  const { setOrder, addOrderToHistory } = useOrderStore()

  const [step, setStep] = useState<'info' | 'payment'>('info')
  const [customerInfo, setCustomerInfo] = useState<CheckoutFormData | null>(null)
  const [createdOrder, setCreatedOrder] = useState<OrderSummary | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Discount UI State
  const [discountCodeInput, setDiscountCodeInput] = useState('')
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false)
  const [discountError, setDiscountError] = useState('')

  const handleApplyDiscount = async () => {
    const codeToApply = discountCodeInput.trim()
    if (!codeToApply) return
    setIsApplyingDiscount(true)
    setDiscountError('')

    try {
      const response = await fetch('/api/discount/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeToApply,
          items: items.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        }),
      })
      const result = await response.json()

      if (!result.success) {
        setDiscountError(result.error || 'โค้ดส่วนลดใช้ไม่ได้')
        return
      }

      applyDiscount(result.data)
      setDiscountCodeInput('')
    } catch (error) {
      setDiscountError('ตรวจสอบโค้ดไม่ได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsApplyingDiscount(false)
    }
  }

  // Hydration safety — must wait for Zustand to restore from localStorage
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-textMuted">กำลังโหลดหน้าชำระเงิน...</p>
        </div>
      </div>
    )
  }

  // Calculate pricing — always derived from store (never hardcoded)
  const subtotal = getSubTotal()
  const discountAmount = getDiscountAmount()
  const totalAmount = getTotal()

  // If no items in cart and not in payment step, redirect or show empty state
  if (items.length === 0 && step === 'info') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center animate-fade-in">
        <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-3xl bg-surfaceLight border border-border/60">
          <CreditCard className="w-8 h-8 text-textMuted opacity-50" />
        </div>
        <h1 className="text-2xl font-extrabold text-textPrimary tracking-tight">{t('checkout.empty')}</h1>
        <p className="text-textMuted text-sm mt-2">กรุณาเลือกซื้อสินค้าและเพิ่มลงในตะกร้าก่อนดำเนินการชำระเงิน</p>
        <div className="mt-8">
          <Link
            href="/#products"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-gradient text-white font-bold text-sm tracking-wide shadow-lg shadow-primary/20 transition-all"
          >
            ไปหน้าสินค้า
          </Link>
        </div>
      </div>
    )
  }

  const handleCustomerSubmit = async (formData: CheckoutFormData) => {
    setIsCreatingOrder(true)
    try {
      setCustomerInfo(formData)

      // 1. Create order on the server
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          customer: formData,
          discountCode: discount?.code || null,
        }),
      })

      const result = await response.json()

      if (result.success) {
        const orderData: OrderSummary = {
          orderNumber: result.data.orderNumber,
          items,
          customer: formData,
          total: result.data.total,
          status: 'pending',
          createdAt: result.data.createdAt,
        }

        setCreatedOrder(orderData)
        setOrder(orderData) // save to client store
        setStep('payment')
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาดในการสร้างคำสั่งซื้อ')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      toast.error('ไม่สามารถสร้างคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsCreatingOrder(false)
    }
  }

  const handlePaymentConfirm = async (slipFile: File) => {
    if (!createdOrder) return

    setIsVerifying(true)
    try {
      // 2. Upload slip and verify order
      const formData = new FormData()
      formData.append('orderId', createdOrder.orderNumber)
      formData.append('slip', slipFile)
      formData.append('cartItems', JSON.stringify(items))

      const response = await fetch('/api/slip', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success && result.data.isValid) {
        // Save the completed order (which has delivery items!) to our client Zustand store
        const completedOrder: OrderSummary = result.data.order
        setOrder(completedOrder)
        addOrderToHistory(completedOrder.orderNumber)

        // Clear cart
        clearCart()

        // Redirect to thank you
        router.push('/thank-you')
      } else {
        toast.error(result.error || 'ไม่สามารถตรวจสอบสลิปได้ กรุณาตรวจสอบความถูกต้องของสลิปและลองใหม่อีกครั้ง')
      }
    } catch (error) {
      console.error('Error verifying slip:', error)
      toast.error('เกิดข้อผิดพลาดในระบบตรวจจับสลิป กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      {/* Back Button */}
      <Link
        href={step === 'payment' ? '#' : '/cart'}
        onClick={(e) => {
          if (step === 'payment') {
            e.preventDefault()
            setStep('info')
          }
        }}
        className="inline-flex items-center gap-2 text-textMuted hover:text-primary transition-colors text-sm mb-8 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        {step === 'payment' ? 'ย้อนกลับไปแก้ไขข้อมูลผู้ซื้อ' : 'กลับไปยังตะกร้าสินค้า'}
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-3.5">
          <div className="p-2 bg-primary/10 rounded-xl border border-primary/25">
            <CreditCard className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-textPrimary tracking-tight">ชำระเงิน</h1>
            <p className="text-xs sm:text-sm text-textMuted mt-0.5">
              {step === 'info' ? 'กรอกรายละเอียดจัดส่งข้อมูล' : 'สแกน QR Code เพื่อส่งมอบสินค้าทันที'}
            </p>
          </div>
        </div>

        {/* Dynamic Step Indicator */}
        <div className="flex items-center gap-3.5 bg-surfaceLight/30 border border-border/50 px-4 py-2.5 rounded-2xl w-fit">
          {/* Step 1 */}
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step === 'payment'
                ? 'bg-emerald-500 text-white'
                : 'bg-primary text-white ring-4 ring-primary/20'
            }`}>
              {step === 'payment' ? <Check className="w-3.5 h-3.5" /> : '1'}
            </div>
            <span className={`text-xs font-semibold ${
              step === 'payment' ? 'text-emerald-400' : 'text-textPrimary'
            }`}>
              ข้อมูลผู้ซื้อ
            </span>
          </div>

          <div className="w-6 h-px bg-border" />

          {/* Step 2 */}
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
              step === 'payment'
                ? 'bg-primary text-white ring-4 ring-primary/20 border-transparent'
                : 'bg-transparent text-textMuted border-border'
            }`}>
              2
            </div>
            <span className={`text-xs font-semibold ${
              step === 'payment' ? 'text-textPrimary font-bold' : 'text-textMuted'
            }`}>
              ชำระเงินและรับสินค้า
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Form or QR */}
        <div className="lg:col-span-2 space-y-6">
          {step === 'info' ? (
            <CustomerForm
              onSubmit={handleCustomerSubmit}
              initialData={customerInfo || undefined}
              isLoading={isCreatingOrder}
            />
          ) : (
            createdOrder && (
              <PaymentQR
                amount={createdOrder.total}
                orderNumber={createdOrder.orderNumber}
                onConfirm={handlePaymentConfirm}
                isLoading={isVerifying}
              />
            )
          )}
        </div>

        {/* Right Column: Checkout Summary (Sticky) */}
        <div className="lg:sticky lg:top-24 space-y-4">
          <div className="bg-surface border border-border shadow-sm rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-textPrimary border-b border-border/50 pb-3 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" />
              สรุปรายการสั่งซื้อ ({items.length} รายการ)
            </h2>

            {/* Product items mini list */}
            <div className="max-h-56 overflow-y-auto divide-y divide-border/40 pr-1 space-y-3.5">
              {items.map((item) => (
                <div key={item.product.id} className="flex gap-3 pt-3 first:pt-0 items-start">
                  <div className="relative w-12 h-12 bg-surfaceLight rounded-lg overflow-hidden shrink-0 border border-border">
                    <Image
                      src={item.product.image}
                      alt={item.product.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-textPrimary truncate" title={item.product.name}>
                      {item.product.name}
                    </p>
                    <p className="text-[10px] text-textMuted mt-0.5">
                      จำนวน: {item.quantity} ชิ้น
                    </p>
                    <div className="mt-1">
                      {item.product.deliveryType === 'auto' ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">⚡ ส่งด่วนอัตโนมัติ</span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">👨‍💻 แอดมินจัดส่ง</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-textPrimary">
                      {formatPrice(item.product.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Discount Code */}
            <div className="pt-4 border-t border-border/50">
              {discount ? (
                <div className="flex items-center justify-between p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-400" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-emerald-400">ใช้โค้ดสำเร็จแล้ว (-{formatPrice(discountAmount)})</span>
                      <span className="text-[10px] text-emerald-500/70 uppercase">{discount.code}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDiscount()}
                    className="p-1 hover:bg-emerald-500/20 rounded-lg transition-colors group"
                    title="ลบคูปอง"
                  >
                    <X className="w-4 h-4 text-emerald-500 group-hover:text-emerald-400" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
                      <input
                        type="text"
                        placeholder="กรอกโค้ดส่วนลด..."
                        value={discountCodeInput}
                        onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscount()}
                        className="w-full bg-surfaceLight/50 border border-border/60 rounded-xl py-2 pl-9 pr-3 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all uppercase"
                      />
                    </div>
                    <button
                      onClick={handleApplyDiscount}
                      disabled={isApplyingDiscount || !discountCodeInput.trim()}
                      className="px-4 py-2 bg-surfaceLight border border-border/60 text-textPrimary text-sm font-semibold rounded-xl hover:bg-surface hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-w-[70px] flex justify-center items-center"
                    >
                      {isApplyingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ใช้โค้ด'}
                    </button>
                  </div>
                  {discountError && (
                    <p className="text-[10px] text-rose-400 flex items-center gap-1 pl-1">
                      <X className="w-3 h-3" /> {discountError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Calculations */}
            <div className="border-t border-border/50 pt-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-textSecondary">
                <span>ราคารวม</span>
                <span className="font-semibold text-textPrimary">{formatPrice(subtotal)}</span>
              </div>
              {discount && discountAmount > 0 && (
                <div className="flex justify-between text-textSecondary">
                  <span>ส่วนลดคูปอง ({discount.code})</span>
                  <span className="font-semibold text-emerald-400">-{formatPrice(discountAmount)}</span>
                </div>
              )}

              <div className="border-t border-border/50 pt-3.5 flex justify-between items-end text-sm">
                <span className="font-bold text-textPrimary">ยอดชำระสุทธิ</span>
                <span className="text-lg font-extrabold text-primary-light tracking-tight">
                  {formatPrice(totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Secure and Trust Badges */}
          <div className="p-4 border border-emerald-500/10 bg-emerald-500/5 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-textSecondary leading-normal">
              <strong className="text-textPrimary block mb-0.5">รับประกันสินค้าดิจิทัลและรหัส</strong>
              จัดส่งอัตโนมัติ 100% ตลอด 24 ชั่วโมง ตรวจสอบสลิปผ่าน AI OCR อัจฉริยะ ปลอดภัย รวดเร็ว ไม่เกิน 3 วินาที
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto px-4 py-16 flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-textMuted">กำลังโหลดระบบชำระเงิน...</p>
        </div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
