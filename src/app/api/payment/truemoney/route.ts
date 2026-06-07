import { NextResponse } from 'next/server'
import redeemvouchers from '@prakrit_m/tmn-voucher'
import prisma from '@/lib/db'
import { moneyToNumber } from '@/lib/money'
import { fulfillPaidOrder } from '@/lib/order-fulfillment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const TRUEMONEY_BASE_URL = 'https://gift.truemoney.com'

type TrueMoneyRedeemResult = Awaited<ReturnType<typeof redeemvouchers>>

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('66') ? `0${digits.slice(2)}` : digits

  if (!/^0\d{9}$/.test(normalized)) {
    throw new Error('INVALID_TMN_PHONE')
  }

  return normalized
}

function extractVoucherCode(voucherLink: string) {
  const trimmed = voucherLink.trim()

  try {
    const url = new URL(trimmed)
    const codeFromQuery = url.searchParams.get('v')
    if (codeFromQuery) return codeFromQuery.trim()
  } catch {
    // Not every user pastes a full URL. Plain voucher codes are accepted below.
  }

  const codeMatch = trimmed.match(/[?&]v=([A-Za-z0-9]+)/) || trimmed.match(/([A-Za-z0-9]{12,})/)
  return (codeMatch?.[1] || trimmed).trim()
}

function getRedeemErrorMessage(result: TrueMoneyRedeemResult) {
  if (result.success) return ''

  switch (result.code) {
    case 'VOUCHER_NOT_FOUND':
    case 'BAD_PARAM':
    case 'INVALID_INPUT':
      return 'ลิงก์ซองอั่งเปาไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่'
    case 'VOUCHER_OUT_OF_STOCK':
    case 'TARGET_USER_REDEEMED':
      return 'ซองอั่งเปานี้ถูกใช้ไปแล้ว กรุณาใช้ซองใหม่'
    case 'VOUCHER_EXPIRED':
      return 'ซองอั่งเปานี้หมดอายุแล้ว กรุณาสร้างซองใหม่'
    case 'TARGET_USER_NOT_FOUND':
      return 'ไม่พบเบอร์ TrueMoney ของร้าน กรุณาติดต่อแอดมิน'
    case 'CANNOT_GET_OWN_VOUCHER':
      return 'ไม่สามารถรับซองอั่งเปาจากบัญชีเดียวกันได้'
    case 'CONDITION_NOT_MET':
      return 'ยอดเงินในซองไม่ตรงกับยอดที่ต้องชำระ'
    default:
      return result.message || 'ไม่สามารถตรวจสอบซองอั่งเปาได้ กรุณาลองใหม่'
  }
}

function bahtTextToSatang(value: unknown) {
  const numericValue = typeof value === 'string'
    ? Number(value.replace(/,/g, ''))
    : Number(value)

  return Math.round(numericValue * 100)
}

function getAvailableVoucherAmountSatang(voucher: {
  amount_baht?: string
  redeemed_amount_baht?: string
  member?: number
  type?: string
  available?: number
}) {
  const totalAmount = bahtTextToSatang(voucher.amount_baht)
  const redeemedAmount = bahtTextToSatang(voucher.redeemed_amount_baht || '0')
  const member = Number(voucher.member || 1)

  if (member <= 1) return totalAmount
  if (voucher.type === 'F') return Math.round(totalAmount / member)
  if (voucher.type === 'R' && voucher.available === 1) return totalAmount - redeemedAmount

  return 0
}

async function verifyVoucherAmount(voucherCode: string) {
  const response = await fetch(`${TRUEMONEY_BASE_URL}/campaign/vouchers/${voucherCode}/verify`, {
    cache: 'no-store',
  })
  const data = await response.json().catch(() => null)

  if (!response.ok || data?.status?.code !== 'SUCCESS' || !data?.data?.voucher) {
    return {
      success: false as const,
      error: data?.status?.message || 'ไม่สามารถตรวจสอบยอดเงินในซองได้',
      code: data?.status?.code,
    }
  }

  return {
    success: true as const,
    amountSatang: getAvailableVoucherAmountSatang(data.data.voucher),
  }
}

