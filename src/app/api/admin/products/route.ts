import prisma from '@/lib/db'
import { transaction } from '@/lib/transactions'
import { productData } from '@/lib/admin-product'
import { CommerceError } from '@/lib/commerce-rules'
import { sameOrigin, readJson, apiError } from '@/lib/server-guards'
import { requireAdmin } from '@/lib/admin-auth'
import { normalizeProductMoney } from '@/lib/money'
import { jsonUtf8 } from '@/lib/json-response'

export const dynamic = 'force-dynamic'

const PAID_ORDER_STATUSES = ['completed', 'needs_manual_delivery', 'paid']

function parseNonNegativeInt(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
}

/**
 * GET /api/admin/products
 * ดึงรายการสินค้าทั้งหมดฝั่งผู้ดูแลระบบ
 */
export async function GET() {
  const authResult = await requireAdmin()
  if (!authResult.authorized) return authResult.response

  try {
    const [rawProducts, soldQuantityGroups] = await Promise.all([
      prisma.product.findMany({
        include: {
          _count: {
            select: {
              digitalStocks: {
                where: { isSold: false, orderId: null }
              }
            }
          }
        },
        orderBy: {
          name: 'asc',
        },
      }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            status: { in: PAID_ORDER_STATUSES },
          },
        },
        _sum: {
          quantity: true,
        },
      }),
    ])

    const realSoldByProductId = new Map(
      soldQuantityGroups.map((group) => [group.productId, group._sum.quantity ?? 0])
    )

    const products = rawProducts.map(p => {
      const realSold = realSoldByProductId.get(p.id) ?? 0
      const manualSoldCount = p.manualSoldCount ?? 0

      return {
        ...normalizeProductMoney(p),
        stock: p.deliveryType === 'manual' ? p.stock : p._count?.digitalStocks || 0,
        manualSoldCount,
        realSold,
        totalSold: realSold + manualSoldCount,
      }
    })

    return jsonUtf8({ success: true, data: products })
  } catch (error) {
    console.error('Error fetching admin products:', error)
    return jsonUtf8(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า' },
      { status: 500 }
    )
  }
}

async function save(request: Request, update: boolean) {
 const auth = await requireAdmin(); if (!auth.authorized) return auth.response
 try {
  sameOrigin(request); const b = await readJson(request); const data = productData(b)
  const product = await transaction(async tx=>{
   const category = await tx.category.findUnique({where:{slug:data.category}})
   if (!category) throw new CommerceError('ไม่พบหมวดหมู่')
   if (update) {
    const old = await tx.product.findUniqueOrThrow({where:{id:b.id}})
    if (old.deliveryType === 'manual' && data.deliveryType === 'manual' && data.stock !== old.stock && b.expectedStock !== old.stock) throw new CommerceError('จำนวนสต็อกเปลี่ยนระหว่างแก้ไข กรุณาโหลดสินค้าใหม่',409)
    if (old.deliveryType !== data.deliveryType && (old.stock > 0 || await tx.digitalStock.count({where:{productId:b.id,isSold:false}}) || await tx.orderItem.count({where:{productId:b.id,order:{reservationActive:true}}}))) throw new CommerceError('ต้องไม่มีสต็อกและออเดอร์ที่จองอยู่ก่อนเปลี่ยนวิธีจัดส่ง',409)
    return tx.product.update({where:{id:b.id},data:{...data,categoryId:category.id}})
   }
   return tx.product.create({data:{stock:0,stockStatus:'out-of-stock',...data,categoryId:category.id}})
  })
  return jsonUtf8({success:true,data:normalizeProductMoney(product)})
 } catch(e) { return apiError(e) }
}
export async function POST(r: Request) { return save(r,false) }
export async function PUT(r: Request) { return save(r,true) }
export async function DELETE(request: Request) {
 const auth = await requireAdmin(); if (!auth.authorized) return auth.response
 try {
  sameOrigin(request); const id = new URL(request.url).searchParams.get('id')
  if (!id) throw new CommerceError('กรุณาระบุสินค้า')
  await transaction(async tx=>{
   if (await tx.orderItem.count({where:{productId:id}})) throw new CommerceError('ไม่สามารถลบสินค้าที่มีประวัติออเดอร์',409)
   if (await tx.digitalStock.count({where:{productId:id,OR:[{isSold:true},{orderId:{not:null}}]}})) throw new CommerceError('สินค้ามีสต็อกที่ถูกใช้หรือจองอยู่',409)
   await tx.product.delete({where:{id}})
  })
  return jsonUtf8({success:true})
 } catch(e) { return apiError(e) }
}
