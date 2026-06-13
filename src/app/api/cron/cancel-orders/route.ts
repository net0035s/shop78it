import { NextResponse } from 'next/server'
import prisma, { syncProductStock } from '@/lib/db'

export const dynamic = 'force-dynamic'

const PENDING_ORDER_EXPIRY_MINUTES = 65

export async function GET(request: Request) {
  console.log('🧹 Cron Job Started...')

  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('Authorization')

  if (!cronSecret) {
    console.error('Cron cancel orders blocked: CRON_SECRET is not configured.')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  if (authorization !== `Bearer ${cronSecret}`) {
    console.warn('Cron cancel orders blocked: invalid Authorization header.')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const targetTime = new Date(Date.now() - PENDING_ORDER_EXPIRY_MINUTES * 60 * 1000)
    console.log(`🕒 Cancelling pending orders older than ${PENDING_ORDER_EXPIRY_MINUTES} minutes...`)

    const expiredOrders = await prisma.order.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: targetTime },
      },
      select: {
        id: true,
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
      console.log('✅ Cancelled 0 orders')
      return NextResponse.json({
        success: true,
        cancelledCount: 0,
        restoredDigitalStockCount: 0,
        restoredDigitalKeyCount: 0,
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

    console.log(`✅ Cancelled ${result.cancelledCount} orders`)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Cron cancel orders failed:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to cancel expired orders' },
      { status: 500 }
    )
  }
}
