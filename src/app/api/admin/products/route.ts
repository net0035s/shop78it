import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { normalizeProductMoney } from '@/lib/money'
import { jsonUtf8 } from '@/lib/json-response'

export const dynamic = 'force-dynamic'

const PAID_ORDER_STATUSES = ['completed', 'needs_manual_delivery', 'paid']

function parseNonNegativeInt(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
}

/**
 * GET /api/admin/products
 * ดึงรายการสินค้าทั้งหมดฝั่งผู้ดูแลระบบ
 */
export async function GET() {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    const [rawProducts, soldQuantityGroups] = await Promise.all([
      prisma.product.findMany({
        include: {
          _count: {
            select: {
              digitalStocks: {
                where: { isSold: false }
              }
            }
          }
        },
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            status: { in: PAID_ORDER_STATUSES },
          },
        },
        _sum: {
          quantity: true,
        },
      }),
    ])

    const realSoldByProductId = new Map(
      soldQuantityGroups.map((group) => [group.productId, group._sum.quantity ?? 0])
    )

    const products = rawProducts.map(p => {
      const realSold = realSoldByProductId.get(p.id) ?? 0
      const manualSoldCount = p.manualSoldCount ?? 0

      return {
        ...normalizeProductMoney(p),
        stock: p._count?.digitalStocks || 0,
        manualSoldCount,
        realSold,
        totalSold: realSold + manualSoldCount,
      }
    })

    return jsonUtf8({ success: true, data: products })
  } catch (error) {
    console.error('Error fetching admin products:', error)
    return jsonUtf8(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/products
 * เพิ่มสินค้าตัวใหม่ลงฐานข้อมูล
 */
export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    const body = await request.json()
    const {
      name,
      description,
      price,
      originalPrice,
      image,
      category,
      tags,
      isNew,
      isFeatured,
      showFeatures,
      features,
      manualSoldCount,
      showInstruction,
      instruction,
      deliveryInfo,
      deliveryType,
    } = body

    if (!name || !description || !price || !category) {
      return jsonUtf8(
        { success: false, error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (ชื่อ, รายละเอียด, ราคา, หมวดหมู่)' },
        { status: 400 }
      )
    }

    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        image: image || '/images/products/placeholder.png',
        category,
        stock: 0,
        stockStatus: 'out-of-stock',
        tags: tags || '',
        isNew: !!isNew,
        isFeatured: !!isFeatured,
        showFeatures: !!showFeatures,
        features: typeof features === 'string' ? features.trim() || null : null,
        manualSoldCount: parseNonNegativeInt(manualSoldCount),
        showInstruction: !!showInstruction,
        instruction: instruction?.trim() || null,
        deliveryInfo: deliveryInfo || 'ส่งด่วนอัตโนมัติ',
        deliveryType: deliveryType || 'auto',
      },
    })

    return jsonUtf8({ success: true, data: normalizeProductMoney(newProduct) })
  } catch (error) {
    console.error('Error creating admin product:', error)
    return jsonUtf8(
      { success: false, error: 'เกิดข้อผิดพลาดในการเพิ่มสินค้า' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/products
 * แก้ไขรายละเอียดสินค้าในฐานข้อมูล
 */
export async function PUT(request: Request) {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    const body = await request.json()
    const {
      id,
      name,
      description,
      price,
      originalPrice,
      image,
      category,
      tags,
      isNew,
      isFeatured,
      showFeatures,
      features,
      manualSoldCount,
      showInstruction,
      instruction,
      deliveryInfo,
      deliveryType,
    } = body

    if (!id || !name || !description || !price || !category) {
      return jsonUtf8(
        { success: false, error: 'ข้อมูลสำหรับแก้ไขสินค้าไม่ครบถ้วน' },
        { status: 400 }
      )
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        image: image || '/images/products/placeholder.png',
        category,
        tags: tags || '',
        isNew: !!isNew,
        isFeatured: !!isFeatured,
        showFeatures: !!showFeatures,
        features: typeof features === 'string' ? features.trim() || null : null,
        manualSoldCount: parseNonNegativeInt(manualSoldCount),
        showInstruction: !!showInstruction,
        instruction: instruction?.trim() || null,
        deliveryInfo: deliveryInfo || 'ส่งด่วนอัตโนมัติ',
        deliveryType: deliveryType || 'auto',
      },
    })

    return jsonUtf8({ success: true, data: normalizeProductMoney(updatedProduct) })
  } catch (error) {
    console.error('Error updating admin product:', error)
    return jsonUtf8(
      { success: false, error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูลสินค้า' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/products?id=...
 * ลบสินค้าออกจากระบบ
 */
export async function DELETE(request: Request) {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return jsonUtf8(
        { success: false, error: 'กรุณาระบุ Product ID เพื่อลบสินค้า' },
        { status: 400 }
      )
    }

    await prisma.product.delete({
      where: { id },
    })

    return jsonUtf8({ success: true, message: 'ลบสินค้าเสร็จสิ้น' })
  } catch (error) {
    console.error('Error deleting admin product:', error)
    return jsonUtf8(
      { success: false, error: 'เกิดข้อผิดพลาดในการลบสินค้า' },
      { status: 500 }
    )
  }
}
