'use client'

import React, { useState, useEffect } from 'react'
import { X, ShoppingCart, Zap, ShieldCheck, Clock, CheckCircle2 } from 'lucide-react'
import { Product } from '@/types'
import { useCartStore } from '@/store/cartStore'
import { formatPrice, getDiscountPercent } from '@/lib/products'
import { canOrder } from '@/lib/stock'
import { StockBadge } from '../ui/StockBadge'
import Image from 'next/image'
import { cn } from '@/lib/utils'

const FALLBACK_IMAGE = '/images/products/placeholder.png'

// Force update UI for Vercel
interface ProductModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
}

type ProductWithOptionalFeatures = Product & {
  features?: unknown
  benefits?: unknown
  includedItems?: unknown
}

function normalizeFeatureItems(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function getProductFeatureItems(product: Product) {
  const productWithFeatures = product as ProductWithOptionalFeatures

  return [
    ...normalizeFeatureItems(productWithFeatures.features),
    ...normalizeFeatureItems(productWithFeatures.benefits),
    ...normalizeFeatureItems(productWithFeatures.includedItems),
  ]
}

export default function ProductModal({ product, isOpen, onClose }: ProductModalProps) {
  const addItem = useCartStore((s) => s.addItem)
  const openCart = useCartStore((s) => s.openCart)
  const getItemQuantity = useCartStore((s) => s.getItemQuantity)
  const [isAdding, setIsAdding] = useState(false)
  const [imageSrc, setImageSrc] = useState(FALLBACK_IMAGE)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    setImageSrc(product?.image || FALLBACK_IMAGE)
  }, [product?.image])

  if (!isOpen || !product) return null

  const isOrderable = canOrder(product.stockStatus)
  const discountPercent = product.originalPrice
    ? getDiscountPercent(product.price, product.originalPrice)
    : 0
  const quantityInCart = getItemQuantity(product.id)
  const stock = product.stock ?? 0
  const salesCount = Math.max(0, product.totalSold ?? 0)
  const featureItems = getProductFeatureItems(product)
  const shouldShowFeatures = product.showFeatures === true
  const shouldShowInstruction = product.showInstruction === true
  const productInstruction = product.instruction?.trim() || 'ยังไม่ได้ระบุวิธีใช้งานสำหรับสินค้านี้'

  const handleAddToCart = async () => {
    if (!isOrderable || isAdding) return
    if (quantityInCart >= stock) {
      alert('คุณหยิบสินค้าใส่ตะกร้าครบตามจำนวนสต็อกที่มีแล้วครับ')
      return
    }
    setIsAdding(true)
    addItem(product)
    await new Promise((r) => setTimeout(r, 600))
    setIsAdding(false)
    openCart()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
      <div className="absolute inset-0 cursor-default" onClick={onClose} />

      <div className="relative w-full max-w-5xl bg-surface border border-border/80 rounded-3xl overflow-hidden shadow-2xl z-10 animate-scale-up max-h-[90vh] flex flex-col">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-surfaceLight/80 hover:bg-surfaceLight text-textMuted hover:text-textPrimary transition-all border border-border/60 hover:scale-105 active:scale-95 z-20"
          aria-label="ปิดหน้าต่าง"
          id="close-product-modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col gap-10 overflow-y-auto flex-1">
          <div className="relative h-64 sm:h-80 md:h-[460px] bg-gradient-to-br from-surfaceLight via-surfaceLight/70 to-background flex items-center justify-center overflow-hidden border-b border-border/40 shrink-0 w-full max-w-4xl mx-auto">
            <div className="absolute inset-0 bg-gradient-radial from-primary/10 to-surfaceLight z-0" />
            <div className="relative w-full h-full p-6 flex items-center justify-center">
              <div className="relative w-4/5 h-4/5 rounded-2xl overflow-hidden shadow-xl border border-border">
                <Image
                  src={imageSrc}
                  alt={product.name}
                  fill
                  className="object-cover z-10"
                  sizes="(max-width: 768px) 100vw, 480px"
                  priority
                  onError={() => setImageSrc(FALLBACK_IMAGE)}
                />
              </div>
            </div>

            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {product.isNew && (
                <span className="text-xs font-bold px-3 py-1 rounded-lg bg-primary text-white shadow-lg shadow-primary/20 w-fit">
                  สินค้าใหม่
                </span>
              )}
              {discountPercent > 0 && (
                <span className="text-xs font-bold px-3 py-1 rounded-lg bg-red-500 text-white shadow-lg shadow-red-500/20 w-fit">
                  ลดราคา -{discountPercent}%
                </span>
              )}
            </div>

            <div className="absolute top-4 right-14">
              <StockBadge status={product.stockStatus} size="md" />
            </div>
          </div>

          <div className="w-full max-w-4xl mx-auto px-6 sm:px-10 pb-10 flex flex-col justify-between space-y-8">
            <div className="space-y-5">
              <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-[11px] font-extrabold text-primary uppercase tracking-wider border border-primary/20">
                {product.category === 'digital' && 'สินค้าดิจิทัล'}
                {product.category === 'subscription' && 'สมัครสมาชิกพรีเมียม'}
                {product.category === 'voucher' && 'Gift Voucher / บัตรเติมเงิน'}
                {product.category === 'physical' && 'สินค้าทั่วไป'}
              </span>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-textPrimary tracking-tight leading-relaxed">
                {product.name}
              </h2>

              <div className="flex flex-wrap items-center gap-2.5">
                {product.deliveryType === 'manual' ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    รอดำเนินการโดยแอดมิน
                  </div>
                ) : product.deliveryInfo ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    <Zap className="w-3.5 h-3.5 shrink-0" />
                    {product.deliveryInfo}
                  </div>
                ) : null}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  {salesCount} ขายแล้ว
                </span>
                {(() => {
                  const tagsArray = Array.isArray(product.tags)
                    ? product.tags
                    : typeof product.tags === 'string'
                    ? product.tags.split(',').map(t => t.trim()).filter(Boolean)
                    : []

                  const filteredTags = product.deliveryType === 'manual'
                    ? tagsArray.filter(t => !t.includes('ออโต้') && !t.includes('คีย์'))
                    : tagsArray

                  return filteredTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 bg-white/[0.03] border border-white/10 text-textMuted text-xs rounded-full font-medium"
                    >
                      #{tag}
                    </span>
                  ))
                })()}
              </div>

            </div>

            <div className="space-y-8 pt-6 border-t border-border/50">
              <div className="rounded-3xl bg-gradient-to-br from-surfaceLight/60 via-surfaceLight/35 to-primary/5 border border-border/50 p-5 sm:p-6 shadow-xl shadow-black/10">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <span className="block text-[10px] text-textMuted font-bold uppercase tracking-wider mb-0.5">
                    ราคาพิเศษ
                  </span>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black text-textPrimary tracking-tight">
                      {formatPrice(product.price)}
                    </span>
                    {product.originalPrice && (
                      <span className="text-base text-textMuted line-through font-medium">
                        {formatPrice(product.originalPrice)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-left sm:text-right text-xs text-textMuted">
                  <span>สถานะคลัง: </span>
                  <strong className="text-textSecondary">
                    {stock > 0 ? `${stock} ชิ้น` : 'สินค้าหมด'}
                  </strong>
                </div>
                </div>

              <button
                onClick={handleAddToCart}
                disabled={!isOrderable || isAdding}
                className={cn(
                  'mt-5 w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-2xl font-extrabold text-sm tracking-wide transition-all duration-300 shadow-lg shadow-primary/20',
                  isOrderable
                    ? isAdding
                      ? 'bg-accent/20 text-accent border border-accent/30 cursor-wait'
                      : 'bg-primary-gradient text-white hover:brightness-110 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-0.5 active:scale-[0.98] btn-glow'
                    : 'bg-surfaceLight text-textMuted border border-border cursor-not-allowed'
                )}
                id="modal-add-to-cart"
              >
                {isAdding ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                    กำลังเพิ่มลงตะกร้า...
                  </>
                ) : isOrderable ? (
                  <>
                    <ShoppingCart className="w-4.5 h-4.5" />
                    {quantityInCart > 0 ? `หยิบใส่ตะกร้าเพิ่มอีก (มีแล้ว ${quantityInCart})` : 'หยิบใส่ตะกร้าเลย'}
                  </>
                ) : (
                  'สินค้าหมดชั่วคราว'
                )}
              </button>
              </div>

              <div className="space-y-10">
                <section className="space-y-3">
                  <span className="block text-xs text-textMuted font-extrabold uppercase tracking-[0.18em]">
                    รายละเอียดสินค้า
                  </span>
                  <p className="text-base text-textSecondary leading-8 whitespace-pre-line">
                    {product.description}
                  </p>
                </section>

                {shouldShowInstruction && (
                  <section className="space-y-3 border-t border-border/40 pt-8">
                    <span className="block text-xs text-textMuted font-extrabold uppercase tracking-[0.18em]">
                      วิธีใช้งาน
                    </span>
                    <div className="text-sm sm:text-base text-zinc-200 leading-8 whitespace-pre-line rounded-2xl bg-zinc-950/80 border border-white/10 p-5 sm:p-6 shadow-inner shadow-black/30">
                      {productInstruction}
                    </div>
                  </section>
                )}

                {shouldShowFeatures && (
                  <section className="space-y-4 border-t border-border/40 pt-8">
                    <span className="block text-xs text-textMuted font-extrabold uppercase tracking-[0.18em]">
                      สิ่งที่จะได้รับ
                    </span>
                    <div>
                      {featureItems.length > 0 ? (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {featureItems.map((item) => (
                            <li key={item} className="flex gap-3 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/15 px-4 py-3 text-sm text-textSecondary leading-relaxed">
                              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-textMuted leading-relaxed rounded-2xl bg-white/[0.03] px-4 py-3">
                          ยังไม่ได้ระบุข้อมูลสิ่งที่จะได้รับ
                        </p>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
