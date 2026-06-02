import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database cleanup...')

  const deliveryItems = await prisma.deliveryItem.deleteMany({})
  console.log(`Deleted DeliveryItem: ${deliveryItems.count}`)

  const orderItems = await prisma.orderItem.deleteMany({})
  console.log(`Deleted OrderItem: ${orderItems.count}`)

  const detachedDigitalStocks = await prisma.digitalStock.updateMany({
    data: { orderId: null },
  })
  console.log(`Detached DigitalStock from Order: ${detachedDigitalStocks.count}`)

  const detachedDigitalKeys = await prisma.digitalKey.updateMany({
    data: { orderId: null },
  })
  console.log(`Detached DigitalKey from Order: ${detachedDigitalKeys.count}`)

  const orders = await prisma.order.deleteMany({})
  console.log(`Deleted Order: ${orders.count}`)

  const digitalStocks = await prisma.digitalStock.deleteMany({})
  console.log(`Deleted DigitalStock: ${digitalStocks.count}`)

  const digitalKeys = await prisma.digitalKey.deleteMany({})
  console.log(`Deleted DigitalKey: ${digitalKeys.count}`)

  const products = await prisma.product.deleteMany({})
  console.log(`Deleted Product: ${products.count}`)

  const categories = await prisma.category.deleteMany({})
  console.log(`Deleted Category: ${categories.count}`)

  const discountCodes = await prisma.discountCode.deleteMany({})
  console.log(`Deleted DiscountCode: ${discountCodes.count}`)

  console.log('Database cleanup completed.')
}

main()
  .catch((error) => {
    console.error('Database cleanup failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
