import { transaction } from './transactions'
import { CommerceError, cents, textField, PAID_STATUSES } from './commerce-rules'

export async function recordExternalRefund(orderId: string, body: unknown, actor: string) {
  const data = body as Record<string, unknown>
  if (!data || data.confirmExternalRefund !== true) throw new CommerceError('ยืนยันว่าได้คืนเงินภายนอกแล้วก่อนบันทึก')
  const reference = textField(data.reference, 'เลขอ้างอิงคืนเงิน', 240)
  const reason = textField(data.reason, 'เหตุผลและหลักฐาน', 2000)
  const received = cents(data.amount)
  return transaction(async tx => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } })
    if (!PAID_STATUSES.includes(order.status)) throw new CommerceError('บันทึกคืนเงินได้เฉพาะออเดอร์ที่ยืนยันรับเงินแล้วและยังไม่คืนเงิน', 409)
    if (received <= 0 || received !== cents(order.total)) throw new CommerceError('ขั้นตอนนี้รองรับการคืนเต็มยอดเท่านั้น ยอดขาดหรือยอดเกินต้องกระทบยอดแยก', 409)
    const duplicate = await tx.orderAuditEvent.findFirst({ where: { action: 'external_refund_recorded', note: { contains: '"reference":' + JSON.stringify(reference) } } })
    if (duplicate) throw new CommerceError('เลขอ้างอิงคืนเงินนี้ถูกบันทึกแล้ว', 409)
    const changed = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: 'refunded' } })
    if (!changed.count) throw new CommerceError('ออเดอร์เปลี่ยนสถานะแล้ว กรุณาตรวจอีกครั้ง', 409)
    await tx.orderAuditEvent.create({ data: { orderId, actor, action: 'external_refund_recorded', note: JSON.stringify({ amount: received / 100, reference, reason, previousStatus: order.status, externalTransferConfirmed: true }) } })
    await tx.notificationJob.updateMany({ where: { orderId, kind: 'receipt', status: { in: ['queued', 'failed'] } }, data: { status: 'cancelled', lockedAt: null } })
    // Paid stock and delivered keys stay quarantined: refunds never put exposed keys back on sale.
    return { orderNumber: order.orderNumber, status: 'refunded', refundedAmount: received / 100 }
  })
}
