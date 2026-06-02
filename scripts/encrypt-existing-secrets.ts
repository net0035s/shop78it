import prisma from '../src/lib/db'
import { encryptDeliveryItemFields, encryptText, isEncryptedText } from '../src/lib/encryption'

async function main() {
  const stocks = await prisma.digitalStock.findMany()
  let encryptedStocks = 0
  for (const stock of stocks) {
    if (!isEncryptedText(stock.content)) {
      await prisma.digitalStock.update({
        where: { id: stock.id },
        data: { content: encryptText(stock.content) },
      })
      encryptedStocks += 1
    }
  }

  const keys = await prisma.digitalKey.findMany()
  let encryptedKeys = 0
  for (const key of keys) {
    if (!isEncryptedText(key.keyData)) {
      await prisma.digitalKey.update({
        where: { id: key.id },
        data: { keyData: encryptText(key.keyData) },
      })
      encryptedKeys += 1
    }
  }

  const deliveryItems = await prisma.deliveryItem.findMany()
  let encryptedDeliveryItems = 0
  for (const item of deliveryItems) {
    const encryptedItem = encryptDeliveryItemFields(item)
    const changed = JSON.stringify(encryptedItem) !== JSON.stringify(item)
    if (changed) {
      await prisma.deliveryItem.update({
        where: { id: item.id },
        data: {
          creditCode: encryptedItem.creditCode,
          creditAmount: encryptedItem.creditAmount,
          platform: encryptedItem.platform,
          email: encryptedItem.email,
          password: encryptedItem.password,
          loginUrl: encryptedItem.loginUrl,
          licenseKey: encryptedItem.licenseKey,
          expiresAt: encryptedItem.expiresAt,
          instructions: encryptedItem.instructions,
        },
      })
      encryptedDeliveryItems += 1
    }
  }

  const orders = await prisma.order.findMany({
    where: {
      deliveredContent: {
        not: null,
      },
    },
  })
  let encryptedManualContents = 0
  for (const order of orders) {
    if (order.deliveredContent && !isEncryptedText(order.deliveredContent)) {
      await prisma.order.update({
        where: { id: order.id },
        data: { deliveredContent: encryptText(order.deliveredContent) },
      })
      encryptedManualContents += 1
    }
  }

  console.log('Encryption migration completed')
  console.log(`DigitalStock encrypted: ${encryptedStocks}`)
  console.log(`DigitalKey encrypted: ${encryptedKeys}`)
  console.log(`DeliveryItem encrypted: ${encryptedDeliveryItems}`)
  console.log(`Manual deliveredContent encrypted: ${encryptedManualContents}`)
}

main()
  .catch((error) => {
    console.error('Encryption migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
