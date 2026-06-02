export function moneyToNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)

  const maybeDecimal = value as { toNumber?: () => number; toString?: () => string }
  if (typeof maybeDecimal.toNumber === 'function') return maybeDecimal.toNumber()
  if (typeof maybeDecimal.toString === 'function') return Number(maybeDecimal.toString())

  return Number(value)
}

export function optionalMoneyToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return moneyToNumber(value)
}

export function normalizeProductMoney<T extends { price: unknown; originalPrice?: unknown }>(
  product: T
) {
  return {
    ...product,
    price: moneyToNumber(product.price),
    originalPrice: optionalMoneyToNumber(product.originalPrice),
  }
}

export function normalizeOrderMoney<T extends {
  total: unknown
  subTotal?: unknown
  discountAmount?: unknown
}>(order: T) {
  return {
    ...order,
    total: moneyToNumber(order.total),
    subTotal: optionalMoneyToNumber(order.subTotal),
    discountAmount: optionalMoneyToNumber(order.discountAmount),
  }
}

export function normalizeDiscountMoney<T extends {
  discountValue: unknown
  minPurchaseAmount: unknown
}>(discount: T) {
  return {
    ...discount,
    discountValue: moneyToNumber(discount.discountValue),
    minPurchaseAmount: moneyToNumber(discount.minPurchaseAmount),
  }
}
