import prisma from '@/lib/db'
import { assertOrderingReady } from '@/lib/launch-readiness'
import { generateOrderNumber } from '@/lib/utils'
import { assertEncryptionReady } from '@/lib/encryption'
import { calculateDiscount, emailField, normalizeCart, ORDER_TTL_MS, textField, CommerceError } from '@/lib/commerce-rules'
import { sameOrigin, limitRequests, readJson, apiError } from '@/lib/server-guards'
import { transaction } from '@/lib/transactions'
import { createOrderSession, requireOrderAccess, setOrderCookie } from '@/lib/order-access'
import { reserveInventory } from '@/lib/inventory'
import { orderInclude, orderSummary } from '@/lib/order-summary'
import { fulfillPaidOrder } from '@/lib/order-fulfillment'
import { tryNotifications } from '@/lib/notifications'
import { jsonUtf8 } from '@/lib/json-response'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    assertOrderingReady(); sameOrigin(request); assertEncryptionReady()
    await limitRequests(request, 'create-order', 10)
    const body = await readJson(request)
    const items = normalizeCart(body.items)
    const customerName = textField(body.customer?.name, 'ชื่อ', 150)
    const customerEmail = emailField(body.customer?.email)
    const customerPhone = textField(body.customer?.phone, 'เบอร์โทร', 20, true)
    if (customerPhone && !/^\+?[\d\s-]{9,20}$/.test(customerPhone)) throw new CommerceError('เบอร์โทรไม่ถูกต้อง')
    const code = textField(body.discountCode, 'คูปอง', 80, true).toUpperCase()
    const { order, token } = await transaction(async tx => {
      const products = await tx.product.findMany({ where: { id: { in: items.map(i=>i.productId) } } })
      if (products.length !== items.length) throw new CommerceError('ไม่พบสินค้าบางรายการ', 404)
      const lines = items.map(item=>({ ...item, product: products.find(p=>p.id === item.productId)! }))
      const discount = code ? await tx.discountCode.findUnique({ where: { code } }) : null
      if (code && !discount) throw new CommerceError('ไม่พบคูปอง')
      const category = discount?.applicableCategoryId ? await tx.category.findUnique({ where: { id: discount.applicableCategoryId } }) : null
      const price = calculateDiscount(lines, discount, category?.slug)
      if (discount) {
        const held = await tx.discountCode.updateMany({ where: { id: discount.id, isActive: true, ...(discount.maxUses !== null && { usedCount: { lt: discount.maxUses } }) }, data: { usedCount: { increment: 1 } } })
        if (!held.count) throw new CommerceError('สิทธิ์คูปองหมดแล้ว', 409)
      }
      const order = await tx.order.create({ data: {
        orderNumber: generateOrderNumber(), customerName, customerEmail, customerPhone: customerPhone || null,
        subTotal: price.subtotal/100, discountAmount: price.discountAmount/100, total: price.total/100,
        discountCode: discount?.code, discountReserved: !!discount, expiresAt: new Date(Date.now()+ORDER_TTL_MS),
        orderItems: { create: lines.map(line=>({ productId: line.productId, quantity: line.quantity, price: line.product.price, productName: line.product.name, productImage: line.product.image, deliveryType: line.product.deliveryType })) },
      } })
      await reserveInventory(tx, order.id)
      if (price.total === 0) {
        await tx.order.update({ where: { id: order.id }, data: { status: 'paid', paidAt: new Date() } })
        await tx.paymentAttempt.create({ data: { orderId: order.id, method: 'free', requestKey: `free:${order.id}`, reference: `free:${order.id}`, status: 'verified', expectedAmount: 0, receivedAmount: 0 } })
      }
      const token = await createOrderSession(tx, order.id)
      return { order, token }
    })
    if (Number(order.total) === 0) {
      try { await fulfillPaidOrder(order.id); await tryNotifications(order.id) }
      catch { console.error('Free order saved as paid; delivery retry is queued by maintenance') }
    }
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude })
    return setOrderCookie(jsonUtf8({ success: true, data: orderSummary(saved) }), order.orderNumber, token)
  } catch (error) { return apiError(error) }
}
export async function GET(request: Request) {
  try {
    await limitRequests(request, 'read-order', 90)
    const number = textField(new URL(request.url).searchParams.get('orderNumber'), 'เลขออเดอร์', 100).toUpperCase()
    const access = await requireOrderAccess(request, number)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: access.id }, include: orderInclude })
    return jsonUtf8({ success: true, data: orderSummary(order) }, { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })
  } catch (error) { return apiError(error) }
}
