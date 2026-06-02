import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { decryptDeliveryItemFields, decryptText } from '@/lib/encryption'
import { normalizeOrderMoney } from '@/lib/money'

export const dynamic = 'force-dynamic'

const VALID_ORDER_STATUSES = ['pending', 'completed', 'needs_manual_delivery', 'cancelled']

/**
 * GET /api/admin/orders
 * ดึงรายงานบิลใบสั่งซื้อทั้งหมดในร้าน
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)))

    const orders = await prisma.order.findMany({
      include: {
        deliveryItems: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    })
    const decryptedOrders = orders.map((order) => ({
      ...normalizeOrderMoney(order),
      deliveredContent: order.deliveredContent ? decryptText(order.deliveredContent) : order.deliveredContent,
      deliveryItems: order.deliveryItems.map(decryptDeliveryItemFields),
    }))

    return NextResponse.json({ success: true, data: decryptedOrders })
  } catch (error) {
    console.error('Error fetching admin orders:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลใบสั่งซื้อ' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/orders
 * อัปเดตสถานะของออเดอร์ด้วยมือแอดมิน (เช่น ยกเลิกออเดอร์)
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, status } = body

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลสำหรับอัปเดตไม่ครบถ้วน' },
        { status: 400 }
      )
    }

    if (!VALID_ORDER_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'สถานะออเดอร์ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...normalizeOrderMoney(updatedOrder),
        deliveredContent: updatedOrder.deliveredContent
          ? decryptText(updatedOrder.deliveredContent)
          : updatedOrder.deliveredContent,
      },
    })
  } catch (error) {
    console.error('Error updating admin order:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการปรับปรุงสถานะใบสั่งซื้อ' },
      { status: 500 }
    )
  }
}
