'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, ShoppingBag, X } from 'lucide-react'

interface RecentOrder {
  id: string
  maskedName: string
  productName: string
  timeAgo: string
}

function getRandomDelay() {
  return 15000 + Math.floor(Math.random() * 15000)
}

export function RecentPurchases() {
  const [orders, setOrders] = useState<RecentOrder[]>([])
  const [currentOrder, setCurrentOrder] = useState<RecentOrder | null>(null)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    showTimerRef.current = null
    hideTimerRef.current = null
  }, [])

  const showNext = useCallback((sourceOrders: RecentOrder[]) => {
    if (sourceOrders.length === 0) return
    const nextOrder = sourceOrders[Math.floor(Math.random() * sourceOrders.length)]
    setCurrentOrder(nextOrder)
    setVisible(true)

    hideTimerRef.current = setTimeout(() => {
      setVisible(false)
      showTimerRef.current = setTimeout(() => showNext(sourceOrders), getRandomDelay())
    }, 5000)
  }, [])

  useEffect(() => {
    if (sessionStorage.getItem('hideSocialProof') === 'true') {
      setDismissed(true)
      return
    }

    let alive = true

    fetch('/api/orders/recent')
      .then((res) => res.json())
      .then((result) => {
        if (!alive) return
        const realOrders = result.success && Array.isArray(result.data) ? result.data : []
        if (realOrders.length === 0) {
          setOrders([])
          return
        }

        setOrders(realOrders)
        showTimerRef.current = setTimeout(() => showNext(realOrders), 4000)
      })
      .catch(() => {
        if (!alive) return
        setOrders([])
      })

    return () => {
      alive = false
      clearTimers()
    }
  }, [clearTimers, showNext])

  const handleDismiss = () => {
    sessionStorage.setItem('hideSocialProof', 'true')
    clearTimers()
    setVisible(false)
    setDismissed(true)
  }

  if (dismissed || orders.length === 0 || !currentOrder) return null

  return (
    <div
      className={[
        'fixed bottom-4 left-4 z-40 w-[calc(100vw-2rem)] max-w-[320px]',
        'transition-all duration-500 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none',
      ].join(' ')}
      role="status"
      aria-live="polite"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-surface/95 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="flex items-start gap-3 p-4 pr-10">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <ShoppingBag className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-surface bg-emerald-400" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              มีออเดอร์ใหม่
            </div>
            <p className="text-sm font-semibold leading-snug text-textPrimary">
              ลูกค้า {currentOrder.maskedName} เพิ่งสั่งซื้อ
            </p>
            <p className="mt-0.5 truncate text-xs text-textSecondary">{currentOrder.productName}</p>
            <p className="mt-1 text-[11px] text-textMuted">{currentOrder.timeAgo}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-2.5 top-2.5 rounded-lg p-1 text-textMuted transition-colors hover:bg-surfaceLight hover:text-textPrimary"
          aria-label="ปิดป๊อปอัพ"
        >
          <X className="h-4 w-4" />
        </button>

        {visible && (
          <div className="h-0.5 overflow-hidden bg-surfaceLight">
            <div className="h-full origin-left bg-primary/70" style={{ animation: 'progress-bar 5s linear forwards' }} />
          </div>
        )}
      </div>
    </div>
  )
}
