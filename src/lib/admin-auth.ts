import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export type AdminAuthResult =
  | { authorized: true; userId: string; email: string }
  | { authorized: false; response: NextResponse }

export async function requireAdmin(): Promise<AdminAuthResult> {
  try {
    const { userId } = await auth()

    if (!userId) {
      return {
        authorized: false,
        response: NextResponse.json(
          { success: false, error: 'กรุณาเข้าสู่ระบบ' },
          { status: 401 }
        ),
      }
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)

    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const primaryEmail = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    )
    const email = (primaryEmail?.emailAddress || '').trim().toLowerCase()

    if (!email || !adminEmails.includes(email)) {
      return {
        authorized: false,
        response: NextResponse.json(
          { success: false, error: 'ไม่มีสิทธิ์เข้าถึง' },
          { status: 403 }
        ),
      }
    }

    return { authorized: true, userId, email }
  } catch (error) {
    console.error('Admin auth check failed:', error)
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' },
        { status: 500 }
      ),
    }
  }
}
