import { NextResponse } from 'next/server'
import { getAllProducts, getProductsByCategory } from '@/lib/products'
import { ProductCategory } from '@/types'

/**
 * GET /api/products
 * Query params:
 *   - category: 'all' | 'digital' | 'subscription' | 'voucher' | 'physical'
 *
 * TODO (Phase 2):
 * - เชื่อมต่อ Database จริง (Prisma + PostgreSQL / Supabase)
 * - เพิ่ม pagination
 * - เพิ่ม caching (Next.js revalidate)
 * - Admin API สำหรับอัปเดตสต็อกสินค้า
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = (searchParams.get('category') ?? 'all') as ProductCategory

    const products =
      category === 'all'
        ? await getAllProducts()
        : await getProductsByCategory(category)

    return NextResponse.json({
      success: true,
      data: products,
      total: products.length,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
