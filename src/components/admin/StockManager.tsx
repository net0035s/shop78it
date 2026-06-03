'use client'

import React from 'react'
import { Edit, Trash2, Upload } from 'lucide-react'
import { formatDateWithTime } from '@/lib/utils'
import { EmptyState, StockContentParser } from './AdminShared'
import type { AdminDigitalStock, AdminProduct, AdminStockContent } from './AdminTypes'

type StockForm = {
  productId: string
  type: string
  bulkData: string
  instructions: string
}

type Props = {
  mode: 'manage' | 'history'
  products: AdminProduct[]
  stockForm: StockForm
  setStockForm: React.Dispatch<React.SetStateAction<StockForm>>
  isStockSubmitting: boolean
  stockMsg: string
  digitalStocks: AdminDigitalStock[]
  isFetchingStocks: boolean
  editingStockItem: AdminDigitalStock | null
  setEditingStockItem: React.Dispatch<React.SetStateAction<AdminDigitalStock | null>>
  editingStockContent: AdminStockContent
  setEditingStockContent: React.Dispatch<React.SetStateAction<AdminStockContent>>
  fileInputRef: React.RefObject<HTMLInputElement>
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onSubmitStock: (event: React.FormEvent) => void
  onDeleteStockItem: (id: string) => void
  onUpdateStockItem: (id: string) => void
  stockHistory: AdminDigitalStock[]
  historyPage: number
  historyTotalPages: number
  setHistoryPage: React.Dispatch<React.SetStateAction<number>>
  isFetchingHistory: boolean
}

