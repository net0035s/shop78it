import prisma from './db'
import { transaction } from './transactions'
import { CommerceError } from './commerce-rules'
import { assertEncryptionReady, decryptText, encryptDeliveryItemFields } from './encryption'
import { orderInclude, orderSummary } from './order-summary'
import { queueNotification } from './notifications'

export async function fulfillPaidOrder(orderIdOrNumber: string, _paymentMarker?: string) {
  assertEncryptionReady()
  const orderId = await transaction(async tx => {
    const order = await tx.order.findFirstOrThrow({ where: { OR: [{ id: orderIdOrNumber }, { orderNumber: orderIdOrNumber }] }, include: { deliveryItems: true, orderItems: { include: { product: true }, orderBy: { productId: 'asc' } } } })
    if (['completed','needs_manual_delivery'].includes(order.status)) return order.id
    if (order.status !== 'paid') throw new CommerceError('ออเดอร์ยังไม่ได้ยืนยันรับเงิน', 409)
    const locked = await tx.order.updateMany({ where: { id: order.id, status: 'paid' }, data: { status: 'fulfilling' } })
    if (!locked.count) throw new CommerceError('ออเดอร์กำลังจัดส่ง', 409)
    // Legacy deliveries have no reliable stock/line mapping. Preserve them for manual reconciliation.
    const legacyDeliveries = order.deliveryItems.some(delivery => !delivery.orderItemId)
    let manual = legacyDeliveries
    for (const item of order.orderItems) {
      if (legacyDeliveries) continue
      if ((item.deliveryType ?? item.product.deliveryType) === 'manual') { manual = true; continue }
      const keys = await tx.digitalStock.findMany({ where: { orderId: order.id, productId: item.productId }, orderBy: { id: 'asc' }, take: item.quantity })
      if (keys.length < item.quantity) manual = true
      for (const key of keys) {
        let details: any
        try {
          details = JSON.parse(decryptText(key.content))
          if (!(details.licenseKey || details.creditCode || details.loginUrl || (details.email && details.password))) throw new Error('INVALID_STOCK')
        } catch { manual = true; continue }
        await tx.deliveryItem.create({ data: { ...encryptDeliveryItemFields({
          creditCode: details.creditCode || null, creditAmount: details.creditAmount || null, platform: details.platform || null,
          email: details.email || null, password: details.password || null, loginUrl: details.loginUrl || null,
          licenseKey: details.licenseKey || null, expiresAt: details.expiresAt || null,
          instructions: key.showInstruction === false ? null : key.instruction || details.instructions || null,
        }), orderId: order.id, orderItemId: item.id, stockId: key.id, productName: item.productName || item.product.name, type: key.type, showInstruction: key.showInstruction } })
        await tx.digitalStock.update({ where: { id: key.id }, data: { isSold: true } })
      }
    }
    await tx.order.update({ where: { id: order.id }, data: { status: manual ? 'needs_manual_delivery' : 'completed', reservationActive: false } })
    await queueNotification(tx, order.id, 'receipt', `receipt:${order.id}`)
    if (manual) await queueNotification(tx, order.id, 'telegram', `manual:${order.id}`, { message: `ออเดอร์ ${order.orderNumber} ชำระแล้ว รอแอดมินตรวจสอบและจัดส่ง` })
    await tx.orderAuditEvent.create({ data: { orderId: order.id, actor: 'fulfillment', action: manual ? 'needs_manual_delivery' : 'completed' } })
    return order.id
  })
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude })
  return { ...orderSummary(order), orderId, needsManualDelivery: order.status === 'needs_manual_delivery' }
}
