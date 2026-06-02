import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    
    const skip = (page - 1) * limit

    const [stocks, total] = await Promise.all([
      prisma.digitalStock.findMany({
        skip,
        take: limit,
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

    return NextResponse.json({
      stocks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error: any) {
    console.error('Error fetching digital stock history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch digital stock history', details: error.message },
      { status: 500 }
    )
  }
}
