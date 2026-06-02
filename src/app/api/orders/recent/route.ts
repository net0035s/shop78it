import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

// Helper: mask name for privacy
// e.g. "สมชาย" → "ส**ย"  |  "John" → "J**n"
function maskName(name: string): string {
  if (!name || name.length === 0) return '***'
  const trimmed = name.trim()
  if (trimmed.length === 1) return trimmed + '**'
  if (trimmed.length === 2) return trimmed[0] + '*' + trimmed[1]
  // Keep first char, mask middle, keep last char
  const first = trimmed[0]
  const last = trimmed[trimmed.length - 1]
  const middleLen = trimmed.length - 2
  const stars = '*'.repeat(Math.min(middleLen, 3))
  return `${first}${stars}${last}`
}

// Helper: relative time in Thai
function relativeTimeTh(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'เมื่อสักครู่'
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`
  if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`
  return `${diffDay} วันที่แล้ว`
}

export async function GET() {
  try {
    // Fetch last 10 completed orders, then pick 5 with most interesting data
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['completed'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        deliveryItems: {
          take: 1, // Just need one product name per order
        },
      },
    })

    const result = orders
      .filter((o) => o.deliveryItems.length > 0)
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        maskedName: maskName(order.customerName),
        productName: order.deliveryItems[0].productName,
        timeAgo: relativeTimeTh(new Date(order.createdAt)),
      }))

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error fetching recent orders:', error)
    return NextResponse.json({ success: false, data: [] })
  }
}
