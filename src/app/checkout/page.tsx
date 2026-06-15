'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CreditCard, ArrowLeft, ShieldCheck, Check, ShoppingBag, Tag, Loader2, X, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useCartStore } from '@/store/cartStore'
import { useOrderStore } from '@/store/orderStore'
import { formatPrice } from '@/lib/products'
import { toast } from 'react-hot-toast'
import CustomerForm from '@/components/checkout/CustomerForm'
import { CheckoutFormData, OrderSummary } from '@/types'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n'
import { QRCodeCanvas } from 'qrcode.react'

const FALLBACK_IMAGE = '/images/products/placeholder.png'
const PROMPTPAY_EXPIRY_SECONDS = 60 * 60

type PaymentChannel = 'truemoney' | 'promptpay'

function getPromptPaySecondsRemaining(createdAt: string) {
  const expiresAt = new Date(createdAt).getTime() + PROMPTPAY_EXPIRY_SECONDS * 1000
  const remainingSeconds = Math.floor((expiresAt - Date.now()) / 1000)

  return Math.max(0, remainingSeconds)
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0')

  return `${minutes}:${remainingSeconds}`
}

function CheckoutItemImage({ src, alt }: { src: string; alt: string }) {
  const [imageSrc, setImageSrc] = useState(src || FALLBACK_IMAGE)

  useEffect(() => {
    setImageSrc(src || FALLBACK_IMAGE)
  }, [src])

  return (
    <div className="relative w-12 h-12 bg-surfaceLight rounded-lg overflow-hidden shrink-0 border border-border">
      <div className="absolute inset-0 bg-gradient-radial from-primary/20 to-surfaceLight z-0" />
      <Image
        src={imageSrc}
        alt={alt}
        fill
        sizes="48px"
        className="object-cover z-10"
        onError={() => setImageSrc(FALLBACK_IMAGE)}
      />
    </div>
  )
}

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
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [voucherLink, setVoucherLink] = useState('')
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>('truemoney')
  const [promptPayPayload, setPromptPayPayload] = useState('')
  const [promptPayError, setPromptPayError] = useState('')
  const [isLoadingPromptPay, setIsLoadingPromptPay] = useState(false)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipError, setSlipError] = useState('')
  const [isSubmittingSlip, setIsSubmittingSlip] = useState(false)
  const [promptPayTimeRemaining, setPromptPayTimeRemaining] = useState(PROMPTPAY_EXPIRY_SECONDS)
  const [isSubmittingVoucher, setIsSubmittingVoucher] = useState(false)
  const [stockErrorMessage, setStockErrorMessage] = useState('')

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
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
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

  useEffect(() => {
    if (!createdOrder || step !== 'payment' || paymentChannel !== 'promptpay') return

    let cancelled = false

    const loadPromptPayQr = async () => {
      setIsLoadingPromptPay(true)
      setPromptPayError('')

      try {
        const response = await fetch('/api/payment/promptpay', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            orderId: createdOrder.orderNumber,
          }),
        })

        const result = await response.json()
        if (cancelled) return

        if (result.success && result.data?.payload) {
          setPromptPayPayload(result.data.payload)
        } else {
          setPromptPayPayload('')
          setPromptPayError(result.error || 'ไม่สามารถสร้าง QR PromptPay ได้')
        }
      } catch (error) {
        if (cancelled) return
        console.error('Error loading PromptPay QR:', error)
        setPromptPayPayload('')
        setPromptPayError('ไม่สามารถโหลด QR PromptPay ได้ กรุณาลองใหม่อีกครั้ง')
      } finally {
        if (!cancelled) setIsLoadingPromptPay(false)
      }
    }

    loadPromptPayQr()

    return () => {
      cancelled = true
    }
  }, [createdOrder, step, paymentChannel])

  useEffect(() => {
    if (!createdOrder || step !== 'payment' || paymentChannel !== 'promptpay') {
      setPromptPayTimeRemaining(PROMPTPAY_EXPIRY_SECONDS)
      return
    }

    const updateRemainingTime = () => {
      setPromptPayTimeRemaining(getPromptPaySecondsRemaining(createdOrder.createdAt))
    }

    updateRemainingTime()
    const timerId = window.setInterval(updateRemainingTime, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [createdOrder, step, paymentChannel])

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
  const isPromptPayExpired = step === 'payment' && paymentChannel === 'promptpay' && promptPayTimeRemaining <= 0
  const promptPayCountdown = formatCountdown(promptPayTimeRemaining)

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
          'Content-Type': 'application/json; charset=utf-8',
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
        setPaymentChannel('truemoney')
        setVoucherLink('')
        setPromptPayPayload('')
        setPromptPayError('')
        setSlipFile(null)
        setSlipError('')
        setStockErrorMessage('')
        setStep('payment')
      } else {
        if (result.code === 'STOCK_UNAVAILABLE') {
          setStockErrorMessage(result.error || 'ขออภัย สินค้าคงเหลือไม่เพียงพอ กรุณาปรับจำนวนในตะกร้า')
        } else {
          toast.error(result.error || 'เกิดข้อผิดพลาดในการสร้างคำสั่งซื้อ')
        }
      }
    } catch (error) {
      console.error('Error creating order:', error)
      toast.error('ไม่สามารถสร้างคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsCreatingOrder(false)
    }
  }

  const handleTrueMoneyPayment = async () => {
    if (!createdOrder) return

    const trimmedVoucherLink = voucherLink.trim()

    if (!trimmedVoucherLink) {
      toast.error('กรุณาวางลิงก์ซองอั่งเปาทรูมันนี่ก่อนยืนยัน')
      return
    }

    setIsSubmittingVoucher(true)
    try {
      const response = await fetch('/api/payment/truemoney', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          orderId: createdOrder.orderNumber,
          voucherLink: trimmedVoucherLink,
        }),
      })

      const result = await response.json()

      if (result.success) {
        const completedOrder: OrderSummary = {
          ...createdOrder,
          status: result.data?.status === 'completed' ? 'completed' : 'processing',
          deliveryItems: result.data?.deliveryItems || [],
        }

        setOrder(completedOrder)
        addOrderToHistory(completedOrder.orderNumber)
        clearCart()

        toast.success('ชำระเงินสำเร็จ ระบบกำลังพาไปหน้ารับสินค้า')
        router.push('/thank-you')
      } else {
        toast.error(result.error || 'ไม่สามารถตรวจสอบซองอั่งเปาได้ กรุณาลองใหม่')
      }
    } catch (error) {
      console.error('Error redeeming TrueMoney voucher:', error)
      toast.error('เกิดข้อผิดพลาดในการยืนยันซองอั่งเปา กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsSubmittingVoucher(false)
    }
  }

  const handleSlipOkPayment = async () => {
    if (!createdOrder) return

    if (getPromptPaySecondsRemaining(createdOrder.createdAt) <= 0) {
      const errorMessage = 'หมดเวลาชำระเงินสำหรับออเดอร์นี้แล้ว กรุณากลับไปทำรายการสั่งซื้อใหม่'
      setSlipError(errorMessage)
      toast.error(errorMessage)
      return
    }

    if (!slipFile) {
      setSlipError('กรุณาอัปโหลดรูปสลิปก่อนยืนยันการชำระเงิน')
      return
    }

    setIsSubmittingSlip(true)
    setSlipError('')

    try {
      const paymentForm = new FormData()
      paymentForm.append('orderId', createdOrder.orderNumber)
      paymentForm.append('files', slipFile)

      const response = await fetch('/api/payment/slipok', {
        method: 'POST',
        body: paymentForm,
      })

      const responseText = await response.text()
      let result: any = null

      try {
        result = responseText ? JSON.parse(responseText) : null
      } catch {
        result = null
      }

      if (result?.success) {
        const completedOrder: OrderSummary = {
          ...createdOrder,
          status: result.data?.status === 'completed' ? 'completed' : 'processing',
          deliveryItems: result.data?.deliveryItems || [],
        }

        setOrder(completedOrder)
        addOrderToHistory(completedOrder.orderNumber)
        clearCart()

        toast.success('ตรวจสลิปสำเร็จ ระบบกำลังพาไปหน้ารับสินค้า')
        router.push('/thank-you')
      } else {
        const errorMessage =
          result?.error ||
          result?.message ||
          (response.status === 404
            ? 'ไม่พบ API ตรวจสลิป กรุณาติดต่อแอดมินเพื่อตรวจสอบระบบ'
            : 'ตรวจสอบสลิปไม่สำเร็จ กรุณาลองใหม่')
        setSlipError(errorMessage)
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Error verifying SlipOK payment:', error)
      const errorMessage = 'เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาลองใหม่อีกครั้ง'
      setSlipError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSubmittingSlip(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      {stockErrorMessage && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/20 bg-surface p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/10 text-amber-300">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-extrabold text-textPrimary">
              สินค้าคงเหลือไม่เพียงพอ
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-textSecondary">
              {stockErrorMessage}
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStockErrorMessage('')}
                className="rounded-xl border border-border bg-surfaceLight/40 px-4 py-3 text-sm font-bold text-textPrimary transition-colors hover:bg-surfaceLight"
              >
                ตกลง
              </button>
              <Link
                href="/cart"
                className="rounded-xl bg-primary-gradient px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:opacity-95"
              >
                กลับไปแก้ไขตะกร้า
              </Link>
            </div>
          </div>
        </div>
      )}

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
              {step === 'info' ? 'กรอกรายละเอียดสำหรับรับสินค้า' : 'เลือกช่องทางชำระเงินและรับสินค้าอัตโนมัติ'}
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
              ยืนยันการชำระเงิน
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Form or Payment */}
        <div className="lg:col-span-2 space-y-6">
          {step === 'info' ? (
            <CustomerForm
              onSubmit={handleCustomerSubmit}
              initialData={customerInfo || undefined}
              isLoading={isCreatingOrder}
            />
          ) : (
            createdOrder && (
              <div className="bg-surface border border-border shadow-sm rounded-2xl p-6 sm:p-8 space-y-6">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                    เลือกช่องทางชำระเงิน
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-textPrimary tracking-tight">
                    ชำระเงินและรับสินค้าทันที
                  </h2>
                  <p className="text-sm text-textMuted leading-relaxed">
                    เลือกชำระผ่านซองอั่งเปาทรูมันนี่ หรือสแกน QR PromptPay แล้วอัปโหลดสลิปให้ระบบตรวจสอบอัตโนมัติ
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentChannel('truemoney')
                      setSlipError('')
                    }}
                    className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                      paymentChannel === 'truemoney'
                        ? 'border-emerald-400/60 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                        : 'border-border bg-surfaceLight/30 hover:border-primary/40'
                    }`}
                  >
                    <span className="block text-sm font-extrabold text-textPrimary">🧧 ซองทรูมันนี่</span>
                    <span className="mt-1 block text-xs text-textMuted">วางลิงก์ซอง ระบบตรวจยอดและจัดส่งสินค้า</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentChannel('promptpay')
                      setPromptPayError('')
                    }}
                    className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                      paymentChannel === 'promptpay'
                        ? 'border-primary/70 bg-primary/10 shadow-lg shadow-primary/10'
                        : 'border-border bg-surfaceLight/30 hover:border-primary/40'
                    }`}
                  >
                    <span className="block text-sm font-extrabold text-textPrimary">💳 สแกน QR โอนเงิน</span>
                    <span className="mt-1 block text-xs text-textMuted">สร้าง QR PromptPay และตรวจสลิปด้วย SlipOK</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-textMuted font-medium">ยอดที่ต้องชำระ</p>
                      <p className="text-2xl font-extrabold text-primary-light mt-1">
                        {formatPrice(createdOrder.total)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-textMuted font-medium">เลขออเดอร์</p>
                      <p className="text-sm font-mono font-bold text-textPrimary mt-1">
                        {createdOrder.orderNumber}
                      </p>
                    </div>
                  </div>
                </div>

                {paymentChannel === 'truemoney' ? (
                  <>
                    <div className="space-y-3">
                      <label className="block text-sm font-bold text-textPrimary">
                        ลิงก์ซองอั่งเปาทรูมันนี่
                      </label>
                      <input
                        type="text"
                        value={voucherLink}
                        onChange={(event) => setVoucherLink(event.target.value)}
                        placeholder="วางลิงก์ซองอั่งเปาที่นี่..."
                        className="w-full bg-surfaceLight/50 border border-border/60 rounded-xl px-4 py-3 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                        disabled={isSubmittingVoucher}
                      />
                      <p className="text-xs text-textMuted leading-relaxed">
                        เพื่อความปลอดภัย ระบบจะรับชำระเฉพาะซองที่มียอดเท่ากับหรือมากกว่ายอดออเดอร์เท่านั้น
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleTrueMoneyPayment}
                      disabled={isSubmittingVoucher || !voucherLink.trim()}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-gradient px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-primary/20 transition-all hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmittingVoucher ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          กำลังตรวจสอบซอง...
                        </>
                      ) : (
                        'ยืนยันการชำระเงิน'
                      )}
                    </button>
                  </>
                ) : (
                  <div className="space-y-5">
                    {isPromptPayExpired ? (
                      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-6 text-center">
                        <p className="text-base font-extrabold text-rose-300">
                          ⏳ หมดเวลาชำระเงินสำหรับออเดอร์นี้แล้ว กรุณากลับไปทำรายการสั่งซื้อใหม่
                        </p>
                        <Link
                          href="/cart"
                          className="mt-4 inline-flex items-center justify-center rounded-xl border border-rose-400/30 px-4 py-2 text-sm font-bold text-rose-200 transition-colors hover:bg-rose-500/10"
                        >
                          กลับไปที่ตะกร้าสินค้า
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-2xl border border-border/60 bg-surfaceLight/30 p-5">
                          <div className="flex flex-col lg:flex-row items-center gap-5">
                            <div className="flex flex-col items-center gap-3">
                              <div className="flex h-64 w-64 items-center justify-center rounded-2xl bg-white p-4 shadow-inner">
                                {isLoadingPromptPay ? (
                                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                ) : promptPayPayload ? (
                                  <div className="relative inline-block">
                                    <QRCodeCanvas
                                      value={promptPayPayload}
                                      size={224}
                                      includeMargin
                                      className="rounded-xl"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                                      <span className="-rotate-45 whitespace-nowrap text-center text-lg font-black text-red-600 opacity-45 drop-shadow-sm">
                                        สำหรับชำระเงินร้าน shop78it เท่านั้น
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="px-4 text-center text-sm font-semibold text-slate-500">
                                    ไม่สามารถสร้าง QR ได้
                                  </p>
                                )}
                              </div>
                              <p className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-extrabold text-amber-300">
                                เหลือเวลาชำระเงิน {promptPayCountdown}
                              </p>
                            </div>
                            <div className="flex-1 space-y-3 text-center lg:text-left">
                              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary-light">
                                PromptPay QR
                              </div>
                              <h3 className="text-lg font-extrabold text-textPrimary">
                                สแกน QR ตามยอดคำสั่งซื้อ
                              </h3>
                              <p className="text-sm leading-relaxed text-textMuted">
                                หลังโอนเงินแล้วให้อัปโหลดรูปสลิปด้านล่าง ระบบ SlipOK จะตรวจยอดเงินและบัญชีผู้รับก่อนจัดส่งสินค้าอัตโนมัติ
                              </p>
                              {promptPayError && (
                                <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">
                                  {promptPayError}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="block text-sm font-bold text-textPrimary">
                            อัปโหลดรูปสลิปโอนเงิน
                          </label>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={(event) => {
                              setSlipFile(event.target.files?.[0] || null)
                              setSlipError('')
                            }}
                            className="block w-full cursor-pointer rounded-xl border border-border/60 bg-surfaceLight/50 text-sm text-textSecondary file:mr-4 file:border-0 file:bg-primary file:px-4 file:py-3 file:text-sm file:font-bold file:text-white hover:file:bg-primary-light"
                            disabled={isSubmittingSlip}
                          />
                          {slipFile && (
                            <p className="text-xs text-emerald-400">
                              เลือกไฟล์แล้ว: {slipFile.name}
                            </p>
                          )}
                          {slipError && (
                            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">
                              {slipError}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleSlipOkPayment}
                          disabled={isSubmittingSlip || !slipFile || !promptPayPayload || isPromptPayExpired}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-gradient px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-primary/20 transition-all hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSubmittingSlip ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              กำลังอัปโหลดและตรวจสลิป...
                            </>
                          ) : (
                            'ยืนยันการชำระเงิน'
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Right Column: Checkout Summary (Sticky) */}
        <div className="lg:sticky lg:top-24 space-y-4">
          <div className="bg-surface border border-border shadow-sm rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-textPrimary border-b border-border/50 pb-3 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" />
              สรุปคำสั่งซื้อ ({items.length} รายการ)
            </h2>

            {/* Product items mini list */}
            <div className="max-h-56 overflow-y-auto divide-y divide-border/40 pr-1 space-y-3.5">
              {items.map((item) => (
                <div key={item.product.id} className="flex gap-3 pt-3 first:pt-0 items-start">
                  <CheckoutItemImage src={item.product.image} alt={item.product.name} />
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
                <span className="font-bold text-textPrimary">ราคาสุทธิ</span>
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
              <strong className="text-textPrimary block mb-0.5">รับประกันสินค้าดิจิทัลและการจัดส่ง</strong>
              จัดส่งอัตโนมัติ 24 ชั่วโมงหลังชำระเงินสำเร็จ หากข้อมูลสินค้าใช้งานไม่ได้ กรุณาติดต่อแอดมินพร้อมเลขออเดอร์เพื่อรับการช่วยเหลือตามเงื่อนไขร้าน
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
