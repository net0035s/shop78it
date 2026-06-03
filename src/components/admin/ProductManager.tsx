'use client'

import { Edit, Plus, Trash2 } from 'lucide-react'
import { formatPrice } from '@/lib/products'
import { EmptyState } from './AdminShared'
import type { AdminCategory, AdminProduct } from './AdminTypes'

type Props = {
  products: AdminProduct[]
  categories: AdminCategory[]
  onAddProduct: () => void
  onEditProduct: (product: AdminProduct) => void
  onDeleteProduct: (id: string) => void
}

export function ProductManager({ products, categories, onAddProduct, onEditProduct, onDeleteProduct }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-textPrimary">จัดการสินค้า ({products.length})</h2>
        <button onClick={onAddProduct} className="flex items-center gap-1.5 px-4 py-2 bg-primary-gradient rounded-xl text-white text-sm font-bold btn-glow">
          <Plus className="w-4 h-4" /><span>เพิ่มสินค้า</span>
        </button>
      </div>

      <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 bg-surfaceLight/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">สินค้า</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider hidden md:table-cell">หมวดหมู่</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">ราคา</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">สต็อก</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {products.map((product) => {
                const category = categories.find(c => c.id === product.categoryId || c.slug === product.category)
                return (
                  <tr key={product.id} className="hover:bg-surfaceLight/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-textPrimary text-xs">{product.name}</div>
                      <div className="text-[10px] text-textMuted">{product.deliveryInfo}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {category ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border"
                          style={{ color: category.color, borderColor: category.color + '40', background: category.color + '15' }}>
                          {category.icon} {category.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-textMuted">{product.category}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-xs font-bold text-textPrimary">{formatPrice(product.price)}</div>
                      {product.originalPrice && <div className="text-[10px] text-textMuted line-through">{formatPrice(product.originalPrice)}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                        product.stockStatus === 'out-of-stock' ? 'bg-red-500/10 text-red-400'
                          : product.stockStatus === 'low-stock' ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => onEditProduct(product)} className="p-1.5 text-textMuted hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDeleteProduct(product.id)} className="p-1.5 text-textMuted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {products.length === 0 && <tr><td colSpan={5}><EmptyState text="ยังไม่มีสินค้า" /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
