import { NextResponse } from 'next/server'
import prisma, { syncProductStock } from '@/lib/db'

export const dynamic = 'force-dynamic'

const UNPAID_ORDER_EXPIRY_HOURS = 24

export async function GET(request: Request) {
  console.log('Clear unpaid orders cron started...')

  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('Authorization')

  if (!cronSecret) {
    console.error('Clear unpaid orders blocked: CRON_SECRET is not configured.')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  if (authorization !== `Bearer ${cronSecret}`) {
    console.warn('Clear unpaid orders blocked: invalid Authorization header.')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const targetTime = new Date(Date.now() - UNPAID_ORDER_EXPIRY_HOURS * 60 * 60 * 1000)
    console.log(`Cancelling unpaid orders older than ${UNPAID_ORDER_EXPIRY_HOURS} hours...`)

    const expiredOrders = await prisma.order.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: targetTime },
      },
      select: {
        id: true,
        orderNumber: true,
        claimedStocks: {
          select: {
            productId: true,
          },
        },
        digitalKeys: {
          select: {
            productId: true,
          },
        },
      },
    })

    if (expiredOrders.length === 0) {
      console.log('Cancelled 0 unpaid orders')
      return NextResponse.json({
        success: true,
        cancelledCount: 0,
        restoredDigitalStockCount: 0,
        restoredDigitalKeyCount: 0,
        checkedBefore: targetTime.toISOString(),
      })
    }

    const orderIds = expiredOrders.map((order) => order.id)
    const productIdsToSync = new Set<string>()

    expiredOrders.forEach((order) => {
      order.claimedStocks.forEach((stock) => productIdsToSync.add(stock.productId))
      order.digitalKeys.forEach((key) => productIdsToSync.add(key.productId))
    })

    const result = await prisma.$transaction(async (tx) => {
      const restoredDigitalStocks = await tx.digitalStock.updateMany({
        where: {
          orderId: { in: orderIds },
          isSold: true,
        },
        data: {
          isSold: false,
          orderId: null,
        },
      })

      const restoredDigitalKeys = await tx.digitalKey.updateMany({
        where: {
          orderId: { in: orderIds },
          status: 'SOLD',
        },
        data: {
          status: 'AVAILABLE',
          orderId: null,
        },
      })

      const cancelledOrders = await tx.order.updateMany({
        where: {
          id: { in: orderIds },
          status: 'pending',
        },
        data: {
          status: 'cancelled',
        },
      })

      return {
        cancelledCount: cancelledOrders.count,
        restoredDigitalStockCount: restoredDigitalStocks.count,
        restoredDigitalKeyCount: restoredDigitalKeys.count,
      }
    })

    await Promise.all(
      Array.from(productIdsToSync).map((productId) => syncProductStock(productId))
    )

    console.log(`Cancelled ${result.cancelledCount} unpaid orders`)

    return NextResponse.json({
      success: true,
      ...result,
      checkedBefore: targetTime.toISOString(),
      cancelledOrderNumbers: expiredOrders.map((order) => order.orderNumber),
    })
  } catch (error) {
    console.error('Clear unpaid orders cron failed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to clear unpaid orders' },
      { status: 500 }
    )
  }
}
