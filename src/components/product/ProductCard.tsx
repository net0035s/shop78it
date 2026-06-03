'use client'

import Image from 'next/image'
import { ShoppingCart, Zap, Tag, Eye, Clock } from 'lucide-react'
import { Product } from '@/types'
import { StockBadge } from '@/components/ui/StockBadge'
import { useCartStore } from '@/store/cartStore'
import { formatPrice, getDiscountPercent } from '@/lib/products'
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
  // Guard against hydration mismatch — cart quantity comes from Zustand/localStorage
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])
  useEffect(() => { setImageSrc(product.image || FALLBACK_IMAGE) }, [product.image])

  const getItemQuantity = useCartStore((s) => s.getItemQuantity)
  const quantityInCart = getItemQuantity(product.id)
  const isOrderable = canOrder(product.stockStatus)
  const discountPercent =
    product.originalPrice
      ? getDiscountPercent(product.price, product.originalPrice)
      : 0
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
          'group relative flex flex-col rounded-2xl border overflow-hidden transition-all duration-300 cursor-pointer',
          'bg-card-gradient border-border hover:border-primary/40',
          'hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          !isOrderable && 'opacity-70'
        )}
        id={`product-card-${product.id}`}
      >
        {/* Badges Top Row */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between z-10 gap-2">
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

        {/* Product Image */}
        <div className="relative h-48 bg-surfaceLight overflow-hidden">
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
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            onError={() => setImageSrc(FALLBACK_IMAGE)}
          />

          {/* Out of stock overlay */}
          {!isOrderable && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
              <span className="text-textSecondary font-semibold text-sm bg-surface/80 px-4 py-2 rounded-full border border-border">
                สินค้าหมด
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-5 gap-3">
          {/* Category tag */}
          <span className="text-xs text-textMuted uppercase tracking-wide font-medium">
            {product.category === 'digital' && 'สินค้าดิจิทัล'}
            {product.category === 'subscription' && 'Subscription'}
            {product.category === 'voucher' && 'Gift Voucher'}
            {product.category === 'physical' && 'สินค้าทั่วไป'}
          </span>

          {/* Name */}
          <h3 className="text-textPrimary font-semibold text-base leading-snug group-hover:text-primary transition-colors line-clamp-2">
            {product.name}
          </h3>

          {/* Description */}
          <p className="text-textMuted text-sm leading-relaxed line-clamp-2 flex-1">
            {product.description}
          </p>

          {/* Delivery Info */}
          {product.deliveryType === 'manual' ? (
            <div className="flex items-center gap-1.5 text-xs text-orange-400 font-medium">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              รอดำเนินการโดยแอดมิน 👨‍💻
            </div>
          ) : product.deliveryInfo ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <Zap className="w-3.5 h-3.5 shrink-0" />
              {product.deliveryInfo}
            </div>
          ) : null}

          {/* Price Row */}
          <div className="flex items-end justify-between mt-1">
            <div>
              <div className="text-2xl font-bold text-textPrimary">
                {formatPrice(product.price)}
              </div>
              {product.originalPrice && (
                <div className="text-sm text-textMuted line-through">
                  {formatPrice(product.originalPrice)}
                </div>
              )}
            </div>

            {/* Tags */}
            {(() => {
              const tagsArray = Array.isArray(product.tags)
                ? product.tags
                : typeof product.tags === 'string'
                ? product.tags.split(',').map(t => t.trim()).filter(Boolean)
                : []
                
              const filteredTags = product.deliveryType === 'manual'
                ? tagsArray.filter(t => !t.includes('ออโต้') && !t.includes('คีย์'))
                : tagsArray

              if (filteredTags.length === 0) return null
              
              return (
                <div className="flex flex-wrap gap-1 justify-end">
                  {filteredTags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs text-textMuted bg-surfaceLight px-2 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )
            })()}
          </div>

          {/* Action Button: Opens the Modal */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              openProductModal()
            }}
            className={cn(
              'mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200',
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

      {/* Product Modal Popup */}
      <ProductModal
        product={product}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
