'use client'

import { Edit, Plus, Trash2 } from 'lucide-react'

type Props = {
  categories: any[]
  products: any[]
  onAddCategory: () => void
  onEditCategory: (category: any) => void
  onDeleteCategory: (id: string) => void
}

export function CategoryManager({ categories, products, onAddCategory, onEditCategory, onDeleteCategory }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-textPrimary">จัดการหมวดหมู่ ({categories.length})</h2>
        <button onClick={onAddCategory} className="flex items-center gap-1.5 px-4 py-2 bg-primary-gradient rounded-xl text-white text-sm font-bold btn-glow">
          <Plus className="w-4 h-4" /><span>เพิ่มหมวดหมู่</span>
        </button>
      </div>

      <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 bg-surfaceLight/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">หมวดหมู่</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider hidden md:table-cell">Slug</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">สินค้า</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">สถานะ</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {[...categories].sort((a, b) => a.sortOrder - b.sortOrder).map(category => {
                const productCount = products.filter(product => product.categoryId === category.id || product.category === category.slug).length
                return (
                  <tr key={category.id} className="hover:bg-surfaceLight/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{category.icon}</span>
                        <div>
                          <div className="text-xs font-bold text-textPrimary">{category.name}</div>
                          <div className="w-16 h-1.5 rounded-full mt-1" style={{ background: category.color }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <code className="text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-md">{category.slug}</code>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-bold text-textPrimary">{productCount}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${category.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {category.isActive ? 'เปิดใช้' : 'ปิดใช้'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => onEditCategory(category)} className="p-1.5 text-textMuted hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDeleteCategory(category.id)} className="p-1.5 text-textMuted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl text-xs text-textMuted">
        <p className="font-bold text-primary mb-1">วิธีใช้งาน</p>
        <p>หมวดหมู่ที่สร้างที่นี่จะแสดงใน Dropdown ตอนเพิ่มหรือแก้ไขสินค้า และแสดงเป็นตัวกรองบนหน้าร้านค้า</p>
      </div>
    </div>
  )
}
