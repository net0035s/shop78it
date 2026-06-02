import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('เริ่มตรวจสอบสินค้าที่ซ้ำซ้อน...')

  // ดึงสินค้าทั้งหมดพร้อมจำนวน DigitalStock
  const products = await prisma.product.findMany({
    include: {
      _count: {
        select: {
          digitalStocks: true,
          digitalKeys: true,
          orderItems: true
        }
      }
    }
  })

  // จัดกลุ่มสินค้าตามชื่อ (name)
  const productGroups: Record<string, typeof products> = {}
  
  for (const p of products) {
    if (!productGroups[p.name]) {
      productGroups[p.name] = []
    }
    productGroups[p.name].push(p)
  }

  let totalDeleted = 0

  for (const [name, group] of Object.entries(productGroups)) {
    if (group.length > 1) {
      console.log(`\nเจอสินค้าซ้ำ: "${name}" (จำนวน ${group.length} รายการ)`)

      // เรียงลำดับเพื่อให้ตัวที่มีความสำคัญอยู่ตัวแรกสุด (เก็บตัวแรกไว้, ลบตัวอื่น)
      // ความสำคัญคือ: มีสต๊อก (DigitalStock > 0) > มี OrderItems ผูกอยู่ > ตัวล่าสุด
      const sortedGroup = group.sort((a, b) => {
        const aHasStock = a._count.digitalStocks > 0 ? 1 : 0
        const bHasStock = b._count.digitalStocks > 0 ? 1 : 0
        
        if (aHasStock !== bHasStock) return bHasStock - aHasStock // ตัวมีสต๊อกขึ้นก่อน

        const aHasOrders = a._count.orderItems > 0 ? 1 : 0
        const bHasOrders = b._count.orderItems > 0 ? 1 : 0
        
        if (aHasOrders !== bHasOrders) return bHasOrders - aHasOrders // ตัวมีออเดอร์ขึ้นก่อน

        return b.stock - a.stock // สต๊อกเยอะกว่าขึ้นก่อน
      })

      // เก็บตัวแรกไว้ (Index 0)
      const toKeep = sortedGroup[0]
      const toDelete = sortedGroup.slice(1)

      console.log(`  -> เลือกรักษา ID: ${toKeep.id} (มี Stock: ${toKeep._count.digitalStocks})`)

      // ลบตัวที่เหลือ
      for (const p of toDelete) {
        if (p._count.digitalStocks > 0 || p._count.orderItems > 0) {
          console.log(`  -> ⚠️ ข้ามการลบ ID: ${p.id} เนื่องจากมีสต๊อกหรือออเดอร์ผูกอยู่ กรุณาจัดการด้วยตนเอง!`)
          continue
        }

        await prisma.product.delete({
          where: { id: p.id }
        })
        console.log(`  -> ✅ ลบ ID สำเร็จ: ${p.id}`)
        totalDeleted++
      }
    }
  }

  console.log(`\nการตรวจสอบเสร็จสิ้น! ลบสินค้าที่ซ้ำไปทั้งหมด ${totalDeleted} รายการ`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
