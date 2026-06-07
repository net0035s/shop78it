import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SETTINGS_ID = 'store-settings'

type StoreSettingsRow = {
  logoUrl: string | null
  updatedAt: Date | null
}

export async function GET() {
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
    console.error('Public settings GET failed:', error)
    return NextResponse.json(
      { success: false, error: 'โหลดการตั้งค่าร้านค้าไม่สำเร็จ' },
      { status: 500 }
    )
  }
}
