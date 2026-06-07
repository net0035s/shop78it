import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { sendOrderReceiptEmail } from '@/lib/mailer'
import { decryptDeliveryItemFields, decryptText, encryptText } from '@/lib/encryption'
import { moneyToNumber, normalizeOrderMoney, normalizeProductMoney } from '@/lib/money'

const VALID_ORDER_STATUSES = ['pending', 'completed', 'needs_manual_delivery', 'cancelled']

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    const { id } = params
    const body = await request.json()
    
    // Only extract the allowed fields
    const { customerEmail, status, internalNote, deliveredContent, sendEmailNotification } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรหัสออเดอร์' },
        { status: 400 }
      )
    }

    if (status !== undefined && !VALID_ORDER_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'สถานะออเดอร์ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        ...(customerEmail !== undefined && { customerEmail }),
        ...(status !== undefined && { status }),
        ...(internalNote !== undefined && { internalNote }),
        ...(deliveredContent !== undefined && {
          deliveredContent: deliveredContent ? encryptText(deliveredContent) : null,
        }),
      },
      include: {
        deliveryItems: true,
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    })

    const decryptedDeliveredContent = updatedOrder.deliveredContent
      ? decryptText(updatedOrder.deliveredContent)
      : null
    const decryptedDeliveryItems = updatedOrder.deliveryItems.map(decryptDeliveryItemFields)

    if (status === 'completed' && sendEmailNotification === true) {
      const emailItems = [
        ...decryptedDeliveryItems,
        ...(decryptedDeliveredContent
          ? [{
              productName: 'ข้อมูลที่แอดมินจัดส่ง',
              type: 'manual',
              deliveredContent: decryptedDeliveredContent,
            }]
          : []),
      ]

      const fallbackItems = updatedOrder.orderItems.map((item) => ({
        productName: item.product.name,
        type: item.product.deliveryType || 'order-item',
        quantity: item.quantity,
      }))

      void sendOrderReceiptEmail(
        updatedOrder.orderNumber,
        updatedOrder.customerEmail,
        emailItems.length > 0 ? emailItems : fallbackItems,
        true
      ).catch((emailErr) => console.error('Order receipt email failed:', emailErr))
    }

    return NextResponse.json({
      success: true,
      data: {
        ...normalizeOrderMoney(updatedOrder),
        deliveredContent: decryptedDeliveredContent,
        deliveryItems: decryptedDeliveryItems,
        orderItems: updatedOrder.orderItems.map((item) => ({
          ...item,
          price: moneyToNumber(item.price),
          product: normalizeProductMoney(item.product),
        })),
      },
    })
  } catch (error: any) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการแก้ไขออเดอร์', details: error.message },
      { status: 500 }
    )
  }
}
