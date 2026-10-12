import { randomUUID } from 'node:crypto'
import prisma from './db'
import { transaction } from './transactions'
import { emailField, CommerceError, textField, PAID_STATUSES } from './commerce-rules'
import { cancelPendingOrder } from './inventory'
import { encryptText, decryptText, decryptDeliveryItemFields } from './encryption'
import { normalizeOrderMoney, moneyToNumber, normalizeProductMoney } from './money'
import { queueNotification } from './notifications'

export const adminOrderInclude = { auditEvents: { orderBy: { createdAt: 'desc' as const } }, orderItems: { include: { product: true } }, deliveryItems: true, paymentAttempts: { orderBy: { createdAt: 'desc' as const } }, notifications: { select: { id: true, kind: true, status: true, attempts: true, sentAt: true } } } as const
export function adminOrderData(order: any) {
  return { ...normalizeOrderMoney(order), deliveredContent: order.deliveredContent ? decryptText(order.deliveredContent) : null,
    deliveryItems: order.deliveryItems.map(decryptDeliveryItemFields),
    orderItems: order.orderItems.map((i: any)=>({ ...i, price: moneyToNumber(i.price), product: normalizeProductMoney(i.product) })),
    paymentAttempts: order.paymentAttempts.map((p: any)=>({ ...p, expectedAmount: moneyToNumber(p.expectedAmount), receivedAmount: p.receivedAmount === null ? null : moneyToNumber(p.receivedAmount) })),
  }
}
export async function updateAdminOrder(id: string, body: any, actor: string) {
  await transaction(async tx=>{
    const order = await tx.order.findUniqueOrThrow({ where: { id }, include: { deliveryItems: true, orderItems: true } })
    const status = body.status ?? order.status
    const note = body.internalNote === undefined ? order.internalNote : textField(body.internalNote, 'บันทึก', 4000, true)
    const content = body.deliveredContent === undefined ? undefined : textField(body.deliveredContent, 'ข้อมูลจัดส่ง', 20000, true)
    const customerEmail = body.customerEmail === undefined ? order.customerEmail : emailField(body.customerEmail)
    if (status !== order.status) {
      if (status === 'cancelled' && order.status === 'pending') {
        await cancelPendingOrder(tx, id, actor)
      } else if (status === 'completed' && ['paid','needs_manual_delivery'].includes(order.status)) {
        const complete = order.orderItems.every(i=>order.deliveryItems.filter(d=>d.orderItemId===i.id).length>=i.quantity)
        if (!complete && !(content || order.deliveredContent)) throw new CommerceError('กรุณากรอกข้อมูลจัดส่งส่วนที่เหลือก่อนปิดออเดอร์')
      } else throw new CommerceError('ไม่อนุญาตให้เปลี่ยนสถานะนี้ กรุณาตรวจผลชำระเงินจากรายการรับเงิน', 409)
    }
    if (content && !PAID_STATUSES.includes(order.status)) throw new CommerceError('ยังไม่ยืนยันการรับเงิน ไม่สามารถบันทึกสินค้าให้ลูกค้าได้', 409)
    // Serialize status changes with payment and expiry transactions.
    const changed = await tx.order.updateMany({ where: { id, status: status === 'cancelled' ? 'cancelled' : order.status }, data: { status, customerEmail, internalNote: note, ...(content !== undefined && { deliveredContent: content ? encryptText(content) : null }) } })
    if (!changed.count) throw new CommerceError('ออเดอร์เปลี่ยนแปลงแล้ว กรุณาโหลดใหม่', 409)
    if (customerEmail !== order.customerEmail) {
      await tx.orderAccessSession.deleteMany({ where: { orderId: id } })
      await tx.orderAccessChallenge.deleteMany({ where: { orderId: id } })
    }
    if (body.sendEmailNotification === true && status === 'completed') await queueNotification(tx,id,'receipt',`resend:${id}:${randomUUID()}`,{isUpdate:true})
    await tx.orderAuditEvent.create({ data: { orderId: id, actor, action: `${order.status}->${status}`, note: customerEmail !== order.customerEmail ? 'customer email updated; sessions revoked' : 'order details updated' } })
  })
  return adminOrderData(await prisma.order.findUniqueOrThrow({ where: { id }, include: adminOrderInclude }))
}
