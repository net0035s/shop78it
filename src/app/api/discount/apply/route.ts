import prisma from '@/lib/db'
import { moneyToNumber } from '@/lib/money'
import { jsonUtf8 } from '@/lib/json-response'

function normalizeCode(code: unknown) {
  return typeof code === 'string' ? code.trim().toUpperCase() : ''
}

function normalizeItems(items: any[]) {
  return items.map((item) => ({
    productId: typeof item?.productId === 'string' ? item.productId : '',
    quantity: Number(item?.quantity),
  }))
}

function hasMatchingProduct(products: any[], discount: any, categorySlug?: string | null) {
  if (!discount.applicableType && !discount.applicableCategoryId) return true

  return products.some((product) => {
    const typeMatches = !discount.applicableType || product.deliveryType === discount.applicableType
    const categoryMatches =
      !discount.applicableCategoryId ||
      product.categoryId === discount.applicableCategoryId ||
      product.category === discount.applicableCategoryId ||
      product.category === categorySlug

    return typeMatches && categoryMatches
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const normalizedCode = normalizeCode(body.code)
    const items = Array.isArray(body.items) ? body.items : []
    const normalizedItems = normalizeItems(items)

    if (!normalizedCode) {
      return jsonUtf8(
        { success: false, error: 'กรุณากรอกโค้ดส่วนลด' },
        { status: 400 }
      )
    }

    if (
      normalizedItems.length === 0 ||
      normalizedItems.some((item) => !item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0)
    ) {
      return jsonUtf8(
        { success: false, error: 'ไม่พบสินค้าในตะกร้า' },
        { status: 400 }
      )
    }

    const products = await prisma.product.findMany({
      where: { id: { in: normalizedItems.map((item) => item.productId) } },
    })

    if (products.length !== new Set(normalizedItems.map((item) => item.productId)).size) {
      return jsonUtf8(
        { success: false, error: 'รายการสินค้าไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const productById = new Map(products.map((product) => [product.id, product]))
    const subTotal = normalizedItems.reduce((sum, item) => {
      const product = productById.get(item.productId)
      return sum + (product ? moneyToNumber(product.price) * item.quantity : 0)
    }, 0)

    const discountCode = await prisma.discountCode.findUnique({
      where: { code: normalizedCode },
    })

    if (!discountCode) {
      return jsonUtf8(
        { success: false, error: 'ไม่พบโค้ดส่วนลดนี้ กรุณาตรวจสอบอีกครั้ง' },
        { status: 404 }
      )
    }

    if (!discountCode.isActive) {
      return jsonUtf8(
        { success: false, error: 'โค้ดส่วนลดนี้ถูกปิดใช้งานแล้ว' },
        { status: 400 }
      )
    }

    if (discountCode.maxUses !== null && discountCode.usedCount >= discountCode.maxUses) {
      return jsonUtf8(
        { success: false, error: 'โค้ดส่วนลดนี้ถูกใช้ครบจำนวนแล้ว' },
        { status: 400 }
      )
    }

    if (discountCode.expiresAt && discountCode.expiresAt.getTime() < Date.now()) {
      return jsonUtf8(
        { success: false, error: 'โค้ดส่วนลดนี้หมดอายุแล้ว' },
        { status: 400 }
      )
    }

    const minPurchaseAmount = moneyToNumber(discountCode.minPurchaseAmount)
    if (subTotal < minPurchaseAmount) {
      return jsonUtf8(
        { success: false, error: `ต้องมียอดสั่งซื้อขั้นต่ำ ${minPurchaseAmount.toLocaleString('th-TH')} บาท` },
        { status: 400 }
      )
    }

    const category = discountCode.applicableCategoryId
      ? await prisma.category.findUnique({ where: { id: discountCode.applicableCategoryId } })
      : null

    if (!hasMatchingProduct(products, discountCode, category?.slug)) {
      return jsonUtf8(
        { success: false, error: 'คูปองนี้ใช้ไม่ได้กับสินค้าในตะกร้า' },
        { status: 400 }
      )
    }

    if (!['PERCENT', 'FIXED'].includes(discountCode.discountType)) {
      return jsonUtf8(
        { success: false, error: 'รูปแบบโค้ดส่วนลดไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    return jsonUtf8({
      success: true,
      data: {
        code: discountCode.code,
        type: discountCode.discountType,
        value: moneyToNumber(discountCode.discountValue),
        minPurchaseAmount,
      },
    })
  } catch (error) {
    console.error('Error applying discount:', error)
    return jsonUtf8(
      { success: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบโค้ดส่วนลด' },
      { status: 500 }
    )
  }
}
