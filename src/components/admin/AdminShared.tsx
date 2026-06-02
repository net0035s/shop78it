'use client'

import { formatPrice } from '@/lib/products'

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending: { label: 'รอชำระ', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', dot: 'bg-amber-400' },
  completed: { label: 'สำเร็จ', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' },
  needs_manual_delivery: { label: 'รอแอดมินจัดส่ง', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', dot: 'bg-orange-400' },
  cancelled: { label: 'ยกเลิก', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', dot: 'bg-red-400' },
}

export function StockContentParser({ stock }: { stock: any }) {
  let parsed: any = {}
  try {
    parsed = JSON.parse(stock.content)
  } catch {
    parsed = {}
  }

  if (stock.type === 'license-key') {
    return <div className="font-mono text-xs text-primary font-semibold">{parsed.licenseKey || stock.content}</div>
  }

  if (stock.type === 'login-info') {
    return (
      <div className="space-y-0.5">
        <div className="text-xs text-textPrimary">{parsed.email || '-'}</div>
        <div className="font-mono text-[11px] text-textMuted">{parsed.password || '-'}</div>
        {parsed.loginUrl && <div className="text-[10px] text-blue-400 truncate max-w-xs">{parsed.loginUrl}</div>}
      </div>
    )
  }

  if (stock.type === 'login-link') {
    return <div className="text-xs text-blue-400 truncate max-w-xs">{parsed.loginUrl || parsed.url || parsed.link || stock.content}</div>
  }

  if (stock.type === 'ai-credit' || stock.type === 'ai-credit-code' || stock.type === 'credit-code') {
    return (
      <div className="font-mono text-xs text-primary font-semibold">
        {parsed.creditCode || parsed.code || stock.content}
        {parsed.creditAmount && <span className="text-textMuted ml-1">({parsed.creditAmount})</span>}
      </div>
    )
  }

  return <div className="font-mono text-[10px] text-textMuted break-all bg-surfaceLight/30 p-1.5 rounded">{stock.content}</div>
}

export function LineChart({ data }: { data: { label: string; orders: number; revenue: number }[] }) {
  const W = 460
  const H = 120
  const padL = 10
  const padR = 10
  const padT = 16
  const padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const maxOrders = Math.max(...data.map(d => d.orders), 1)
  const pts = data.map((d, i) => ({
    x: padL + (i / (data.length - 1 || 1)) * innerW,
    y: padT + innerH - (d.orders / maxOrders) * innerH,
  }))
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const areaPath = `M${pts[0]?.x},${padT + innerH} ${pts.map(p => `L${p.x},${p.y}`).join(' ')} L${pts[pts.length - 1]?.x},${padT + innerH} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[120px]">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
        <line key={i} x1={padL} x2={W - padR} y1={padT + r * innerH} y2={padT + r * innerH} stroke="rgba(255,255,255,0.05)" />
      ))}
      <path d={areaPath} fill="url(#chartGrad)" />
      <polyline points={polyline} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#6366f1" stroke="#1e1e2e" strokeWidth="2" />)}
      {data.map((d, i) => (
        <text key={i} x={pts[i]?.x} y={H - 4} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)">
          {d.label}
        </text>
      ))}
    </svg>
  )
}

export function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-12 text-center text-textMuted text-sm">{text}</div>
}

export function formatAdminPrice(value: number) {
  return formatPrice(value || 0)
}
