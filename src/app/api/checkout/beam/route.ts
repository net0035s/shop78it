import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { moneyToNumber } from '@/lib/money'

const BEAM_CHARGES_URL = 'https://api.beamcheckout.com/api/v1/charges'

type BeamCreateChargeResponse = {
  chargeId?: string
  actionRequired?: 'NONE' | 'REDIRECT' | 'ENCODED_IMAGE'
  encodedImage?: {
    expiry?: string
    imageBase64Encoded?: string
    rawData?: string
  }
  redirect?: {
    redirectUrl?: string
  }
}

function createBasicAuthHeader(secretKey: string) {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`
}

export async function POST(request: Request) {
  try {
    const secretKey = process.env.BEAM_SECRET_KEY

    if (!secretKey) {
      return NextResponse.json(
        { success: false, error: 'ยังไม่ได้ตั้งค่า BEAM_SECRET_KEY' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ orderId' },
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
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบออเดอร์นี้' },
        { status: 404 }
      )
    }

    if (order.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'ออเดอร์นี้ชำระเงินแล้วหรือไม่สามารถสร้าง QR ใหม่ได้' },
        { status: 400 }
      )
    }

    const netTotal = order.orderItems.reduce((sum, item) => {
      return sum + moneyToNumber(item.product.price) * item.quantity
    }, 0) - moneyToNumber(order.discountAmount)

    const amountSatang = Math.round(Math.max(netTotal, 0) * 100)

    if (!Number.isFinite(amountSatang) || amountSatang < 1) {
      return NextResponse.json(
        { success: false, error: 'ยอดชำระไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const beamResponse = await fetch(BEAM_CHARGES_URL, {
      method: 'POST',
      headers: {
        Authorization: createBasicAuthHeader(secretKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountSatang,
        currency: 'THB',
        referenceId: order.id,
        paymentMethod: {
          paymentMethodType: 'QR_PROMPT_PAY',
          qrPromptPay: {},
        },
        customer: {
          email: order.customerEmail,
          primaryPhone: order.customerPhone
            ? { countryCode: '66', number: order.customerPhone }
            : undefined,
        },
      }),
    })

    const beamData = await beamResponse.json().catch(() => null) as BeamCreateChargeResponse | any

    if (!beamResponse.ok) {
      console.error('Beam create charge failed:', beamData)
      return NextResponse.json(
        { success: false, error: beamData?.message || 'สร้าง QR จาก Beam ไม่สำเร็จ' },
        { status: beamResponse.status || 502 }
      )
    }

    const imageBase64Encoded = beamData?.encodedImage?.imageBase64Encoded
    const expiry = beamData?.encodedImage?.expiry

    if (!imageBase64Encoded) {
      console.error('Beam response missing encoded image:', beamData)
      return NextResponse.json(
        { success: false, error: 'Beam ไม่ได้ส่งรูป QR กลับมา' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        chargeId: beamData.chargeId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        imageBase64Encoded,
        expiry,
        amount: amountSatang,
      },
    })
  } catch (error) {
    console.error('Beam checkout error:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการสร้าง QR ชำระเงิน' },
      { status: 500 }
    )
  }
}