export function StockManager(props: Props) {
  if (props.mode === 'history') {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-bold text-textPrimary">ประวัติสต็อกสินค้า</h2>
        <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
          {props.isFetchingHistory ? (
            <EmptyState text="กำลังโหลดประวัติสต็อก..." />
          ) : props.stockHistory.length === 0 ? (
            <EmptyState text="ยังไม่มีประวัติสต็อก" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/50 bg-surfaceLight/30">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold text-textMuted">สินค้า</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-textMuted">ข้อมูล</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-textMuted">ออเดอร์ที่สั่งซื้อ</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-textMuted">วันที่</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {props.stockHistory.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-xs text-textPrimary">{item.product?.name || '-'}</td>
                      <td className="px-4 py-3"><StockContentParser stock={item} /></td>
                      <td className="px-4 py-3 text-xs font-mono text-primary">{item.order?.orderNumber || item.orderId || '-'}</td>
                      <td className="px-4 py-3 text-right text-xs text-textMuted">{item.createdAt ? formatDateWithTime(item.createdAt) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {props.historyTotalPages > 1 && (
            <div className="p-4 border-t border-border/50 flex items-center justify-end gap-2">
              <button
                disabled={props.historyPage === 1}
                onClick={() => props.setHistoryPage(page => Math.max(1, page - 1))}
                className="px-3 py-1.5 text-xs font-bold bg-surfaceLight border border-border rounded-lg disabled:opacity-30"
              >
                ก่อนหน้า
              </button>
              <span className="text-xs text-textMuted">Page {props.historyPage} of {props.historyTotalPages}</span>
              <button
                disabled={props.historyPage === props.historyTotalPages}
                onClick={() => props.setHistoryPage(page => Math.min(props.historyTotalPages, page + 1))}
                className="px-3 py-1.5 text-xs font-bold bg-surfaceLight border border-border rounded-lg disabled:opacity-30"
              >
                ถัดไป
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 w-full">
      <h2 className="text-base font-bold text-textPrimary">จัดการสต็อกสินค้าดิจิทัล</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="glass-card p-6 rounded-2xl border border-border/50">
          <form onSubmit={props.onSubmitStock} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-textMuted uppercase tracking-wider mb-2">เลือกสินค้า</label>
              <select
                value={props.stockForm.productId}
                onChange={event => props.setStockForm(form => ({ ...form, productId: event.target.value }))}
                required
                className="w-full px-3 py-2.5 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60"
              >
                <option value="">เลือกสินค้า</option>
                {props.products.map(product => <option key={product.id} value={product.id}>{product.name} (สต็อก: {product.stock})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-textMuted uppercase tracking-wider mb-2">ประเภทสต็อก</label>
              <select
                value={props.stockForm.type}
                onChange={event => props.setStockForm(form => ({ ...form, type: event.target.value }))}
                className="w-full px-3 py-2.5 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60"
              >
                <option value="login-info">Email + Password</option>
                <option value="license-key">License Key</option>
                <option value="login-link">Login Link</option>
                <option value="ai-credit">AI Credit Code</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-textMuted uppercase tracking-wider">ข้อมูลสต็อก</label>
                <button type="button" onClick={() => props.fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <Upload className="w-3.5 h-3.5" /> อัปโหลดไฟล์
                </button>
              </div>
              <input ref={props.fileInputRef} type="file" accept=".txt,.csv" className="hidden" onChange={props.onFileUpload} />
              <textarea
                rows={8}
                value={props.stockForm.bulkData}
                onChange={event => props.setStockForm(form => ({ ...form, bulkData: event.target.value }))}
                required
                placeholder="วางข้อมูล 1 รายการต่อ 1 บรรทัด"
                className="w-full px-3 py-2.5 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60 font-mono resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-textMuted uppercase tracking-wider mb-2">คำแนะนำเพิ่มเติม</label>
              <input
                value={props.stockForm.instructions}
                onChange={event => props.setStockForm(form => ({ ...form, instructions: event.target.value }))}
                className="w-full px-3 py-2.5 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60"
              />
            </div>

            {props.stockMsg && <div className="text-xs text-textSecondary bg-surfaceLight/30 border border-border/40 rounded-xl p-3">{props.stockMsg}</div>}

            <button disabled={props.isStockSubmitting} type="submit" className="w-full py-2.5 bg-primary-gradient rounded-xl text-white font-bold text-sm btn-glow disabled:opacity-50">
              {props.isStockSubmitting ? 'กำลังบันทึก...' : 'เติมสต็อก'}
            </button>
          </form>
        </div>

        <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/40">
            <h3 className="text-sm font-bold text-textPrimary">สต็อกที่ยังพร้อมขาย</h3>
          </div>
          {props.isFetchingStocks ? (
            <EmptyState text="กำลังโหลดสต็อก..." />
          ) : props.digitalStocks.length === 0 ? (
            <EmptyState text="เลือกสินค้าเพื่อดูสต็อก หรือยังไม่มีสต็อก" />
          ) : (
            <div className="divide-y divide-border/30 max-h-[540px] overflow-y-auto">
              {props.digitalStocks.map(stock => (
                <div key={stock.id} className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {props.editingStockItem?.id === stock.id ? (
                      <textarea
                        rows={4}
                        value={JSON.stringify(props.editingStockContent, null, 2)}
                        onChange={event => {
                          try {
                            props.setEditingStockContent(JSON.parse(event.target.value))
                          } catch {
                            props.setEditingStockContent(event.target.value)
                          }
                        }}
                        className="w-full px-3 py-2 bg-surfaceLight/40 border border-border rounded-xl text-xs text-textPrimary font-mono"
                      />
                    ) : (
                      <StockContentParser stock={stock} />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {props.editingStockItem?.id === stock.id ? (
                      <button onClick={() => props.onUpdateStockItem(stock.id)} className="px-2 py-1 text-xs text-primary bg-primary/10 rounded-lg">บันทึก</button>
                    ) : (
                      <button onClick={() => {
                        props.setEditingStockItem(stock)
                        try {
                          props.setEditingStockContent(JSON.parse(stock.content))
                        } catch {
                          props.setEditingStockContent(stock.content)
                        }
                      }} className="p-1.5 text-textMuted hover:text-primary hover:bg-primary/10 rounded-lg">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => props.onDeleteStockItem(stock.id)} className="p-1.5 text-textMuted hover:text-red-400 hover:bg-red-500/10 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
