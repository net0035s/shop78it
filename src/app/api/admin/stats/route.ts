import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { bangkokDay, PAID_STATUSES } from '@/lib/commerce-rules'
import { requireAdmin } from '@/lib/admin-auth'
import { moneyToNumber, normalizeOrderMoney, normalizeProductMoney } from '@/lib/money'

export const dynamic = 'force-dynamic'

function sumValue(value: unknown): number {
  return moneyToNumber(value)
}

/**
 * GET /api/admin/stats
 * ดึงสถิติสำหรับหน้า Dashboard โดยให้ฐานข้อมูลนับ/รวมยอดให้โดยตรง
 */
export async function GET() {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    const now = new Date()
    const startOfToday = bangkokDay(now)
    const revenueStatuses = [...PAID_STATUSES, 'refunded']
    const local = new Date(now.getTime() + 7 * 3600000)
    const startOfMonth = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - 7 * 3600000)

    const last7DayRanges = Array.from({ length: 7 }, (_, index) => {
      const dayStart = new Date(startOfToday.getTime() - (6-index)*86400000)
      const dayEnd = new Date(dayStart.getTime()+86400000)
      const day = new Date(dayStart.getTime()+7*3600000)
      const monthLabel = String(day.getUTCMonth()+1).padStart(2,'0')
      const dateLabel = String(day.getUTCDate()).padStart(2,'0')

      return {
        dayStart,
        dayEnd,
        date: `${day.getFullYear()}-${monthLabel}-${dateLabel}`,
        label: `${dateLabel}/${monthLabel}`,
      }
    })

    const [
      todayRevenueAgg,
      monthRevenueAgg,
      pendingOrders,
      manualDeliveryOrders,
      totalOrders,
      completedOrders,
      allProducts,
      unsoldStockGroups,
      recentOrders,
      last7DaysRaw,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: {
          status: { in: revenueStatuses },
          paidAt: { gte: startOfToday },
        },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          status: { in: revenueStatuses },
          paidAt: { gte: startOfMonth },
        },
        _sum: { total: true },
      }),
      prisma.order.count({
        where: {
          status: { in: ['pending', 'payment_processing', 'payment_review'] },
        },
      }),
      prisma.order.count({
        where: { status: 'needs_manual_delivery' },
      }),
      prisma.order.count(),
      prisma.order.count({
        where: { status: 'completed' },
      }),
      prisma.product.findMany(),
      prisma.digitalStock.groupBy({
        by: ['productId'],
        where: { isSold: false, orderId: null },
        _count: { productId: true },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      Promise.all(
        last7DayRanges.map(async (range) => {
          const [orders, revenueAgg] = await Promise.all([
            prisma.order.count({
              where: {
                createdAt: {
                  gte: range.dayStart,
                  lt: range.dayEnd,
                },
              },
            }),
            prisma.order.aggregate({
              where: {
                status: { in: revenueStatuses },
                paidAt: {
                  gte: range.dayStart,
                  lt: range.dayEnd,
                },
              },
              _sum: { total: true },
            }),
          ])

          return {
            date: range.date,
            label: range.label,
            orders,
            revenue: sumValue(revenueAgg._sum.total),
          }
        })
      ),
    ])

    const unsoldCountByProductId = new Map(
      unsoldStockGroups.map((group) => [group.productId, group._count.productId])
    )

    const lowStockProducts = allProducts
      .map((product: any) => ({
        ...normalizeProductMoney(product),
        unsoldCount: product.deliveryType === 'manual' ? product.stock : unsoldCountByProductId.get(product.id) ?? 0,
      }))
      .filter((product: any) => product.unsoldCount <= 5)
      .sort((a: any, b: any) => a.unsoldCount - b.unsoldCount)

    const refundEvents = await prisma.orderAuditEvent.findMany({ where: { action: 'external_refund_recorded', createdAt: { gte: startOfToday } }, select: { note: true } })
    const refundedToday = refundEvents.reduce((total, event) => {
      try { const amount = Number(JSON.parse(event.note || '{}').amount); return total + (Number.isFinite(amount) && amount > 0 ? amount : 0) } catch { return total }
    }, 0)
    return NextResponse.json({
      success: true,
      data: {
        refundedToday,
        todayRevenue: sumValue(todayRevenueAgg._sum.total),
        monthRevenue: sumValue(monthRevenueAgg._sum.total),
        pendingOrders,
        manualDeliveryOrders,
        totalOrders,
        completedOrders,
        lowStockProducts,
        last7Days: last7DaysRaw,
        recentOrders: recentOrders.map(normalizeOrderMoney),
      },
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการดึงสถิติ' }, { status: 500 })
  }
}
