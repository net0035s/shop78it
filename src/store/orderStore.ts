import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { OrderSummary } from '@/types'

// ─── Client-side: เก็บ order ปัจจุบัน ───────────────────────────────────────
interface OrderStore {
  currentOrder: OrderSummary | null
  orderHistory: string[]
  setOrder: (order: OrderSummary) => void
  clearOrder: () => void
  addOrderToHistory: (orderNumber: string) => void
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set) => ({
      currentOrder: null,
      orderHistory: [],
      setOrder: (order) => set({ currentOrder: order }),
      clearOrder: () => set({ currentOrder: null }),
      addOrderToHistory: (orderNumber) => 
        set((state) => {
          if (state.orderHistory.includes(orderNumber)) return state
          return { orderHistory: [orderNumber, ...state.orderHistory].slice(0, 10) }
        }),
    }),
    { name: 'shopauto-order' }
  )
)
