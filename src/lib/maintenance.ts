import prisma from './db'
import { assertSafeDatabaseWrite } from './launch-readiness'
import { transaction } from './transactions'
import { cancelPendingOrder } from './inventory'
import { fulfillPaidOrder } from './order-fulfillment'
import { tryNotifications } from './notifications'
import { ORDER_TTL_MS } from './commerce-rules'
import { jsonUtf8 } from './json-response'
import { apiError } from './server-guards'
import { reconcileStripeQueue } from './stripe-payments'

export async function maintenance(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return jsonUtf8({ success: false }, { status: 401 })
  try {
    assertSafeDatabaseWrite()
    await reconcileStripeQueue()
    const expired = await prisma.order.findMany({ where: { status: 'pending', OR: [{ expiresAt: { lte: new Date() } }, { expiresAt: null, createdAt: { lte: new Date(Date.now()-ORDER_TTL_MS) } }] }, select: { id: true }, take: 100, orderBy: { createdAt: 'asc' } })
    let cancelledCount = 0
    for (const order of expired) if (await transaction(tx=>cancelPendingOrder(tx, order.id))) cancelledCount++
    const paid = await prisma.order.findMany({ where: { status: 'paid' }, select: { id: true }, take: 10 })
    for (const order of paid) { try { await fulfillPaidOrder(order.id) } catch { console.error('Paid order queued for fulfillment retry') } }
    await tryNotifications()
    await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } })
    await prisma.orderAccessSession.deleteMany({ where: { expiresAt: { lt: new Date() } } })
    await prisma.orderAccessChallenge.deleteMany({ where: { expiresAt: { lt: new Date(Date.now()-86400000) } } })
    return jsonUtf8({ success: true, cancelledCount })
  } catch (error) { return apiError(error) }
}
