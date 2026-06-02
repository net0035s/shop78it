'use client'

import { useState, useMemo } from 'react'
import { Product } from '@/types'
import { ProductCard } from './ProductCard'
import { Search, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Category {
  id: string
  name: string
  slug: string
  icon: string
  color: string
  sortOrder: number
  isActive: boolean
}

interface ProductGridProps {
  products: Product[]
  categories: Category[]
}

type SortOption = 'default' | 'price-asc' | 'price-desc' | 'new'

export function ProductGrid({ products, categories }: ProductGridProps) {
  const [activeSlug, setActiveSlug] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('default')

  const filteredProducts = useMemo(() => {
    let result = products

    // Filter by category slug
    if (activeSlug !== 'all') {
      result = result.filter((p) => p.category === activeSlug)
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) => {
          const tagsArray = Array.isArray(p.tags) 
            ? p.tags 
            : typeof p.tags === 'string' 
            ? p.tags.split(',') 
            : []
            
          return p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            tagsArray.some((t) => t.toLowerCase().includes(q))
        }
      )
    }

    // Sort by user selection
    switch (sortBy) {
      case 'price-asc':
        result = [...result].sort((a, b) => a.price - b.price)
        break
      case 'price-desc':
        result = [...result].sort((a, b) => b.price - a.price)
        break
      case 'new':
        result = [...result].filter((p) => p.isNew).concat(result.filter((p) => !p.isNew))
        break
    }

    // Always push Out of Stock items to the bottom
    result = [...result].sort((a, b) => {
      const aStockStatus = String(a.stockStatus)
      const bStockStatus = String(b.stockStatus)
      const aOutOfStock = a.stock === 0 || aStockStatus === 'out-of-stock' || aStockStatus === 'OUT_OF_STOCK'
      const bOutOfStock = b.stock === 0 || bStockStatus === 'out-of-stock' || bStockStatus === 'OUT_OF_STOCK'
      if (aOutOfStock && !bOutOfStock) return 1
      if (!aOutOfStock && bOutOfStock) return -1
      return 0
    })

    return result
  }, [products, activeSlug, searchQuery, sortBy])

  // Only show categories that have at least 1 matching product (or show all if empty)
  const activeCategories = categories.filter(
    (c) => c.isActive && products.some((p) => p.category === c.slug)
  )

  return (
    <section id="products" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Section Header */}
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-textPrimary mb-1">สินค้าทั้งหมด</h2>
        <p className="text-textMuted text-sm">{filteredProducts.length} รายการ</p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
          <input
            type="text"
            placeholder="ค้นหาสินค้า..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-surfaceLight border border-border rounded-xl text-sm text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary/60 transition-colors"
            id="product-search"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-textMuted flex-shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-surfaceLight border border-border rounded-xl text-sm text-textPrimary px-3 py-2.5 focus:outline-none focus:border-primary/60 transition-colors cursor-pointer"
            id="product-sort"
          >
            <option value="default">เรียงตามค่าเริ่มต้น</option>
            <option value="price-asc">ราคา: น้อย → มาก</option>
            <option value="price-desc">ราคา: มาก → น้อย</option>
            <option value="new">สินค้าใหม่ก่อน</option>
          </select>
        </div>
      </div>

      {/* Category Tabs — Dynamic from Admin */}
      <div className="flex gap-2 flex-wrap mb-8">
        {/* "ทั้งหมด" button */}
        <button
          onClick={() => setActiveSlug('all')}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
            activeSlug === 'all'
              ? 'bg-primary text-white shadow-lg shadow-primary/25'
              : 'bg-surfaceLight text-textSecondary border border-border hover:border-primary/40 hover:text-textPrimary'
          )}
          id="category-all"
        >
          ทั้งหมด
        </button>

        {/* Dynamic categories from Admin */}
        {activeCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveSlug(cat.slug)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border',
              activeSlug === cat.slug
                ? 'text-white shadow-lg'
                : 'bg-surfaceLight text-textSecondary hover:text-textPrimary'
            )}
            style={
              activeSlug === cat.slug
                ? { background: cat.color, borderColor: cat.color, boxShadow: `0 4px 14px ${cat.color}40` }
                : { borderColor: activeSlug === cat.slug ? cat.color : 'rgba(255,255,255,0.1)' }
            }
            id={`category-${cat.slug}`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-surfaceLight flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-textMuted" />
          </div>
          <h3 className="text-textPrimary font-semibold mb-2">ไม่พบสินค้า</h3>
          <p className="text-textMuted text-sm">ลองค้นหาด้วยคำอื่น หรือเลือกหมวดหมู่อื่น</p>
          <button
            onClick={() => { setSearchQuery(''); setActiveSlug('all') }}
            className="mt-4 text-primary text-sm hover:underline"
          >
            ล้างการค้นหา
          </button>
        </div>
      )}
    </section>
  )
}
