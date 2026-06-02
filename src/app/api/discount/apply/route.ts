import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

function normalizeCode(code: unknown) {
  return typeof code === 'string' ? code.trim().toUpperCase() : ''
}

function getCartSubTotal(items: any[]) {
  return items.reduce((sum, item) => {
    const price = Number(item?.product?.price ?? 0)
    const quantity = Number(item?.quantity ?? 0)
    return sum + (Number.isFinite(price) && Number.isFinite(quantity) ? price * quantity : 0)
  }, 0)
}

function hasMatchingItem(items: any[], discount: any, categorySlug?: string | null) {
  if (!discount.applicableType && !discount.applicableCategoryId) return true

  return items.some((item) => {
    const product = item?.product
    if (!product) return false

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
    const subTotal = Number.isFinite(Number(body.subTotal)) ? Number(body.subTotal) : getCartSubTotal(items)

    if (!normalizedCode) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกโค้ดส่วนลด' },
        { status: 400 }
      )
    }

    if (!Array.isArray(items) || items.length === 0 || subTotal <= 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบสินค้าในตะกร้า' },
        { status: 400 }
      )
    }

    const discountCode = await prisma.discountCode.findUnique({
      where: { code: normalizedCode },
    })

    if (!discountCode) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบโค้ดส่วนลดนี้ กรุณาตรวจสอบอีกครั้ง' },
        { status: 404 }
      )
    }

    if (!discountCode.isActive) {
      return NextResponse.json(
        { success: false, error: 'โค้ดส่วนลดนี้ถูกปิดใช้งานแล้ว' },
        { status: 400 }
      )
    }

    if (discountCode.maxUses !== null && discountCode.usedCount >= discountCode.maxUses) {
      return NextResponse.json(
        { success: false, error: 'โค้ดส่วนลดนี้ถูกใช้ครบจำนวนแล้ว' },
        { status: 400 }
      )
    }

    if (discountCode.expiresAt && discountCode.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, error: 'โค้ดส่วนลดนี้หมดอายุแล้ว' },
        { status: 400 }
      )
    }

    if (subTotal < discountCode.minPurchaseAmount) {
      return NextResponse.json(
        { success: false, error: `ต้องมียอดสั่งซื้อขั้นต่ำ ${discountCode.minPurchaseAmount.toLocaleString('th-TH')} บาท` },
        { status: 400 }
      )
    }

    const category = discountCode.applicableCategoryId
      ? await prisma.category.findUnique({ where: { id: discountCode.applicableCategoryId } })
      : null

    if (!hasMatchingItem(items, discountCode, category?.slug)) {
      return NextResponse.json(
        { success: false, error: 'คูปองนี้ใช้ไม่ได้กับสินค้าในตะกร้า' },
        { status: 400 }
      )
    }

    if (!['PERCENT', 'FIXED'].includes(discountCode.discountType)) {
      return NextResponse.json(
        { success: false, error: 'รูปแบบโค้ดส่วนลดไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        code: discountCode.code,
        type: discountCode.discountType,
        value: discountCode.discountValue,
        minPurchaseAmount: discountCode.minPurchaseAmount,
      },
    })
  } catch (error) {
    console.error('Error applying discount:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบโค้ดส่วนลด' },
      { status: 500 }
    )
  }
}
