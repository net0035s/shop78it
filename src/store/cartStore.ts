import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { CartItem, Product } from '@/types'

export interface DiscountState {
  code: string
  type: 'PERCENT' | 'FIXED'
  value: number
  minPurchaseAmount?: number
  amount?: number
}

interface CartStore {
  items: CartItem[]
  isOpen: boolean
  discount: DiscountState | null
  discountRemovalReason: string | null

  // Actions
  addItem: (product: Product, quantity?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  toggleCart: () => void
  openCart: () => void
  closeCart: () => void
  applyDiscount: (discount: DiscountState) => void
  removeDiscount: () => void
  clearDiscountRemovalReason: () => void

  // Computed for UI preview only. The real order total is recalculated on the server.
  getSubTotal: () => number
  getDiscountAmount: () => number
  getTotal: () => number
  getItemCount: () => number
  getItemQuantity: (productId: string) => number
}

function getCartStockLimit(product: Product): number {
  return Math.max(0, Math.min(product.stock || 0, 100))
}

function getSubTotalFromItems(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
}

function clearInvalidDiscount(items: CartItem[], discount: DiscountState | null) {
  if (discount) return { discount: null, discountRemovalReason: 'ตะกร้าเปลี่ยนแล้ว กรุณาใช้คูปองอีกครั้งเพื่อตรวจสิทธิ์ล่าสุด' }

  return { discount, discountRemovalReason: null }
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      discount: null,
      discountRemovalReason: null,

      addItem: (product, quantity = 1) => {
        if (!Number.isSafeInteger(quantity) || quantity < 1 || getCartStockLimit(product) === 0) return
        set((state) => {
          const existing = state.items.find((i) => i.product.id === product.id)
          const stock = getCartStockLimit(product)
          if (existing) {
            return {
              ...clearInvalidDiscount(state.items, state.discount),
              items: state.items.map((i) =>
                i.product.id === product.id
                  ? { ...i, quantity: Math.min(i.quantity + quantity, stock), product }
                  : i
              ),
            }
          }
          return { items: [...state.items, { product, quantity: Math.min(quantity, stock) }], ...clearInvalidDiscount(state.items, state.discount) }
        })
      },

      removeItem: (productId) => {
        set((state) => {
          const items = state.items.filter((i) => i.product.id !== productId)
          return {
            items,
            ...clearInvalidDiscount(items, state.discount),
          }
        })
      },

      updateQuantity: (productId, quantity) => {
        if (!Number.isSafeInteger(quantity)) return
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        set((state) => {
          const items = state.items.map((i) => {
            if (i.product.id === productId) {
              const stock = getCartStockLimit(i.product)
              return { ...i, quantity: Math.min(quantity, stock) }
            }
            return i
          })

          return {
            items,
            ...clearInvalidDiscount(items, state.discount),
          }
        })
      },

      clearCart: () => set({ items: [], discount: null, discountRemovalReason: null }),

      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      applyDiscount: (discount) => set({ discount, discountRemovalReason: null }),
      removeDiscount: () => set({ discount: null, discountRemovalReason: null }),
      clearDiscountRemovalReason: () => set({ discountRemovalReason: null }),

      getSubTotal: () => {
        return get().items.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0
        )
      },

      getDiscountAmount: () => {
        const subTotal = get().getSubTotal()
        const discount = get().discount
        if (!discount) return 0
        return Math.min(Math.max(discount.amount || 0, 0), subTotal)
      },

      getTotal: () => {
        const subTotal = get().getSubTotal()
        const discountAmount = get().getDiscountAmount()
        return Math.max(0, subTotal - discountAmount)
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0)
      },

      getItemQuantity: (productId) => {
        const item = get().items.find((i) => i.product.id === productId)
        return item?.quantity ?? 0
      },
    }),
    {
      name: 'shopauto-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        isOpen: state.isOpen,
        discount: state.discount,
      }),
    }
  )
)
