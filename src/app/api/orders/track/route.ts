import prisma from '@/lib/db'
import { CommerceError, emailField, textField } from '@/lib/commerce-rules'
import { sameOrigin, limitRequests, readJson, apiError } from '@/lib/server-guards'
import { jsonUtf8 } from '@/lib/json-response'
import { moneyToNumber } from '@/lib/money'

export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try {
    sameOrigin(request)
    await limitRequests(request, 'track-order-summary', 30)
    const body = await readJson(request)
    const orderNumber = textField(body.orderNumber, 'เลขออเดอร์', 100).toUpperCase()
    const email = emailField(body.email)
    // Select only receipt metadata: this lookup must never read or decrypt goods,
    // issue a delivery cookie, or reveal customer/internal/payment credentials.
    const order = await prisma.order.findFirst({
      where: { orderNumber, customerEmail: { equals: email, mode: 'insensitive' } },
      select: { orderNumber: true, status: true, total: true, createdAt: true, paidAt: true,
        orderItems: { select: { id: true, productName: true, quantity: true, price: true, product: { select: { name: true } } } } },
    })
    if (!order) throw new CommerceError('ไม่พบออเดอร์ที่ตรงกับเลขออเดอร์และอีเมลนี้', 404)
    return jsonUtf8({ success: true, accessEmailAvailable: !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS, data: {
      orderNumber: order.orderNumber, status: order.status, total: moneyToNumber(order.total),
      createdAt: order.createdAt.toISOString(), paidAt: order.paidAt?.toISOString(),
      items: order.orderItems.map(item => ({ orderItemId: item.id, name: item.productName ?? item.product.name, quantity: item.quantity, unitPrice: moneyToNumber(item.price) })),
    } }, { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })
  } catch (error) { return apiError(error) }
}