export async function POST(request: Request) {
  try {
    const receivePhone = process.env.TMN_RECEIVE_PHONE

    if (!receivePhone) {
      return NextResponse.json(
        { success: false, error: 'ยังไม่ได้ตั้งค่า TMN_RECEIVE_PHONE' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
    const voucherLink = typeof body.voucherLink === 'string' ? body.voucherLink.trim() : ''

    if (!orderId || !voucherLink) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุหมายเลขออเดอร์และลิงก์ซองอั่งเปา' },
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
        orderItems: true,
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
        { success: false, error: 'ออเดอร์นี้ชำระเงินแล้วหรือกำลังจัดส่งอยู่ ไม่สามารถชำระซ้ำได้' },
        { status: 400 }
      )
    }

    if (order.orderItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ออเดอร์นี้ไม่มีรายการสินค้า กรุณาติดต่อแอดมิน' },
        { status: 400 }
      )
    }

    const requiredAmountBaht = moneyToNumber(order.total)
    const requiredAmountSatang = Math.round(requiredAmountBaht * 100)

    if (!Number.isFinite(requiredAmountSatang) || requiredAmountSatang < 1) {
      return NextResponse.json(
        { success: false, error: 'ยอดชำระของออเดอร์ไม่ถูกต้อง กรุณาติดต่อแอดมิน' },
        { status: 400 }
      )
    }

    const normalizedPhone = normalizePhone(receivePhone)
    const voucherCode = extractVoucherCode(voucherLink)
    const normalizedVoucherLink = voucherLink.includes('gift.truemoney.com')
      ? voucherLink
      : `https://gift.truemoney.com/campaign/?v=${voucherCode}`

    const voucherAmount = await verifyVoucherAmount(voucherCode)

    if (!voucherAmount.success) {
      return NextResponse.json(
        {
          success: false,
          error: voucherAmount.error,
          code: voucherAmount.code,
        },
        { status: 400 }
      )
    }

    if (voucherAmount.amountSatang < requiredAmountSatang) {
      return NextResponse.json(
        {
          success: false,
          error: `ยอดเงินในซองไม่พอ ต้องชำระ ${requiredAmountBaht.toLocaleString('th-TH')} บาท`,
        },
        { status: 400 }
      )
    }

    const redeemResult = await redeemvouchers(normalizedPhone, normalizedVoucherLink)

    if (!redeemResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: getRedeemErrorMessage(redeemResult),
          code: redeemResult.code,
        },
        { status: 400 }
      )
    }

    const receivedAmountSatang = redeemResult.amount

    if (receivedAmountSatang < requiredAmountSatang) {
      return NextResponse.json(
        {
          success: false,
          error: `ยอดเงินในซองไม่พอ ต้องชำระ ${requiredAmountBaht.toLocaleString('th-TH')} บาท`,
        },
        { status: 400 }
      )
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        slipUrl: `truemoney-voucher:${voucherCode}`,
      },
    })

    const fulfilledOrder = await fulfillPaidOrder(order.id)

    await prisma.order.update({
      where: { id: order.id },
      data: {
        slipUrl: `truemoney-voucher:${voucherCode}`,
      },
    }).catch((error) => {
      console.error('Failed to keep TrueMoney payment marker:', error)
    })

    return NextResponse.json({
      success: true,
      data: {
        ...fulfilledOrder,
        paymentMethod: 'truemoney-voucher',
        amountReceived: receivedAmountSatang / 100,
        amountRequired: requiredAmountBaht,
      },
    })
  } catch (error) {
    console.error('TrueMoney payment error:', error)

    const message = error instanceof Error && error.message === 'INVALID_TMN_PHONE'
      ? 'เบอร์รับเงิน TrueMoney ในระบบไม่ถูกต้อง กรุณาติดต่อแอดมิน'
      : 'เกิดข้อผิดพลาดในการตรวจสอบซองอั่งเปา กรุณาลองใหม่อีกครั้ง'

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
