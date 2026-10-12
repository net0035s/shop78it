'use client'

import Image from 'next/image'
import { Zap, Tag, Eye, Clock } from 'lucide-react'
import { Product } from '@/types'
import { StockBadge } from '@/components/ui/StockBadge'
import { useCartStore } from '@/store/cartStore'
import { formatPrice, getDiscountPercent, normalizeProductTags } from '@/lib/products'
import { canOrder } from '@/lib/stock'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import ProductModal from './ProductModal'

const FALLBACK_IMAGE = '/images/products/placeholder.png'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState(product.image || FALLBACK_IMAGE)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => { setImageSrc(product.image || FALLBACK_IMAGE) }, [product.image])

  const getItemQuantity = useCartStore((s) => s.getItemQuantity)
  const quantityInCart = getItemQuantity(product.id)
  const isOrderable = canOrder(product.stockStatus)
  const discountPercent = product.originalPrice
    ? getDiscountPercent(product.price, product.originalPrice)
    : 0
  const salesCount = Math.max(0, product.totalSold ?? 0)
  const openProductModal = () => setIsModalOpen(true)

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openProductModal()
    }
  }

  return (
    <>
      <div
        onClick={openProductModal}
        onKeyDown={handleCardKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`ดูรายละเอียดสินค้า ${product.name}`}
        className={cn(
          'group relative flex min-w-0 h-full flex-col rounded-2xl border overflow-hidden transition-all duration-300 cursor-pointer',
          'bg-card-gradient border-border hover:border-primary',
          'hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          !isOrderable && 'opacity-70'
        )}
        id={`product-card-${product.id}`}
      >
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between z-20 gap-2">
          <div className="flex flex-wrap gap-1.5">
            {product.isNew && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary text-white shadow-lg shadow-primary/30">
                ใหม่
              </span>
            )}
            {discountPercent > 0 && (
              <span className="flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/90 text-white shadow-lg shadow-red-500/30">
                <Tag className="w-2.5 h-2.5" />
                -{discountPercent}%
              </span>
            )}
          </div>
          <StockBadge status={product.stockStatus} size="sm" />
        </div>

        <div className="relative aspect-video shrink-0 bg-surfaceLight overflow-hidden border-b border-border">
          <div className="absolute inset-0 bg-gradient-radial from-primary/20 to-surfaceLight z-0" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/30 z-[11] pointer-events-none" />
          <Image
            src={imageSrc}
            alt={product.name}
            fill
            className={cn(
              'object-cover transition-transform duration-500 z-10',
              isOrderable ? 'group-hover:scale-105' : 'grayscale'
            )}
            sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) 50vw, 360px"
            onError={() => setImageSrc(FALLBACK_IMAGE)}
          />

          {!isOrderable && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px] z-20">
              <span className="px-5 py-2.5 rounded-full bg-red-500/90 border border-white/20 text-white text-lg font-extrabold tracking-wide shadow-2xl shadow-red-950/40 backdrop-blur-sm">
                สินค้าหมด
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col flex-1 p-4 sm:p-5 gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-textMuted font-medium">
              {product.category === 'digital' && 'สินค้าดิจิทัล'}
              {product.category === 'subscription' && 'Subscription'}
              {product.category === 'voucher' && 'Gift Voucher'}
              {product.category === 'physical' && 'สินค้าทั่วไป'}
              {!['digital', 'subscription', 'voucher', 'physical'].includes(product.category) && 'ข้อมูลสินค้า'}
            </span>
            <span className="shrink-0 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              {salesCount} ขายแล้ว
            </span>
          </div>

          <h3 className="min-h-[3rem] text-textPrimary font-semibold text-base leading-6 group-hover:text-primary transition-colors line-clamp-2 [overflow-wrap:anywhere]">
            {product.name}
          </h3>

          <div className="rounded-xl border border-border bg-surfaceLight p-3">
            <p className="min-h-[2.5rem] text-textSecondary text-sm leading-5 line-clamp-2 [overflow-wrap:anywhere]">
              {product.description}
            </p>
          </div>

          {product.deliveryType === 'manual' ? (
            <div className="flex min-h-10 items-center gap-2 text-xs text-orange-500 dark:text-orange-400 font-medium">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              รอดำเนินการโดยแอดมิน
            </div>
          ) : product.deliveryInfo ? (
            <div className="flex min-h-10 items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium [overflow-wrap:anywhere]">
              <Zap className="w-3.5 h-3.5 shrink-0" />
              {product.deliveryInfo}
            </div>
          ) : (
            <div className="flex min-h-10 items-center gap-2 text-xs text-textMuted">
              <Zap className="w-3.5 h-3.5 shrink-0" />
              ส่งผ่านระบบหลังยืนยันการชำระเงิน
            </div>
          )}

          <div className="mt-auto flex min-h-[4.5rem] flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
            <div>
              <div className="text-2xl font-bold tabular-nums text-textPrimary [overflow-wrap:anywhere]">
                {formatPrice(product.price)}
              </div>
              {product.originalPrice && (
                <div className="text-sm text-textMuted line-through">
                  {formatPrice(product.originalPrice)}
                </div>
              )}
            </div>

            {(() => {
              const tagsArray = normalizeProductTags(product.tags)

              const filteredTags = product.deliveryType === 'manual'
                ? tagsArray.filter(t => !t.includes('ออโต้') && !t.includes('คีย์'))
                : tagsArray

              if (filteredTags.length === 0) return null

              return (
                <div className="flex max-w-full flex-wrap gap-1 justify-end">
                  {filteredTags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="max-w-full [overflow-wrap:anywhere] text-xs text-textMuted bg-surfaceLight border border-border px-2 py-0.5 rounded-md"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )
            })()}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              openProductModal()
            }}
            className={cn(
              'mt-1 min-h-11 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200',
              isOrderable
                ? 'bg-primary-gradient text-white shadow-lg shadow-primary/25 hover:shadow-primary/50 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-surfaceLight text-textMuted border border-border cursor-not-allowed'
            )}
            id={`view-details-${product.id}`}
          >
            {isOrderable ? (
              <>
                <Eye className="w-4 h-4" />
                {isMounted && quantityInCart > 0
                  ? `ดูรายละเอียด (ในตะกร้ามี ${quantityInCart})`
                  : 'ดูรายละเอียดสินค้า'}
              </>
            ) : (
              'สินค้าหมดแล้ว'
            )}
          </button>
        </div>
      </div>

      <ProductModal
        product={product}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
