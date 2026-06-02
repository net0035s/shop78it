import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

/**
 * GET /api/admin/categories
 * ดึงหมวดหมู่สินค้าทั้งหมด
 */
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ success: false, error: 'ไม่สามารถดึงหมวดหมู่ได้' }, { status: 500 })
  }
}

/**
 * POST /api/admin/categories
 * เพิ่มหมวดหมู่ใหม่
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, slug, icon, color, sortOrder } = body

    if (!name || !slug) {
      return NextResponse.json({ success: false, error: 'กรุณากรอกชื่อและ Slug' }, { status: 400 })
    }

    // Check duplicate slug
    const existing = await prisma.category.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json({ success: false, error: `Slug "${slug}" มีอยู่แล้ว กรุณาใช้ชื่ออื่น` }, { status: 400 })
    }

    const newCategory = await prisma.category.create({
      data: { name, slug, icon: icon || '📦', color: color || '#6366f1', sortOrder: sortOrder || 99, isActive: true },
    })

    return NextResponse.json({ success: true, data: newCategory })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการสร้างหมวดหมู่' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/categories
 * แก้ไขหมวดหมู่
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, name, slug, icon, color, sortOrder, isActive } = body

    if (!id || !name || !slug) {
      return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบถ้วน (id, name, slug)' }, { status: 400 })
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { name, slug, icon, color, sortOrder, isActive },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการแก้ไขหมวดหมู่' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/categories?id=...
 * ลบหมวดหมู่ (ตรวจสอบก่อนว่ามีสินค้าผูกอยู่ไหม)
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ Category ID' }, { status: 400 })
    }

    const category = await prisma.category.findUnique({ where: { id } })
    if (!category) {
      return NextResponse.json({ success: false, error: 'ไม่พบหมวดหมู่ที่ต้องการลบ' }, { status: 404 })
    }

    // Check if products use this category
    const productsUsingCat = await prisma.product.count({
      where: {
        OR: [
          { categoryId: id },
          { category: category.slug },
        ],
      },
    })
    if (productsUsingCat > 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถลบได้ เนื่องจากยังมีสินค้าในหมวดหมู่นี้' },
        { status: 400 }
      )
    }

    await prisma.category.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'ลบหมวดหมู่เรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการลบหมวดหมู่' }, { status: 500 })
  }
}
