import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/products
 * ดึงรายการสินค้าทั้งหมดฝั่งผู้ดูแลระบบ
 */
export async function GET() {
  try {
    const rawProducts = await prisma.product.findMany({
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
    })

    const products = rawProducts.map(p => ({
      ...p,
      stock: p._count?.digitalStocks || 0
    }))

    return NextResponse.json({ success: true, data: products })
  } catch (error) {
    console.error('Error fetching admin products:', error)
    return NextResponse.json(
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
      deliveryInfo,
      deliveryType,
    } = body

    if (!name || !description || !price || !category) {
      return NextResponse.json(
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
        deliveryInfo: deliveryInfo || 'ส่งด่วนอัตโนมัติ',
        deliveryType: deliveryType || 'auto',
      },
    })

    return NextResponse.json({ success: true, data: newProduct })
  } catch (error) {
    console.error('Error creating admin product:', error)
    return NextResponse.json(
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
      deliveryInfo,
      deliveryType,
    } = body

    if (!id || !name || !description || !price || !category) {
      return NextResponse.json(
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
        deliveryInfo: deliveryInfo || 'ส่งด่วนอัตโนมัติ',
        deliveryType: deliveryType || 'auto',
      },
    })

    return NextResponse.json({ success: true, data: updatedProduct })
  } catch (error) {
    console.error('Error updating admin product:', error)
    return NextResponse.json(
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
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ Product ID เพื่อลบสินค้า' },
        { status: 400 }
      )
    }

    await prisma.product.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'ลบสินค้าเสร็จสิ้น' })
  } catch (error) {
    console.error('Error deleting admin product:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการลบสินค้า' },
      { status: 500 }
    )
  }
}
