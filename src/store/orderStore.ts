import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { OrderSummary } from '@/types'

// ─── Client-side: เก็บ order ปัจจุบัน ───────────────────────────────────────
interface OrderStore {
  currentOrder: OrderSummary | null
  currentOrderNumber: string | null
  orderHistory: string[]
  setOrder: (order: OrderSummary) => void
  clearOrder: () => void
  addOrderToHistory: (orderNumber: string) => void
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set) => ({
      currentOrder: null,
      currentOrderNumber: null,
      orderHistory: [],
      setOrder: (order) => set({ currentOrder: order, currentOrderNumber: order.orderNumber }),
      clearOrder: () => set({ currentOrder: null, currentOrderNumber: null }),
      addOrderToHistory: (orderNumber) => 
        set((state) => {
          if (state.orderHistory.includes(orderNumber)) return state
          return { orderHistory: [orderNumber, ...state.orderHistory].slice(0, 10) }
        }),
    }),
    {
      name: 'shopauto-order', version: 2,
      partialize: state => ({ currentOrderNumber: state.currentOrderNumber, orderHistory: state.orderHistory }),
      migrate: (stored: any) => ({ currentOrderNumber: stored?.currentOrderNumber || stored?.currentOrder?.orderNumber || null, orderHistory: stored?.orderHistory || [] }),
      onRehydrateStorage: () => () => { localStorage.removeItem('shopauto-guest-orders') },
    }
  )
)
