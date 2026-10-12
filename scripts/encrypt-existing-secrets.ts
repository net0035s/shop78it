import prisma from '../src/lib/db'
import { encryptDeliveryItemFields, encryptText, isEncryptedText } from '../src/lib/encryption'

const isApplyMode = process.argv.includes('--apply')
const hasConfirmedBackup = process.argv.includes('--confirm-backup')

type DeliveryItemUpdate = {
  id: string
  data: {
    creditCode?: string | null
    creditAmount?: string | null
    platform?: string | null
    email?: string | null
    password?: string | null
    loginUrl?: string | null
    licenseKey?: string | null
    expiresAt?: string | null
    instructions?: string | null
  }
}

async function main() {
  if (isApplyMode && !hasConfirmedBackup) {
    throw new Error(
      'Refusing to write. Create a restorable database backup first, then rerun with --apply --confirm-backup.'
    )
  }

  const stockUpdates: Array<{ id: string; content: string }> = []
  const stocks = await prisma.digitalStock.findMany({
    select: { id: true, content: true },
  })
  for (const stock of stocks) {
    if (!isEncryptedText(stock.content)) {
      stockUpdates.push({ id: stock.id, content: encryptText(stock.content) })
    }
  }

  const keyUpdates: Array<{ id: string; keyData: string }> = []
  const keys = await prisma.digitalKey.findMany({
    select: { id: true, keyData: true },
  })
  for (const key of keys) {
    if (!isEncryptedText(key.keyData)) {
      keyUpdates.push({ id: key.id, keyData: encryptText(key.keyData) })
    }
  }

  const deliveryItemUpdates: DeliveryItemUpdate[] = []
  const deliveryItems = await prisma.deliveryItem.findMany()
  for (const item of deliveryItems) {
    const encryptedItem = encryptDeliveryItemFields(item)
    const data: DeliveryItemUpdate['data'] = {}

    for (const field of [
      'creditCode',
      'creditAmount',
      'platform',
      'email',
      'password',
      'loginUrl',
      'licenseKey',
      'expiresAt',
      'instructions',
    ] as const) {
      if (encryptedItem[field] !== item[field]) {
        data[field] = encryptedItem[field]
      }
    }

    if (Object.keys(data).length > 0) {
      deliveryItemUpdates.push({ id: item.id, data })
    }
  }

  const orderUpdates: Array<{ id: string; deliveredContent: string }> = []
  const orders = await prisma.order.findMany({
    where: {
      deliveredContent: {
        not: null,
      },
    },
    select: { id: true, deliveredContent: true },
  })
  for (const order of orders) {
    if (order.deliveredContent && !isEncryptedText(order.deliveredContent)) {
      orderUpdates.push({ id: order.id, deliveredContent: encryptText(order.deliveredContent) })
    }
  }

  console.log(`Encryption migration mode: ${isApplyMode ? 'apply' : 'dry-run'}`)
  console.log('No secret values, IDs, keys, passwords, or customer data will be printed.')
  console.log(`DigitalStock plaintext values to encrypt: ${stockUpdates.length}`)
  console.log(`DigitalKey plaintext values to encrypt: ${keyUpdates.length}`)
  console.log(`DeliveryItem rows with plaintext fields to encrypt: ${deliveryItemUpdates.length}`)
  console.log(`Order.deliveredContent plaintext values to encrypt: ${orderUpdates.length}`)

  if (!isApplyMode) {
    console.log('Dry-run completed. No database writes were made.')
    console.log('Create a restorable backup before running with --apply --confirm-backup.')
    return
  }

  await prisma.$transaction(
    async (tx) => {
      for (const update of stockUpdates) {
        await tx.digitalStock.update({
          where: { id: update.id },
          data: { content: update.content },
        })
      }

      for (const update of keyUpdates) {
        await tx.digitalKey.update({
          where: { id: update.id },
          data: { keyData: update.keyData },
        })
      }

      for (const update of deliveryItemUpdates) {
        await tx.deliveryItem.update({
          where: { id: update.id },
          data: update.data,
        })
      }

      for (const update of orderUpdates) {
        await tx.order.update({
          where: { id: update.id },
          data: { deliveredContent: update.deliveredContent },
        })
      }
    },
    { timeout: 120_000 }
  )

  console.log('Encryption migration transaction committed.')
}

main()
  .catch((error) => {
    console.error('Encryption migration failed without printing secret data.')
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
