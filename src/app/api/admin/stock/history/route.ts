import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { CommerceError } from '@/lib/commerce-rules'
import { apiError } from '@/lib/server-guards'
import { requireAdmin } from '@/lib/admin-auth'
import { decryptText } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page') || '1')
    const limit = Number(searchParams.get('limit') || '50')
    
    if (!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(limit)||limit<1||limit>100) throw new CommerceError('เลขหน้าหรือจำนวนรายการไม่ถูกต้อง')
    const skip = (page - 1) * limit

    const [stocks, total] = await Promise.all([
      prisma.digitalStock.findMany({
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: {
          product: {
            select: {
              name: true,
            },
          },
          order: {
            select: {
              orderNumber: true,
            },
          },
        },
      }),
      prisma.digitalStock.count(),
    ])

    const decryptedStocks = stocks.map((stock) => ({
      ...stock,
      content: decryptText(stock.content),
    }))

    return NextResponse.json({
      stocks: decryptedStocks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error: any) {
    return apiError(error)
  }
}
