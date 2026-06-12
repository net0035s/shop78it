import generatePromptPayPayload from 'promptpay-qr'
import prisma from '@/lib/db'
import { moneyToNumber } from '@/lib/money'
import { jsonUtf8 } from '@/lib/json-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const promptPayNumber = process.env.PROMPTPAY_NUMBER

    if (!promptPayNumber) {
      return jsonUtf8(
        { success: false, error: 'ยังไม่ได้ตั้งค่า PROMPTPAY_NUMBER' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''

    if (!orderId) {
      return jsonUtf8(
        { success: false, error: 'กรุณาระบุหมายเลขออเดอร์' },
        { status: 400 }
      )
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: orderId },
          { orderNumber: orderId },
        ],
      },
    })

    if (!order) {
      return jsonUtf8(
        { success: false, error: 'ไม่พบออเดอร์นี้' },
        { status: 404 }
      )
    }

    if (order.status !== 'pending') {
      return jsonUtf8(
        { success: false, error: 'ออเดอร์นี้ชำระเงินแล้วหรือไม่สามารถสร้าง QR ใหม่ได้' },
        { status: 400 }
      )
    }

    const amount = moneyToNumber(order.total)
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonUtf8(
        { success: false, error: 'ยอดชำระของออเดอร์ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const payload = generatePromptPayPayload(promptPayNumber, { amount })

    return jsonUtf8({
      success: true,
      data: {
        payload,
        amount,
        orderNumber: order.orderNumber,
      },
    })
  } catch (error) {
    console.error('PromptPay QR payload error:', error)
    return jsonUtf8(
      { success: false, error: 'ไม่สามารถสร้าง QR PromptPay ได้ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    )
  }
}
