import prisma from '@/lib/db'
import { calculateDiscount, normalizeCart, textField, CommerceError } from '@/lib/commerce-rules'
import { sameOrigin, limitRequests, readJson, apiError } from '@/lib/server-guards'
import { jsonUtf8 } from '@/lib/json-response'
export async function POST(request: Request) {
  try {
    sameOrigin(request); await limitRequests(request, 'coupon', 20)
    const body = await readJson(request)
    const items = normalizeCart(body.items), code = textField(body.code, 'คูปอง', 80).toUpperCase()
    const products = await prisma.product.findMany({ where: { id: { in: items.map(i=>i.productId) } } })
    if (products.length !== items.length) throw new CommerceError('ไม่พบสินค้าบางรายการ')
    const discount = await prisma.discountCode.findUnique({ where: { code } })
    if (!discount) throw new CommerceError('ไม่พบคูปอง')
    const category = discount.applicableCategoryId ? await prisma.category.findUnique({ where: { id: discount.applicableCategoryId } }) : null
    const lines = items.map(i=>({ product: products.find(p=>p.id===i.productId)!, quantity: i.quantity }))
    const price = calculateDiscount(lines, discount, category?.slug)
    return jsonUtf8({ success: true, data: { code, type: discount.discountType, value: Number(discount.discountValue), minPurchaseAmount: Number(discount.minPurchaseAmount), amount: price.discountAmount/100, cartSignature: JSON.stringify(items) } })
  } catch (error) { return apiError(error) }
}
