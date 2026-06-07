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
import { CheckoutFormData, OrderSummary } from '@/types'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n'

const FALLBACK_IMAGE = '/images/products/placeholder.png'

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
  const [isSubmittingVoucher, setIsSubmittingVoucher] = useState(false)

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
        setDiscountError(result.error || 'à¹‚à¸„à¹‰à¸”à¸ªà¹ˆà¸§à¸™à¸¥à¸”à¹ƒà¸Šà¹‰à¹„à¸¡à¹ˆà¹„à¸”à¹‰')
        return
      }

      applyDiscount(result.data)
      setDiscountCodeInput('')
    } catch (error) {
      setDiscountError('à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¹‚à¸„à¹‰à¸”à¹„à¸¡à¹ˆà¹„à¸”à¹‰ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡')
    } finally {
      setIsApplyingDiscount(false)
    }
  }

  // Hydration safety â€” must wait for Zustand to restore from localStorage
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-textMuted">à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸«à¸™à¹‰à¸²à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™...</p>
        </div>
      </div>
    )
  }

  // Calculate pricing â€” always derived from store (never hardcoded)
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
        <p className="text-textMuted text-sm mt-2">à¸à¸£à¸¸à¸“à¸²à¹€à¸¥à¸·à¸­à¸à¸‹à¸·à¹‰à¸­à¸ªà¸´à¸™à¸„à¹‰à¸²à¹à¸¥à¸°à¹€à¸žà¸´à¹ˆà¸¡à¸¥à¸‡à¹ƒà¸™à¸•à¸°à¸à¸£à¹‰à¸²à¸à¹ˆà¸­à¸™à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™</p>
        <div className="mt-8">
          <Link
            href="/#products"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-gradient text-white font-bold text-sm tracking-wide shadow-lg shadow-primary/20 transition-all"
          >
            à¹„à¸›à¸«à¸™à¹‰à¸²à¸ªà¸´à¸™à¸„à¹‰à¸²
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
        toast.error(result.error || 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¸ªà¸£à¹‰à¸²à¸‡à¸„à¸³à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      toast.error('à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸ªà¸£à¹‰à¸²à¸‡à¸„à¸³à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­à¹„à¸”à¹‰ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡')
    } finally {
      setIsCreatingOrder(false)
    }
  }

  const handleTrueMoneyPayment = async () => {
    if (!createdOrder) return

    const trimmedVoucherLink = voucherLink.trim()

    if (!trimmedVoucherLink) {
      toast.error('à¸à¸£à¸¸à¸“à¸²à¸§à¸²à¸‡à¸¥à¸´à¸‡à¸à¹Œà¸‹à¸­à¸‡à¸­à¸±à¹ˆà¸‡à¹€à¸›à¸²à¸—à¸£à¸¹à¸¡à¸±à¸™à¸™à¸µà¹ˆà¸à¹ˆà¸­à¸™à¸¢à¸·à¸™à¸¢à¸±à¸™')
      return
    }

    setIsSubmittingVoucher(true)
    try {
      const response = await fetch('/api/payment/truemoney', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

        toast.success('à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆ à¸£à¸°à¸šà¸šà¸à¸³à¸¥à¸±à¸‡à¸žà¸²à¹„à¸›à¸«à¸™à¹‰à¸²à¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²')
        router.push('/thank-you')
      } else {
        toast.error(result.error || 'à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸‹à¸­à¸‡à¸­à¸±à¹ˆà¸‡à¹€à¸›à¸²à¹„à¸”à¹‰ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ')
      }
    } catch (error) {
      console.error('Error redeeming TrueMoney voucher:', error)
      toast.error('à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£à¸¢à¸·à¸™à¸¢à¸±à¸™à¸‹à¸­à¸‡à¸­à¸±à¹ˆà¸‡à¹€à¸›à¸² à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡')
    } finally {
      setIsSubmittingVoucher(false)
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
        {step === 'payment' ? 'à¸¢à¹‰à¸­à¸™à¸à¸¥à¸±à¸šà¹„à¸›à¹à¸à¹‰à¹„à¸‚à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸œà¸¹à¹‰à¸‹à¸·à¹‰à¸­' : 'à¸à¸¥à¸±à¸šà¹„à¸›à¸¢à¸±à¸‡à¸•à¸°à¸à¸£à¹‰à¸²à¸ªà¸´à¸™à¸„à¹‰à¸²'}
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-3.5">
          <div className="p-2 bg-primary/10 rounded-xl border border-primary/25">
            <CreditCard className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-textPrimary tracking-tight">à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™</h1>
            <p className="text-xs sm:text-sm text-textMuted mt-0.5">
              {step === 'info' ? 'à¸à¸£à¸­à¸à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¸ˆà¸±à¸”à¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸¡à¸¹à¸¥' : 'à¸ªà¹à¸à¸™ QR Code à¹€à¸žà¸·à¹ˆà¸­à¸ªà¹ˆà¸‡à¸¡à¸­à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²à¸—à¸±à¸™à¸—à¸µ'}
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
              à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸œà¸¹à¹‰à¸‹à¸·à¹‰à¸­
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
              à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¹à¸¥à¸°à¸£à¸±à¸šà¸ªà¸´à¸™à¸„à¹‰à¸²
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
              <div className="bg-surface border border-border shadow-sm rounded-2xl p-6 sm:p-8 space-y-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                    TrueMoney Angpao
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-textPrimary tracking-tight">
                    à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™à¸”à¹‰à¸§à¸¢à¸‹à¸­à¸‡à¸­à¸±à¹ˆà¸‡à¹€à¸›à¸²à¸—à¸£à¸¹à¸¡à¸±à¸™à¸™à¸µà¹ˆ
                  </h2>
                  <p className="text-sm text-textMuted leading-relaxed">
                    à¸ªà¸£à¹‰à¸²à¸‡à¸‹à¸­à¸‡à¸­à¸±à¹ˆà¸‡à¹€à¸›à¸²à¸•à¸²à¸¡à¸¢à¸­à¸”à¸Šà¸³à¸£à¸° à¹à¸¥à¹‰à¸§à¸§à¸²à¸‡à¸¥à¸´à¸‡à¸à¹Œà¸‹à¸­à¸‡à¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡ à¸£à¸°à¸šà¸šà¸ˆà¸°à¸•à¸£à¸§à¸ˆà¸¢à¸­à¸”à¹€à¸‡à¸´à¸™à¹à¸¥à¸°à¸ªà¹ˆà¸‡à¸ªà¸´à¸™à¸„à¹‰à¸²à¹ƒà¸«à¹‰à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¸—à¸±à¸™à¸—à¸µà¹€à¸¡à¸·à¹ˆà¸­à¸Šà¸³à¸£à¸°à¸ªà¸³à¹€à¸£à¹‡à¸ˆ
                  </p>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-textMuted font-medium">à¸¢à¸­à¸”à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸Šà¸³à¸£à¸°</p>
                      <p className="text-2xl font-extrabold text-primary-light mt-1">
                        {formatPrice(createdOrder.total)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-textMuted font-medium">à¹€à¸¥à¸‚à¸­à¸­à¹€à¸”à¸­à¸£à¹Œ</p>
                      <p className="text-sm font-mono font-bold text-textPrimary mt-1">
                        {createdOrder.orderNumber}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-bold text-textPrimary">
                    à¸¥à¸´à¸‡à¸à¹Œà¸‹à¸­à¸‡à¸­à¸±à¹ˆà¸‡à¹€à¸›à¸²à¸—à¸£à¸¹à¸¡à¸±à¸™à¸™à¸µà¹ˆ
                  </label>
                  <input
                    type="text"
                    value={voucherLink}
                    onChange={(event) => setVoucherLink(event.target.value)}
                    placeholder="à¸§à¸²à¸‡à¸¥à¸´à¸‡à¸à¹Œà¸‹à¸­à¸‡à¸­à¸±à¹ˆà¸‡à¹€à¸›à¸²à¸—à¸µà¹ˆà¸™à¸µà¹ˆ..."
                    className="w-full bg-surfaceLight/50 border border-border/60 rounded-xl px-4 py-3 text-sm text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                    disabled={isSubmittingVoucher}
                  />
                  <p className="text-xs text-textMuted leading-relaxed">
                    à¹€à¸žà¸·à¹ˆà¸­à¸„à¸§à¸²à¸¡à¸›à¸¥à¸­à¸”à¸ à¸±à¸¢ à¸£à¸°à¸šà¸šà¸ˆà¸°à¸£à¸±à¸šà¸Šà¸³à¸£à¸°à¹€à¸‰à¸žà¸²à¸°à¸‹à¸­à¸‡à¸—à¸µà¹ˆà¸¡à¸µà¸¢à¸­à¸”à¹€à¸—à¹ˆà¸²à¸à¸±à¸šà¸«à¸£à¸·à¸­à¸¡à¸²à¸à¸à¸§à¹ˆà¸²à¸¢à¸­à¸”à¸­à¸­à¹€à¸”à¸­à¸£à¹Œà¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™
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
                      à¸à¸³à¸¥à¸±à¸‡à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸‹à¸­à¸‡...
                    </>
                  ) : (
                    'à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™'
                  )}
                </button>
              </div>
            )
          )}
        </div>

        {/* Right Column: Checkout Summary (Sticky) */}
        <div className="lg:sticky lg:top-24 space-y-4">
          <div className="bg-surface border border-border shadow-sm rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-textPrimary border-b border-border/50 pb-3 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" />
              à¸ªà¸£à¸¸à¸›à¸£à¸²à¸¢à¸à¸²à¸£à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­ ({items.length} à¸£à¸²à¸¢à¸à¸²à¸£)
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
                      à¸ˆà¸³à¸™à¸§à¸™: {item.quantity} à¸Šà¸´à¹‰à¸™
                    </p>
                    <div className="mt-1">
                      {item.product.deliveryType === 'auto' ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">âš¡ à¸ªà¹ˆà¸‡à¸”à¹ˆà¸§à¸™à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´</span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">ðŸ‘¨â€ðŸ’» à¹à¸­à¸”à¸¡à¸´à¸™à¸ˆà¸±à¸”à¸ªà¹ˆà¸‡</span>
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
                      <span className="text-xs font-bold text-emerald-400">à¹ƒà¸Šà¹‰à¹‚à¸„à¹‰à¸”à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¹à¸¥à¹‰à¸§ (-{formatPrice(discountAmount)})</span>
                      <span className="text-[10px] text-emerald-500/70 uppercase">{discount.code}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDiscount()}
                    className="p-1 hover:bg-emerald-500/20 rounded-lg transition-colors group"
                    title="à¸¥à¸šà¸„à¸¹à¸›à¸­à¸‡"
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
                        placeholder="à¸à¸£à¸­à¸à¹‚à¸„à¹‰à¸”à¸ªà¹ˆà¸§à¸™à¸¥à¸”..."
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
                      {isApplyingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : 'à¹ƒà¸Šà¹‰à¹‚à¸„à¹‰à¸”'}
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
                <span>à¸£à¸²à¸„à¸²à¸£à¸§à¸¡</span>
                <span className="font-semibold text-textPrimary">{formatPrice(subtotal)}</span>
              </div>
              {discount && discountAmount > 0 && (
                <div className="flex justify-between text-textSecondary">
                  <span>à¸ªà¹ˆà¸§à¸™à¸¥à¸”à¸„à¸¹à¸›à¸­à¸‡ ({discount.code})</span>
                  <span className="font-semibold text-emerald-400">-{formatPrice(discountAmount)}</span>
                </div>
              )}

              <div className="border-t border-border/50 pt-3.5 flex justify-between items-end text-sm">
                <span className="font-bold text-textPrimary">à¸¢à¸­à¸”à¸Šà¸³à¸£à¸°à¸ªà¸¸à¸—à¸˜à¸´</span>
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
              <strong className="text-textPrimary block mb-0.5">à¸£à¸±à¸šà¸›à¸£à¸°à¸à¸±à¸™à¸ªà¸´à¸™à¸„à¹‰à¸²à¸”à¸´à¸ˆà¸´à¸—à¸±à¸¥à¹à¸¥à¸°à¸£à¸«à¸±à¸ª</strong>
              à¸ˆà¸±à¸”à¸ªà¹ˆà¸‡à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´ 100% à¸•à¸¥à¸­à¸” 24 à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡ à¸•à¸£à¸§à¸ˆà¸ªà¸­à¸šà¸ªà¸¥à¸´à¸›à¸œà¹ˆà¸²à¸™ AI OCR à¸­à¸±à¸ˆà¸‰à¸£à¸´à¸¢à¸° à¸›à¸¥à¸­à¸”à¸ à¸±à¸¢ à¸£à¸§à¸”à¹€à¸£à¹‡à¸§ à¹„à¸¡à¹ˆà¹€à¸à¸´à¸™ 3 à¸§à¸´à¸™à¸²à¸—à¸µ
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
          <p className="text-sm text-textMuted">à¸à¸³à¸¥à¸±à¸‡à¹‚à¸«à¸¥à¸”à¸£à¸°à¸šà¸šà¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™...</p>
        </div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
