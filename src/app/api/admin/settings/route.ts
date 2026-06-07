import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SETTINGS_ID = 'store-settings'

type StoreSettingsRow = {
  logoUrl: string | null
  updatedAt: Date | null
}

function normalizeLogoUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

export async function GET() {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    const rows = await prisma.$queryRaw<StoreSettingsRow[]>`
      SELECT "logoUrl", "updatedAt"
      FROM "StoreSettings"
      WHERE "id" = ${SETTINGS_ID}
      LIMIT 1
    `
    const settings = rows[0]

    return NextResponse.json({
      success: true,
      data: {
        logoUrl: settings?.logoUrl || null,
        updatedAt: settings?.updatedAt || null,
      },
    })
  } catch (error) {
    console.error('Admin settings GET failed:', error)
    return NextResponse.json(
      { success: false, error: 'โหลดการตั้งค่าร้านค้าไม่สำเร็จ' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    const body = await request.json().catch(() => ({}))
    const logoUrl = normalizeLogoUrl(body.logoUrl)

    if (body.logoUrl && !logoUrl) {
      return NextResponse.json(
        { success: false, error: 'ลิงก์โลโก้ไม่ถูกต้อง กรุณาใช้ URL ที่ขึ้นต้นด้วย http หรือ https' },
        { status: 400 }
      )
    }

    const rows = await prisma.$queryRaw<StoreSettingsRow[]>`
      INSERT INTO "StoreSettings" ("id", "logoUrl", "updatedAt")
      VALUES (${SETTINGS_ID}, ${logoUrl}, NOW())
      ON CONFLICT ("id") DO UPDATE
      SET "logoUrl" = ${logoUrl}, "updatedAt" = NOW()
      RETURNING "logoUrl", "updatedAt"
    `
    const settings = rows[0]

    return NextResponse.json({
      success: true,
      data: {
        logoUrl: settings.logoUrl,
        updatedAt: settings.updatedAt,
      },
    })
  } catch (error) {
    console.error('Admin settings POST failed:', error)
    return NextResponse.json(
      { success: false, error: 'บันทึกการตั้งค่าร้านค้าไม่สำเร็จ' },
      { status: 500 }
    )
  }
}
