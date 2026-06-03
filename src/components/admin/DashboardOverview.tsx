'use client'

import { AlertTriangle, ChevronRight, Clock, DollarSign, ShieldCheck, TrendingUp, Zap } from 'lucide-react'
import { formatPrice } from '@/lib/products'
import { LineChart, STATUS_CONFIG } from './AdminShared'
import type { AdminOrder, AdminProduct, AdminStats } from './AdminTypes'

type Props = {
  stats: AdminStats | null
  manualDeliveryCount: number
  onShowOrders: () => void
}

export function DashboardOverview({ stats, manualDeliveryCount, onShowOrders }: Props) {
  const last7Days = stats?.last7Days ?? []
  const lowStockProducts = stats?.lowStockProducts ?? []
  const recentOrders = stats?.recentOrders ?? []
  const cards = [
    { label: 'รายได้วันนี้', value: formatPrice(stats?.todayRevenue ?? 0), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'รายได้เดือนนี้', value: formatPrice(stats?.monthRevenue ?? 0), icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'รอดำเนินการ', value: `${stats?.pendingOrders ?? 0} รายการ`, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'สต็อกใกล้หมด', value: `${lowStockProducts.length} สินค้า`, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  ]

  return (
    <div className="space-y-6">
      {manualDeliveryCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-orange-400">มี {manualDeliveryCount} ออเดอร์ที่ต้องให้แอดมินจัดส่ง</p>
            <p className="text-xs text-textMuted mt-0.5">กรุณาเข้าไปตรวจที่แท็บออเดอร์</p>
          </div>
          <button onClick={onShowOrders} className="text-xs text-orange-400 font-bold hover:underline flex items-center gap-1">
            ดูออเดอร์ <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="glass-card p-4 rounded-2xl border border-border/50 space-y-3">
              <div className={`inline-flex w-9 h-9 rounded-xl ${card.bg} items-center justify-center`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div>
                <div className={`text-xl font-extrabold ${card.color}`}>{card.value}</div>
                <div className="text-[11px] text-textMuted">{card.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-5 rounded-2xl border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-textPrimary">ยอดออเดอร์ 7 วันล่าสุด</h3>
              <p className="text-xs text-textMuted">แสดงจำนวนออเดอร์ต่อวัน</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
              <Zap className="w-3 h-3" /><span>Live</span>
            </div>
          </div>
          {last7Days.length > 0 ? (
            <LineChart data={last7Days} />
          ) : (
            <div className="h-[120px] flex items-center justify-center text-textMuted text-sm">ยังไม่มีข้อมูลออเดอร์</div>
          )}
        </div>

        <div className="glass-card p-5 rounded-2xl border border-border/50">
          <h3 className="text-sm font-bold text-textPrimary mb-1">สต็อกใกล้หมด</h3>
          <p className="text-xs text-textMuted mb-4">สินค้าที่มีสต็อกไม่เกิน 5 ชิ้น</p>
          {lowStockProducts.length === 0 ? (
            <div className="text-center py-6">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs text-textMuted">สต็อกสินค้าปกติ</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockProducts.map((p: AdminProduct & { unsoldCount: number }) => (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-xl bg-surfaceLight/30">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${p.unsoldCount === 0 ? 'bg-red-400' : 'bg-amber-400'}`} />
                  <p className="flex-1 min-w-0 text-xs font-medium text-textPrimary truncate">{p.name}</p>
                  <span className={`text-xs font-bold ${p.unsoldCount === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                    {p.unsoldCount === 0 ? 'หมด' : `${p.unsoldCount} ชิ้น`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
          <h3 className="text-sm font-bold text-textPrimary">ออเดอร์ล่าสุด</h3>
          <button onClick={onShowOrders} className="text-xs text-primary hover:underline">ดูทั้งหมด</button>
        </div>
        <div className="divide-y divide-border/30">
          {recentOrders.slice(0, 5).map((o: AdminOrder) => {
            const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.pending
            return (
              <div key={o.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-textPrimary">{o.orderNumber}</p>
                  <p className="text-[11px] text-textMuted truncate">{o.customerName}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-textPrimary">{formatPrice(o.total)}</p>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${cfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>
              </div>
            )
          })}
          {recentOrders.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-textMuted">ยังไม่มีออเดอร์</div>
          )}
        </div>
      </div>
    </div>
  )
}
