import prisma from '@/lib/db'
import { jsonUtf8 } from '@/lib/json-response'
import { moneyToNumber } from '@/lib/money'
import { fulfillPaidOrder } from '@/lib/order-fulfillment'
import { sendTelegramNotify } from '@/lib/telegram'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SLIPOK_BASE_URL = 'https://api.slipok.com/api/line/apikey'

async function readSlipOkResponse(response: Response) {
  const text = await response.text().catch(() => '')

  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function getSlipOkFallbackMessage(payload: any) {
  if (!payload) return undefined
  if (typeof payload === 'string') return payload

  return (
    payload.message ||
    payload.error ||
    payload.data?.message ||
    payload.data?.error ||
    payload.data?.detail
  )
}

function getSlipOkErrorMessage(code: unknown, status: number, fallback?: string) {
  const normalizedCode = Number(code)
  const cleanFallback = typeof fallback === 'string' ? fallback.trim() : ''

  if (status === 404 || /^not found$/i.test(cleanFallback)) {
    return 'ไม่พบสาขา SlipOK หรือ URL ตรวจสลิปไม่ถูกต้อง กรุณาตรวจสอบค่า SLIPOK_BRANCH_ID ใน .env'
  }

  switch (normalizedCode) {
    case 1001:
      return 'ข้อมูลสำหรับตรวจสอบสลิปไม่ครบถ้วน กรุณาอัปโหลดรูปสลิปใหม่อีกครั้ง'
    case 1002:
      return 'รูปแบบไฟล์สลิปไม่ถูกต้อง กรุณาอัปโหลดไฟล์รูปภาพที่รองรับ'
    case 1003:
      return 'ไม่สามารถอ่านข้อมูลจากสลิปนี้ได้ กรุณาใช้รูปสลิปที่ชัดเจนกว่าเดิม'
    case 1004:
      return 'สลิปนี้ไม่ถูกต้องหรือไม่ใช่สลิปโอนเงินจริง'
    case 1005:
      return 'ไม่พบข้อมูล QR Code ในรูปสลิป กรุณาอัปโหลดสลิปตัวจริงจากแอปธนาคาร'
    case 1006:
      return 'บัญชี SlipOK ไม่พร้อมใช้งานหรือสิทธิ์ไม่ถูกต้อง กรุณาติดต่อแอดมิน'
    case 1007:
      return 'สาขา SlipOK ไม่ถูกต้อง กรุณาตรวจสอบค่า SLIPOK_BRANCH_ID'
    case 1008:
      return 'API Key ของ SlipOK ไม่ถูกต้อง กรุณาตรวจสอบค่า SLIPOK_API_KEY'
    case 1009:
      return 'ไม่สามารถติดต่อระบบ SlipOK ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง'
    case 1010:
      return 'รูปสลิปมีขนาดใหญ่เกินไป กรุณาอัปโหลดรูปที่มีขนาดเล็กลง'
    case 1011:
      return 'รูปสลิปไม่ชัดเจนหรือข้อมูลไม่ครบ กรุณาอัปโหลดรูปใหม่'
    case 1012:
      return 'สลิปนี้เคยถูกใช้งานแล้ว'
    case 1013:
      return 'ยอดเงินในสลิปไม่ตรงกับราคาสินค้า'
    case 1014:
      return 'บัญชีผู้รับเงินไม่ตรงกับบัญชีของร้าน'
    case 1015:
      return 'สลิปหมดอายุหรืออยู่นอกช่วงเวลาที่ระบบรองรับ กรุณาตรวจสอบและลองใหม่'
    default:
      return cleanFallback || 'ตรวจสอบสลิปไม่สำเร็จ กรุณาตรวจสอบรูปภาพแล้วลองใหม่'
  }
}

export async function POST(request: Request) {
  try {
    const branchId = process.env.SLIPOK_BRANCH_ID?.trim()
    const apiKey = process.env.SLIPOK_API_KEY?.trim()

    if (!branchId || !apiKey) {
      return jsonUtf8(
        { success: false, error: 'ยังไม่ได้ตั้งค่า SLIPOK_BRANCH_ID หรือ SLIPOK_API_KEY บนระบบ' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const orderId = String(formData.get('orderId') || '').trim()
    const slipFile = formData.get('files')

    if (!orderId || !(slipFile instanceof File)) {
      return jsonUtf8(
        { success: false, error: 'กรุณาระบุหมายเลขออเดอร์และอัปโหลดรูปสลิป' },
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
      return jsonUtf8(
        { success: false, error: 'ไม่พบออเดอร์นี้ กรุณากลับไปทำรายการใหม่หรือติดต่อแอดมิน' },
        { status: 404 }
      )
    }

    if (order.status !== 'pending') {
      return jsonUtf8(
        { success: false, error: 'ออเดอร์นี้ชำระเงินแล้วหรือกำลังจัดส่งอยู่ ไม่สามารถตรวจสลิปซ้ำได้' },
        { status: 400 }
      )
    }

    if (order.orderItems.length === 0) {
      return jsonUtf8(
        { success: false, error: 'ออเดอร์นี้ไม่มีรายการสินค้า กรุณาติดต่อแอดมิน' },
        { status: 400 }
      )
    }

    const amount = moneyToNumber(order.total)
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonUtf8(
        { success: false, error: 'ยอดชำระของออเดอร์ไม่ถูกต้อง กรุณาติดต่อแอดมิน' },
        { status: 400 }
      )
    }

    const slipOkFormData = new FormData()
    slipOkFormData.append('files', slipFile)
    slipOkFormData.append('log', 'true')
    slipOkFormData.append('amount', amount.toString())

    const slipOkEndpoint = `${SLIPOK_BASE_URL}/${encodeURIComponent(branchId)}`
    const slipOkResponse = await fetch(slipOkEndpoint, {
      method: 'POST',
      headers: {
        'x-authorization': apiKey,
      },
      body: slipOkFormData,
    })

    const slipOkResult = await readSlipOkResponse(slipOkResponse)

    if (!slipOkResponse.ok || slipOkResult?.success !== true) {
      const errorCode = slipOkResult?.code ?? slipOkResult?.data?.code
      const fallback = getSlipOkFallbackMessage(slipOkResult)

      return jsonUtf8(
        {
          success: false,
          error: getSlipOkErrorMessage(errorCode, slipOkResponse.status, fallback),
          code: errorCode,
          slipOkStatus: slipOkResponse.status,
        },
        { status: 400 }
      )
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        slipUrl: 'slipok-verified',
      },
    })

    let fulfilledOrder
    try {
      fulfilledOrder = await fulfillPaidOrder(order.id, 'slipok-verified')
    } catch (fulfillError) {
      console.error('SlipOK verified but fulfillment failed:', fulfillError)

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'needs_manual_delivery',
          slipUrl: 'slipok-verified',
          internalNote: [
            order.internalNote,
            'SlipOK payment succeeded, but automatic fulfillment failed. Please deliver manually.',
          ].filter(Boolean).join('\n'),
        },
      }).catch((updateError) => {
        console.error('Failed to mark SlipOK order for manual delivery:', updateError)
      })

      void sendTelegramNotify(
        `🚨 [ฉุกเฉิน] ลูกค้าชำระเงินผ่านสลิปสำเร็จ แต่ออเดอร์ ${order.orderNumber} เกิดข้อผิดพลาดในการตัดสต็อก! กรุณาตรวจสอบและจัดส่งแบบ Manual`
      ).catch((telegramError) => {
        console.error('SlipOK rescue Telegram Notify failed:', telegramError)
      })

      return jsonUtf8({
        success: true,
        warning: true,
        error: 'ชำระเงินสำเร็จ แต่ระบบจัดส่งอัตโนมัติขัดข้อง กรุณาติดต่อแอดมินเพื่อจัดส่งสินค้า',
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: 'needs_manual_delivery',
          paymentMethod: 'slipok-verified',
          amountRequired: amount,
        },
      })
    }

    return jsonUtf8({
      success: true,
      data: {
        ...fulfilledOrder,
        paymentMethod: 'slipok-verified',
        amountRequired: amount,
      },
    })
  } catch (error) {
    console.error('SlipOK payment error:', error)
    return jsonUtf8(
      { success: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบสลิป กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    )
  }
}
