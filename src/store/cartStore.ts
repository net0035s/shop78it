import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { CartItem, Product } from '@/types'

export interface DiscountState {
  code: string
  type: 'PERCENT' | 'FIXED'
  value: number
  minPurchaseAmount?: number
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
  if (product.deliveryType === 'manual') {
    return product.stock && product.stock > 0 ? product.stock : Number.POSITIVE_INFINITY
  }

  return product.stock || 0
}

function getSubTotalFromItems(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
}

function clearInvalidDiscount(items: CartItem[], discount: DiscountState | null) {
  const minPurchaseAmount = discount?.minPurchaseAmount ?? 0
  if (discount && minPurchaseAmount > 0 && getSubTotalFromItems(items) < minPurchaseAmount) {
    return {
      discount: null,
      discountRemovalReason: 'คูปองถูกยกเลิกเนื่องจากยอดซื้อไม่ถึงขั้นต่ำ',
    }
  }

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
        set((state) => {
          const existing = state.items.find((i) => i.product.id === product.id)
          const stock = getCartStockLimit(product)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product.id === product.id
                  ? { ...i, quantity: Math.min(i.quantity + quantity, stock), product }
                  : i
              ),
            }
          }
          return { items: [...state.items, { product, quantity: Math.min(quantity, stock) }] }
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
        if (discount.type === 'PERCENT') {
          const percent = Math.min(Math.max(discount.value, 0), 100)
          return Math.round(subTotal * (percent / 100))
        }
        return Math.min(Math.max(discount.value, 0), subTotal)
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
