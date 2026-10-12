import { deploymentKind } from './hosting'
import prisma from './db'
import { assertOrderingReady } from './launch-readiness'
import { transaction } from './transactions'
import { assertEncryptionReady } from './encryption'
import { CommerceError, cents, expiry } from './commerce-rules'
import { reserveInventory } from './inventory'
import { assertStripeReady } from './stripe-config'

export function assertPaymentsReady() {
  assertOrderingReady()
  if (deploymentKind() === 'preview' || (process.env.APP_MODE === 'sandbox' && process.env.NODE_ENV !== 'test')) throw new CommerceError('เว็บทดสอบไม่เปิดรับเงินจริง', 503)
  assertEncryptionReady()
  if (process.env.PAYMENTS_ENABLED !== 'true') throw new CommerceError('ระบบรับชำระเงินยังไม่เปิดใช้งาน กรุณาติดต่อร้านค้า', 503)
}
export async function startPayment(orderId: string, method: string, requestKey: string) {
  if (method === 'stripe') assertStripeReady()
  else assertPaymentsReady()
  return transaction(async tx => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } })
    if (order.status !== 'pending') throw new CommerceError('ออเดอร์นี้กำลังตรวจสอบหรือชำระแล้ว กรุณาดูสถานะ ห้ามจ่ายซ้ำ', 409)
    if (expiry(order).getTime() <= Date.now()) throw new CommerceError('ออเดอร์หมดเวลาชำระเงินแล้ว', 409, 'ORDER_EXPIRED')
    const claim = await tx.order.updateMany({ where: { id: orderId, status: 'pending' }, data: { status: 'payment_processing' } })
    if (!claim.count) throw new CommerceError('กำลังตรวจสอบการชำระเงิน กรุณารอ', 409)
    if (order.discountCode && !order.discountReserved) {
      const coupon = await tx.discountCode.findUnique({ where: { code: order.discountCode } })
      if (!coupon || !coupon.isActive || (coupon.expiresAt && coupon.expiresAt.getTime()<=Date.now())) throw new CommerceError('คูปองในบิลเดิมไม่พร้อมใช้ กรุณาสร้างบิลใหม่',409)
      const held = await tx.discountCode.updateMany({ where: { id: coupon.id, ...(coupon.maxUses !== null && {usedCount:{lt:coupon.maxUses}}) }, data: {usedCount:{increment:1}} })
      if (!held.count) throw new CommerceError('สิทธิ์คูปองหมดแล้ว กรุณาสร้างบิลใหม่',409)
      await tx.order.update({where:{id:orderId},data:{discountReserved:true}})
    }
    await reserveInventory(tx, orderId)
    const existing = await tx.paymentAttempt.findUnique({ where: { requestKey } })
    if (existing && (existing.orderId !== orderId || existing.status !== 'failed')) throw new CommerceError('หลักฐานนี้อยู่ระหว่างตรวจสอบหรือใช้งานแล้ว', 409)
    const attempt = existing ? await tx.paymentAttempt.update({ where: { id: existing.id }, data: { status: 'started', note: null, createdAt: new Date() } }) : await tx.paymentAttempt.create({ data: { orderId, method, requestKey, expectedAmount: order.total } })
    return { order, attempt }
  })
}
export async function rejectPayment(attemptId: string, note: string) {
  await transaction(async tx => {
    const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })
    const changed = await tx.paymentAttempt.updateMany({ where: { id: attemptId, status: 'started' }, data: { status: 'failed', note: note.slice(0,500) } })
    if (changed.count) await tx.order.updateMany({ where: { id: attempt.orderId, status: 'payment_processing' }, data: { status: 'pending' } })
  })
}
export async function reviewPayment(attemptId: string, note: string) {
  await transaction(async tx => {
    const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })
    await tx.paymentAttempt.updateMany({ where: { id: attemptId, status: 'started' }, data: { status: 'review', note: note.slice(0,500) } })
    await tx.order.updateMany({ where: { id: attempt.orderId, status: 'payment_processing' }, data: { status: 'payment_review' } })
  }).catch(() => { console.error('Payment remains locked for reconciliation') })
}
export async function recordPayment(attemptId: string, reference: string, received: number) {
  await transaction(async tx => {
    const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })
    if (attempt.status === 'verified') return
    if (!['started','review'].includes(attempt.status)) throw new CommerceError('สถานะรายการชำระเงินไม่ถูกต้อง', 409)
    if (cents(received) !== cents(attempt.expectedAmount)) throw new CommerceError('ยอดรับไม่ตรง ต้องให้แอดมินตรวจสอบ', 409)
    if (!reference || reference.length > 240) throw new CommerceError('ไม่พบเลขอ้างอิงการรับเงิน', 409)
    const previous = await tx.paymentAttempt.findUnique({ where: { reference } })
    if (previous && previous.id !== attemptId) throw new CommerceError('เลขอ้างอิงนี้ใช้กับออเดอร์อื่นแล้ว ต้องตรวจผลรับเงิน',409)
    const changed = await tx.order.updateMany({ where: { id: attempt.orderId, status: { in: ['payment_processing','payment_review'] } }, data: { status: 'paid', paidAt: new Date(), paidAtEstimated: false } })
    if (!changed.count) throw new CommerceError('ออเดอร์เปลี่ยนสถานะแล้ว กรุณาตรวจสอบ', 409)
    await tx.paymentAttempt.update({ where: { id: attemptId }, data: { status: 'verified', reference, receivedAmount: received } })
    await tx.orderAuditEvent.create({ data: { orderId: attempt.orderId, actor: 'payment-provider', action: 'paid', note: attempt.id } })
  })
}
export async function paymentReviewResponse(attemptId: string) {
  const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { order: true } })
  return { success: true, warning: true, message: 'กำลังตรวจสอบผลชำระเงิน กรุณาดูสถานะและอย่าชำระซ้ำ', data: { orderNumber: attempt.order.orderNumber, status: attempt.order.status } }
}
