import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { transaction } from '@/lib/transactions'
import { sameOrigin, readJson, apiError } from '@/lib/server-guards'
import { CommerceError } from '@/lib/commerce-rules'
import { requireAdmin } from '@/lib/admin-auth'
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

  if (!/^[A-Z0-9_-]{1,50}$/.test(code) || !['FIXED','PERCENT'].includes(body.discountType) ||
    !Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 99999999 ||
    (discountType === 'PERCENT' && discountValue > 100) ||
    !Number.isFinite(Number(body.minPurchaseAmount ?? 0)) || Number(body.minPurchaseAmount ?? 0) < 0 ||
    (body.maxUses !== undefined && body.maxUses !== null && body.maxUses !== '' && (maxUses === null || !Number.isSafeInteger(maxUses) || maxUses < 1)) ||
    (body.expiresAt && !expiresAt)) throw new CommerceError('ข้อมูลส่วนลด จำนวนสิทธิ์ หรือวันหมดอายุไม่ถูกต้อง')
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
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

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
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    sameOrigin(request)
    const body = await readJson(request)
    const data = buildDiscountData(body)

    if (!data.code || !data.discountValue || data.discountValue <= 0) {
      return NextResponse.json({ success: false, error: 'กรุณากรอกโค้ดและยอดส่วนลดให้ถูกต้อง' }, { status: 400 })
    }

    if (data.applicableCategoryId && !await prisma.category.findUnique({ where: { id: data.applicableCategoryId } })) throw new CommerceError('ไม่พบหมวดหมู่')
    const created = await prisma.discountCode.create({ data })
    return NextResponse.json({ success: true, data: normalizeDiscountMoney(created) })
  } catch (error: any) {
    if (error instanceof CommerceError) return apiError(error)
    console.error('Error creating discount:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'โค้ดนี้มีอยู่แล้ว' }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'สร้างคูปองไม่สำเร็จ' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    sameOrigin(request)
    const body = await readJson(request)
    const id = typeof body.id === 'string' ? body.id : ''
    const data = buildDiscountData(body)

    if (!id || !data.code || !data.discountValue || data.discountValue <= 0) {
      return NextResponse.json({ success: false, error: 'ข้อมูลคูปองไม่ครบถ้วน' }, { status: 400 })
    }

    const updated = await transaction(async tx => {
      const old = await tx.discountCode.findUniqueOrThrow({ where: { id } })
      if (old.usedCount > 0 && old.code !== data.code) throw new CommerceError('คูปองมีประวัติใช้งานแล้ว ไม่สามารถเปลี่ยนโค้ด',409)
      if (data.maxUses !== null && data.maxUses < old.usedCount) throw new CommerceError('จำนวนสิทธิ์ต่ำกว่ายอดใช้และจองปัจจุบัน',409)
      if (data.applicableCategoryId && !await tx.category.findUnique({ where: { id: data.applicableCategoryId } })) throw new CommerceError('ไม่พบหมวดหมู่')
      return tx.discountCode.update({ where: { id }, data })
    })
    return NextResponse.json({ success: true, data: normalizeDiscountMoney(updated) })
  } catch (error: any) {
    if (error instanceof CommerceError) return apiError(error)
    console.error('Error updating discount:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'โค้ดนี้มีอยู่แล้ว' }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: 'แก้ไขคูปองไม่สำเร็จ' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    sameOrigin(request)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุคูปองที่ต้องการลบ' }, { status: 400 })
    }

    await transaction(async tx => {
      const old = await tx.discountCode.findUniqueOrThrow({ where: { id } })
      if (old.usedCount > 0) throw new CommerceError('คูปองมีการใช้หรือจองแล้ว กรุณาปิดใช้งานแทนการลบ',409)
      await tx.discountCode.delete({ where: { id } })
    })
    return NextResponse.json({ success: true, message: 'ลบคูปองเรียบร้อยแล้ว' })
  } catch (error) {
    if (error instanceof CommerceError) return apiError(error)
    console.error('Error deleting discount:', error)
    return NextResponse.json({ success: false, error: 'ลบคูปองไม่สำเร็จ' }, { status: 500 })
  }
}
