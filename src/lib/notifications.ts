import type { Prisma } from '@prisma/client'
import prisma from './db'
import { encryptText, decryptText, decryptDeliveryItemFields } from './encryption'
import { sendOrderReceiptEmail, sendOrderAccessEmail } from './mailer'
import { sendTelegramNotify } from './telegram'
import { tokenHash } from './order-access'

export async function queueNotification(tx: Prisma.TransactionClient, orderId: string, kind: string, dedupKey: string, payload: unknown = {}) {
  return tx.notificationJob.upsert({ where: { dedupKey }, create: { orderId, kind, dedupKey, payload: encryptText(JSON.stringify(payload)) }, update: {} })
}
export async function processNotifications(orderId?: string) {
  const now = new Date()
  await prisma.notificationJob.updateMany({ where: { status: 'sending', attempts: { gte: 6 }, lockedAt: { lt: new Date(now.getTime()-300000) } }, data: { status: 'failed', lockedAt: null } })
  const jobs = await prisma.notificationJob.findMany({ where: { ...(orderId && { orderId }), attempts: { lt: 6 }, OR: [{ status: { in: ['queued','failed'] }, nextAttemptAt: { lte: now } }, { status: 'sending', lockedAt: { lt: new Date(Date.now()-300000) } }] }, orderBy: { createdAt: 'asc' }, take: 5 })
  for (const job of jobs) {
    const claim = await prisma.notificationJob.updateMany({ where: { id: job.id, status: job.status, attempts: job.attempts }, data: { status: 'sending', lockedAt: now, attempts: { increment: 1 } } })
    if (!claim.count) continue
    let sent = false
    try {
      const payload = JSON.parse(decryptText(job.payload))
      const order = await prisma.order.findUniqueOrThrow({ where: { id: job.orderId }, include: { deliveryItems: true, orderItems: { include: { product: true } } } })
      if (job.kind === 'access') {
        const token = new URL(payload.url).hash.replace(/^#access=/, '')
        const challenge = await prisma.orderAccessChallenge.findUnique({ where: { tokenHash: tokenHash(token) } })
        if (!challenge || challenge.orderId !== order.id || challenge.usedAt || challenge.expiresAt <= now) {
          await prisma.notificationJob.update({ where: { id: job.id }, data: { status: 'expired', lockedAt: null } })
          continue
        }
        sent = await sendOrderAccessEmail(order.customerEmail, order.orderNumber, payload.url)
      }
      else if (job.kind === 'telegram') sent = await sendTelegramNotify(payload.message)
      else {
        if (order.status === 'refunded') { await prisma.notificationJob.update({ where: { id: job.id }, data: { status: 'cancelled', lockedAt: null } }); continue }
        const details: any[] = order.deliveryItems.map(item => { const details = decryptDeliveryItemFields(item); return { ...details, instructions: item.showInstruction === false ? null : details.instructions } })
        if (order.deliveredContent) details.push({ productName: 'ข้อมูลเพิ่มเติมจากร้านค้า', type: 'manual', deliveredContent: decryptText(order.deliveredContent) })
        for (const line of order.orderItems) {
          const delivered = order.deliveryItems.filter(d => d.orderItemId === line.id).length
          if (delivered < line.quantity && !order.deliveredContent) details.push({ productName: line.productName || line.product.name, type: 'manual', quantity: line.quantity-delivered })
        }
        sent = await sendOrderReceiptEmail(order.orderNumber, order.customerEmail, details, payload.isUpdate === true)
      }
    } catch { sent = false }
    await prisma.notificationJob.update({ where: { id: job.id }, data: { status: sent ? 'sent' : 'failed', sentAt: sent ? new Date() : null, nextAttemptAt: new Date(Date.now()+Math.min(60, 2 ** job.attempts)*60000), lockedAt: null } })
  }
}
export async function tryNotifications(orderId?: string) {
  try { await processNotifications(orderId) } catch { console.error('Notification queue deferred; retry is required') }
}
