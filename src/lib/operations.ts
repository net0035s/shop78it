import prisma from './db'
import { ORDER_TTL_MS } from './commerce-rules'

export async function operationsSummary(now = new Date()) {
  const [reviewPayments, stalledPayments, paidAwaitingDelivery, manualDelivery, expiredReservations, failedNotifications, stuckNotifications] = await Promise.all([
    prisma.order.count({ where: { status: 'payment_review' } }),
    prisma.order.count({ where: { status: 'payment_processing', updatedAt: { lt: new Date(now.getTime() - 5 * 60000) } } }),
    prisma.order.count({ where: { status: 'paid' } }),
    prisma.order.count({ where: { status: 'needs_manual_delivery' } }),
    prisma.order.count({ where: { status: 'pending', OR: [{ expiresAt: { lte: now } }, { expiresAt: null, createdAt: { lte: new Date(now.getTime() - ORDER_TTL_MS) } }] } }),
    prisma.notificationJob.count({ where: { status: 'failed', attempts: { gte: 6 } } }),
    prisma.notificationJob.count({ where: { status: 'sending', lockedAt: { lt: new Date(now.getTime() - 5 * 60000) } } }),
  ])
  return { reviewPayments, stalledPayments, paidAwaitingDelivery, manualDelivery, expiredReservations, failedNotifications, stuckNotifications }
}
