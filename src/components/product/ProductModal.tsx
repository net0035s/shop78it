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

        <div className="flex flex-col gap-8 overflow-y-auto flex-1">
          <div className="relative h-64 sm:h-80 md:h-[460px] bg-surfaceLight flex items-center justify-center overflow-hidden border-b border-border/50 shrink-0 w-full max-w-3xl mx-auto">
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

          <div className="w-full max-w-3xl mx-auto px-6 sm:px-8 pb-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <span className="text-xs font-bold text-primary uppercase tracking-wider block">
                {product.category === 'digital' && 'สินค้าดิจิทัล'}
                {product.category === 'subscription' && 'สมัครสมาชิกพรีเมียม'}
                {product.category === 'voucher' && 'Gift Voucher / บัตรเติมเงิน'}
                {product.category === 'physical' && 'สินค้าทั่วไป'}
              </span>

              <h2 className="text-xl sm:text-2xl font-extrabold text-textPrimary tracking-tight leading-snug">
                {product.name}
              </h2>

              <div className="flex flex-wrap items-center gap-3">
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
                      className="px-2.5 py-1 bg-surfaceLight border border-border/80 text-textMuted text-xs rounded-lg font-medium"
                    >
                      #{tag}
                    </span>
                  ))
                })()}
              </div>

            </div>

            <div className="space-y-4 pt-4 border-t border-border/60">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <span className="block text-[10px] text-textMuted font-bold uppercase tracking-wider mb-0.5">
                    ราคาพิเศษ
                  </span>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-textPrimary tracking-tight">
                      {formatPrice(product.price)}
                    </span>
                    {product.originalPrice && (
                      <span className="text-sm text-textMuted line-through font-medium">
                        {formatPrice(product.originalPrice)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right text-xs text-textMuted">
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
                  'w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl font-bold text-sm tracking-wide transition-all duration-200 shadow-lg shadow-primary/20',
                  isOrderable
                    ? isAdding
                      ? 'bg-accent/20 text-accent border border-accent/30 cursor-wait'
                      : 'bg-primary-gradient text-white hover:opacity-90 active:scale-[0.98] btn-glow'
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

              <div className="grid grid-cols-1 gap-4 pt-2">
                <section className="space-y-1.5">
                  <span className="block text-[10px] text-textMuted font-bold uppercase tracking-wider">
                    รายละเอียดสินค้า
                  </span>
                  <p className="text-sm text-textSecondary leading-relaxed whitespace-pre-line bg-surfaceLight/30 border border-border/40 p-4 rounded-xl min-h-[140px]">
                    {product.description}
                  </p>
                </section>

                {shouldShowInstruction && (
                  <section className="space-y-1.5">
                    <span className="block text-[10px] text-textMuted font-bold uppercase tracking-wider">
                      วิธีใช้งาน
                    </span>
                    <div className="text-sm text-textSecondary leading-relaxed whitespace-pre-line bg-surfaceLight/30 border border-border/40 p-4 rounded-xl">
                      {productInstruction}
                    </div>
                  </section>
                )}

                {shouldShowFeatures && (
                  <section className="space-y-2">
                    <span className="block text-[10px] text-textMuted font-bold uppercase tracking-wider">
                      สิ่งที่จะได้รับ
                    </span>
                    <div className="bg-surfaceLight/30 border border-border/40 p-4 rounded-xl">
                      {featureItems.length > 0 ? (
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {featureItems.map((item) => (
                            <li key={item} className="flex gap-2 text-xs text-textSecondary leading-relaxed">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-textMuted leading-relaxed">
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
