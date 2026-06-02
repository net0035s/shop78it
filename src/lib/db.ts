/**
 * Real Prisma Client — เชื่อมต่อ Supabase จริง
 * ไฟล์นี้แทนที่ In-Memory Mock Database เดิม
 * ไฟล์อื่นๆ ที่ import prisma / syncProductStock จาก '@/lib/db' ไม่ต้องแก้ไข
 */

import { PrismaClient } from '@prisma/client'

// Singleton pattern — ป้องกัน PrismaClient ถูก instantiate ซ้ำในโหมด dev (HMR)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma

/**
 * Sync product stock count จากตาราง DigitalStock จริง
 * อัปเดต stock และ stockStatus บนแถว Product ใน Database
 */
export async function syncProductStock(productId: string): Promise<void> {
  const unsoldCount = await prisma.digitalStock.count({
    where: { productId, isSold: false },
  })

  const newStatus =
    unsoldCount === 0 ? 'out-of-stock' : unsoldCount <= 3 ? 'low-stock' : 'in-stock'

  await prisma.product.update({
    where: { id: productId },
    data: { stock: unsoldCount, stockStatus: newStatus },
  })
}
