import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

function sumValue(value: number | null | undefined): number {
  return value ?? 0
}

/**
 * GET /api/admin/stats
 * ดึงสถิติสำหรับหน้า Dashboard โดยให้ฐานข้อมูลนับ/รวมยอดให้โดยตรง
 */
export async function GET() {
  try {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const last7DayRanges = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(now)
      day.setDate(day.getDate() - (6 - index))
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())
      const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
      const monthLabel = String(day.getMonth() + 1).padStart(2, '0')
      const dateLabel = String(day.getDate()).padStart(2, '0')

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
          status: 'completed',
          createdAt: { gte: startOfToday },
        },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: {
          status: 'completed',
          createdAt: { gte: startOfMonth },
        },
        _sum: { total: true },
      }),
      prisma.order.count({
        where: {
          status: { in: ['pending', 'needs_manual_delivery'] },
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
        where: { isSold: false },
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
                status: 'completed',
                createdAt: {
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
        ...product,
        unsoldCount: unsoldCountByProductId.get(product.id) ?? 0,
      }))
      .filter((product: any) => product.unsoldCount <= 3)
      .sort((a: any, b: any) => a.unsoldCount - b.unsoldCount)

    return NextResponse.json({
      success: true,
      data: {
        todayRevenue: sumValue(todayRevenueAgg._sum.total),
        monthRevenue: sumValue(monthRevenueAgg._sum.total),
        pendingOrders,
        manualDeliveryOrders,
        totalOrders,
        completedOrders,
        lowStockProducts,
        last7Days: last7DaysRaw,
        recentOrders,
      },
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการดึงสถิติ' }, { status: 500 })
  }
}
