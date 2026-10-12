import type { Prisma } from '@prisma/client'
import { CommerceError } from './commerce-rules'

export async function syncAvailableStock(tx: Prisma.TransactionClient, productId: string) {
  const p = await tx.product.findUniqueOrThrow({ where: { id: productId } })
  const stock = p.deliveryType === 'manual' ? p.stock : await tx.digitalStock.count({ where: { productId, isSold: false, orderId: null } })
  await tx.product.update({ where: { id: productId }, data: { stock, stockStatus: stock > 5 ? 'in-stock' : stock > 0 ? 'low-stock' : 'out-of-stock' } })
}
export async function reserveInventory(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { orderItems: { include: { product: true }, orderBy: { productId: 'asc' } } } })
  if (order.reservationActive) return
  for (const line of order.orderItems) {
    const type = line.deliveryType ?? line.product.deliveryType
    if (type === 'manual') {
      const updated = await tx.product.updateMany({ where: { id: line.productId, stock: { gte: line.quantity } }, data: { stock: { decrement: line.quantity } } })
      if (!updated.count) throw new CommerceError(`สินค้า ${line.productName || line.product.name} คงเหลือไม่พอ`, 409, 'STOCK_UNAVAILABLE')
    } else {
      const keys = await tx.digitalStock.findMany({ where: { productId: line.productId, isSold: false, orderId: null }, orderBy: { id: 'asc' }, take: line.quantity })
      if (keys.length !== line.quantity) throw new CommerceError(`สินค้า ${line.productName || line.product.name} คงเหลือไม่พอ`, 409, 'STOCK_UNAVAILABLE')
      const claimed = await tx.digitalStock.updateMany({ where: { id: { in: keys.map(k=>k.id) }, isSold: false, orderId: null }, data: { orderId } })
      if (claimed.count !== line.quantity) throw new CommerceError('สต็อกเพิ่งเปลี่ยนแปลง กรุณาลองอีกครั้ง', 409, 'STOCK_UNAVAILABLE')
    }
    await syncAvailableStock(tx, line.productId)
  }
  await tx.order.update({ where: { id: orderId }, data: { reservationActive: true } })
}
export async function cancelPendingOrder(tx: Prisma.TransactionClient, orderId: string, actor = 'expiry') {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { orderItems: { include: { product: true } } } })
  const cancelled = await tx.order.updateMany({ where: { id: orderId, status: 'pending' }, data: { status: 'cancelled', reservationActive: false, discountReserved: false } })
  if (!cancelled.count) return false
  await tx.digitalStock.updateMany({ where: { orderId, isSold: false }, data: { orderId: null } })
  for (const line of order.orderItems) {
    if (order.reservationActive && (line.deliveryType ?? line.product.deliveryType) === 'manual') await tx.product.update({ where: { id: line.productId }, data: { stock: { increment: line.quantity } } })
    await syncAvailableStock(tx, line.productId)
  }
  if (order.discountReserved && order.discountCode) await tx.discountCode.updateMany({ where: { code: order.discountCode, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } })
  await tx.orderAuditEvent.create({ data: { orderId, actor, action: 'cancelled' } })
  return true
}
