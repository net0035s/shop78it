import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { normalizeDiscountMoney } from '@/lib/money'

function normalizeCode(code: unknown) {
  return typeof code === 'string' ? code.trim().toUpperCase() : ''
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalDate(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function buildDiscountData(body: any) {
  const code = normalizeCode(body.code)
  const discountType = body.discountType === 'FIXED' ? 'FIXED' : 'PERCENT'
  const discountValue = Number(body.discountValue)
  const minPurchaseAmount = parseOptionalNumber(body.minPurchaseAmount) ?? 0
  const maxUses = parseOptionalNumber(body.maxUses)
  const expiresAt = parseOptionalDate(body.expiresAt)
  const applicableType = ['auto', 'manual'].includes(body.applicableType) ? body.applicableType : null
  const applicableCategoryId = body.applicableCategoryId || null

  return {
    code,
    discountType,
    discountValue,
    isActive: body.isActive !== false,
    minPurchaseAmount: Math.max(0, minPurchaseAmount),
    applicableType,
    applicableCategoryId,
    maxUses: maxUses && maxUses > 0 ? Math.floor(maxUses) : null,
    expiresAt,
  }
}

export async function GET() {
  try {
    const discounts = await prisma.discountCode.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: discounts.map(normalizeDiscountMoney) })
  } catch (error) {
    console.error('Error fetching discounts:', error)
    return NextResponse.json({ success: false, error: 'ไม่สามารถดึงข้อมูลคูปองได้' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = buildDiscountData(body)

    if (!data.code || !data.discountValue || data.discountValue <= 0) {
      return NextResponse.json({ success: false, error: 'กรุณากรอกโค้ดและยอดส่วนลดให้ถูกต้อง' }, { status: 400 })
    }

    const created = await prisma.discountCode.create({ data })
    return NextResponse.json({ success: true, data: normalizeDiscountMoney(created) })
  } catch (error: any) {
    console.error('Error creating discount:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'โค้ดนี้มีอยู่แล้ว' }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'สร้างคูปองไม่สำเร็จ' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const data = buildDiscountData(body)

    if (!id || !data.code || !data.discountValue || data.discountValue <= 0) {
      return NextResponse.json({ success: false, error: 'ข้อมูลคูปองไม่ครบถ้วน' }, { status: 400 })
    }

    const updated = await prisma.discountCode.update({
      where: { id },
      data,
    })
    return NextResponse.json({ success: true, data: normalizeDiscountMoney(updated) })
  } catch (error: any) {
    console.error('Error updating discount:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'โค้ดนี้มีอยู่แล้ว' }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'แก้ไขคูปองไม่สำเร็จ' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุคูปองที่ต้องการลบ' }, { status: 400 })
    }

    await prisma.discountCode.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'ลบคูปองเรียบร้อยแล้ว' })
  } catch (error) {
    console.error('Error deleting discount:', error)
    return NextResponse.json({ success: false, error: 'ลบคูปองไม่สำเร็จ' }, { status: 500 })
  }
}
