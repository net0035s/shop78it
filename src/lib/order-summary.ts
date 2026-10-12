import { decryptDeliveryItemFields, decryptText } from './encryption'
import { expiry, PAID_STATUSES } from './commerce-rules'
import { moneyToNumber } from './money'

export const orderInclude = { orderItems: { include: { product: true } }, deliveryItems: true, claimedStocks: { where: { isSold: true }, include: { product: true } }, paymentAttempts: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { method: true, status: true } }, notifications: { orderBy: { createdAt: 'desc' as const }, select: { kind: true, status: true, sentAt: true } } } as const
export function orderSummary(order: any) {
  const paid = PAID_STATUSES.includes(order.status)
  // Legacy stocks are a fallback only; current deliveries have stable stock IDs.
  const deliveries = paid ? (order.deliveryItems.length ? order.deliveryItems.map(decryptDeliveryItemFields) : (order.claimedStocks || []).map((stock: any) => ({
    ...JSON.parse(decryptText(stock.content)), id: stock.id, stockId: stock.id, type: stock.type, productName: stock.product.name,
    showInstruction: stock.showInstruction, instructions: stock.showInstruction === false ? undefined : stock.instruction || JSON.parse(decryptText(stock.content)).instructions,
  }))) : []
  return {
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentAttempts?.[0]?.status === 'failed' ? undefined : order.paymentAttempts?.[0]?.method,
    items: order.orderItems.map((item: any) => ({ orderItemId: item.id, product: {
      id: item.productId, name: item.productName ?? item.product.name, price: moneyToNumber(item.price), image: item.productImage ?? item.product.image,
      description: item.product.description, category: item.product.category, stock: item.product.stock, stockStatus: item.product.stockStatus,
      deliveryType: item.deliveryType ?? item.product.deliveryType,
    }, quantity: item.quantity })),
    customer: { name: order.customerName, email: order.customerEmail, phone: order.customerPhone ?? undefined },
    total: moneyToNumber(order.total), subTotal: moneyToNumber(order.subTotal ?? order.total), discountAmount: moneyToNumber(order.discountAmount), discountCode: order.discountCode,
    status: order.status, deliveryItems: deliveries.map((item: any) => ({ ...item, instructions: item.showInstruction === false ? undefined : item.instructions })),
    deliveredContent: paid && order.deliveredContent ? decryptText(order.deliveredContent) : undefined,
    createdAt: order.createdAt.toISOString(), expiresAt: expiry(order).toISOString(), paidAt: order.paidAt?.toISOString(),
    emailStatus: (order.notifications || []).find((j: any)=>j.kind === 'receipt')?.status === 'sent' ? 'sent' : 'pending',
  }
}
