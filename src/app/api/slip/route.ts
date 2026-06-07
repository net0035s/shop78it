import { NextResponse } from 'next/server'

const DISABLED_MESSAGE = 'ระบบยกเลิกการรับโอนเงินผ่านสลิปชั่วคราว กรุณาใช้ซองทรูมันนี่'

export async function POST() {
  return NextResponse.json(
    { success: false, error: DISABLED_MESSAGE },
    { status: 403 }
  )
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: DISABLED_MESSAGE },
    { status: 403 }
  )
}
