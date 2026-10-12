import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { updateCategory } from '@/lib/admin-category'
import { transaction } from '@/lib/transactions'
import { sameOrigin, readJson, apiError } from '@/lib/server-guards'
import { CommerceError, textField } from '@/lib/commerce-rules'
function validateCategory(b: any) {
 textField(b.name,'ชื่อหมวดหมู่',100)
 if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(b.slug)) throw new CommerceError('Slug ใช้ตัวอักษรอังกฤษเล็ก ตัวเลข และขีดกลาง')
 if (b.sortOrder !== undefined && !Number.isSafeInteger(b.sortOrder)) throw new CommerceError('ลำดับต้องเป็นจำนวนเต็ม')
}
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/categories
 * ดึงหมวดหมู่สินค้าทั้งหมด
 */
export async function GET() {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

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
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    sameOrigin(request)
    const body = await readJson(request)
    validateCategory(body)
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
      data: { name, slug, icon: icon || '📦', color: color || '#6366f1', sortOrder: sortOrder ?? 99, isActive: true },
    })

    return NextResponse.json({ success: true, data: newCategory })
  } catch (error) {
    if (error instanceof CommerceError) return apiError(error)
    console.error('Error creating category:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการสร้างหมวดหมู่' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/categories
 * แก้ไขหมวดหมู่
 */
export async function PUT(request: Request) {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    sameOrigin(request)
    const body = await readJson(request)
    validateCategory(body)
    const { id, name, slug, icon, color, sortOrder, isActive } = body

    if (!id || !name || !slug) {
      return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบถ้วน (id, name, slug)' }, { status: 400 })
    }

    const updated = await updateCategory(id,{ name, slug, icon, color, sortOrder, isActive })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof CommerceError) return apiError(error)
    console.error('Error updating category:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการแก้ไขหมวดหมู่' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/categories?id=...
 * ลบหมวดหมู่ (ตรวจสอบก่อนว่ามีสินค้าผูกอยู่ไหม)
 */
export async function DELETE(request: Request) {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    sameOrigin(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ Category ID' }, { status: 400 })
    }

    await transaction(async tx=>{
      const category=await tx.category.findUniqueOrThrow({where:{id}})
      const products=await tx.product.count({where:{OR:[{categoryId:id},{category:category.slug}]}})
      const coupons=await tx.discountCode.count({where:{applicableCategoryId:id}})
      if(products||coupons)throw new CommerceError('หมวดหมู่ยังถูกใช้กับสินค้าหรือคูปอง ไม่สามารถลบได้',409)
      await tx.category.delete({where:{id}})
    })
    return NextResponse.json({ success: true, message: 'ลบหมวดหมู่เรียบร้อยแล้ว' })
  } catch (error) {
    if (error instanceof CommerceError) return apiError(error)
    console.error('Error deleting category:', error)
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการลบหมวดหมู่' }, { status: 500 })
  }
}
