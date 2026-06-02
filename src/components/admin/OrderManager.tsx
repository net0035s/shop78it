'use client'

import { AlertTriangle, Edit } from 'lucide-react'
import { formatPrice } from '@/lib/products'
import { formatDateWithTime } from '@/lib/utils'
import { EmptyState, STATUS_CONFIG } from './AdminShared'

type Props = {
  orders: any[]
  manualDeliveryCount: number
  orderFilter: string
  setOrderFilter: (value: string) => void
  orderSearch: string
  setOrderSearch: (value: string) => void
  orderPage: number
  setOrderPage: React.Dispatch<React.SetStateAction<number>>
  orderPerPage: number
  setOrderPerPage: (value: number) => void
  onEditOrder: (order: any) => void
}

export function OrderManager({
  orders,
  manualDeliveryCount,
  orderFilter,
  setOrderFilter,
  orderSearch,
  setOrderSearch,
  orderPage,
  setOrderPage,
  orderPerPage,
  setOrderPerPage,
  onEditOrder,
}: Props) {
  const filteredOrders = orders
    .filter(order => orderFilter === 'all' || order.status === orderFilter)
    .filter(order => order.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()))
  const totalPages = Math.ceil(filteredOrders.length / orderPerPage)
  const startIndex = (orderPage - 1) * orderPerPage
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + orderPerPage)

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-textPrimary">รายการออเดอร์ทั้งหมด ({orders.length})</h2>
      {manualDeliveryCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-sm text-orange-400 font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          มี {manualDeliveryCount} ออเดอร์รอแอดมินจัดส่ง
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: 'all', label: 'ทั้งหมด' },
            { id: 'needs_manual_delivery', label: 'Manual' },
            { id: 'completed', label: 'สำเร็จ' },
            { id: 'cancelled', label: 'ยกเลิก' },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setOrderFilter(filter.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                orderFilter === filter.id
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-surfaceLight text-textMuted hover:text-textPrimary hover:bg-surfaceLight/80'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="ค้นหาเลขออเดอร์"
            value={orderSearch}
            onChange={event => setOrderSearch(event.target.value)}
            className="w-full px-4 py-2 bg-surfaceLight/40 border border-border/60 rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60 placeholder:text-textMuted/60"
          />
        </div>
      </div>

      <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 bg-surfaceLight/30">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">ออเดอร์</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider hidden md:table-cell">ลูกค้า</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">ยอด</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">สถานะ</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">ดูรายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {paginatedOrders.map(order => {
                const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
                return (
                  <tr key={order.id} className={`hover:bg-surfaceLight/20 transition-colors ${order.status === 'needs_manual_delivery' ? 'bg-orange-500/5' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-xs text-textPrimary">{order.orderNumber}</div>
                      <div className="text-[10px] text-textMuted">{formatDateWithTime(order.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-xs text-textPrimary">{order.customerName}</div>
                      <div className="text-[10px] text-textMuted">{order.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-textPrimary">{formatPrice(order.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => onEditOrder(order)} className="p-1.5 text-textMuted hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="แก้ไขออเดอร์">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {paginatedOrders.length === 0 && <tr><td colSpan={5}><EmptyState text="ไม่พบออเดอร์" /></td></tr>}
            </tbody>
          </table>
        </div>

        {filteredOrders.length > 0 && (
          <div className="p-4 border-t border-border/50 bg-surfaceLight/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-textMuted">
            <div className="flex items-center gap-2">
              <span>แสดง</span>
              <select
                value={orderPerPage}
                onChange={event => setOrderPerPage(Number(event.target.value))}
                className="bg-surfaceLight border border-border rounded px-2 py-1 focus:outline-none focus:border-primary/50 text-textPrimary"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>รายการ</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Page {orderPage} of {totalPages || 1}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setOrderPage(page => Math.max(1, page - 1))}
                  disabled={orderPage === 1}
                  className="px-3 py-1.5 rounded bg-surfaceLight hover:bg-surfaceLight/80 border border-border disabled:opacity-50 text-textPrimary"
                >
                  Prev
                </button>
                <button
                  onClick={() => setOrderPage(page => Math.min(totalPages, page + 1))}
                  disabled={orderPage === totalPages || totalPages === 0}
                  className="px-3 py-1.5 rounded bg-surfaceLight hover:bg-surfaceLight/80 border border-border disabled:opacity-50 text-textPrimary"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
