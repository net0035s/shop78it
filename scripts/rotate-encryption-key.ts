import prisma from '../src/lib/db'
import {
  decryptTextWithKey,
  DELIVERY_SECRET_FIELDS,
  encryptTextWithKey,
  getEncryptionKeyProblem,
  isEncryptedText,
} from '../src/lib/encryption'

type SecretValuePlan = {
  currentValue: string
  nextValue: string
}

type DeliveryItemUpdate = {
  id: string
  data: Record<string, string | null>
}

type RotationStats = {
  emptyValues: number
  plaintextToEncrypt: number
  encryptedToRotate: number
  alreadyUsingNewKey: number
  failedToDecrypt: number
}

type RotationPlan = {
  stats: RotationStats
  digitalStockUpdates: Array<{ id: string; content: string }>
  digitalKeyUpdates: Array<{ id: string; keyData: string }>
  orderUpdates: Array<{ id: string; deliveredContent: string }>
  deliveryItemUpdates: DeliveryItemUpdate[]
}

const isApplyMode = process.argv.includes('--apply')
const hasConfirmedBackup = process.argv.includes('--confirm-backup')
const oldKey = process.env.OLD_ENCRYPTION_KEY
const newKey = process.env.ENCRYPTION_KEY

function createStats(): RotationStats {
  return {
    emptyValues: 0,
    plaintextToEncrypt: 0,
    encryptedToRotate: 0,
    alreadyUsingNewKey: 0,
    failedToDecrypt: 0,
  }
}

function addStats(target: RotationStats, source: RotationStats) {
  target.emptyValues += source.emptyValues
  target.plaintextToEncrypt += source.plaintextToEncrypt
  target.encryptedToRotate += source.encryptedToRotate
  target.alreadyUsingNewKey += source.alreadyUsingNewKey
  target.failedToDecrypt += source.failedToDecrypt
}

function assertKeysAreUsable() {
  const oldProblem = getEncryptionKeyProblem(oldKey, {
    allowUnsafeDefault: true,
    variableName: 'OLD_ENCRYPTION_KEY',
  })
  const newProblem = getEncryptionKeyProblem(newKey, {
    variableName: 'ENCRYPTION_KEY',
  })

  if (oldProblem) throw new Error(oldProblem)
  if (newProblem) throw new Error(newProblem)
  if (oldKey === newKey) {
    throw new Error('OLD_ENCRYPTION_KEY and ENCRYPTION_KEY must be different for rotation')
  }

  if (isApplyMode && !hasConfirmedBackup) {
    throw new Error(
      'Refusing to write. Create a restorable database backup first, then rerun with --apply --confirm-backup.'
    )
  }
}

function planSecretValue(value: string | null | undefined): {
  stats: RotationStats
  update: SecretValuePlan | null
} {
  const stats = createStats()

  if (!value) {
    stats.emptyValues += 1
    return { stats, update: null }
  }

  if (!isEncryptedText(value)) {
    stats.plaintextToEncrypt += 1
    return {
      stats,
      update: {
        currentValue: value,
        nextValue: encryptTextWithKey(value, newKey, { variableName: 'ENCRYPTION_KEY' }),
      },
    }
  }

  try {
    const plaintext = decryptTextWithKey(value, oldKey, {
      allowUnsafeDefault: true,
      variableName: 'OLD_ENCRYPTION_KEY',
    })
    stats.encryptedToRotate += 1
    return {
      stats,
      update: {
        currentValue: value,
        nextValue: encryptTextWithKey(plaintext, newKey, { variableName: 'ENCRYPTION_KEY' }),
      },
    }
  } catch {
    try {
      decryptTextWithKey(value, newKey, { variableName: 'ENCRYPTION_KEY' })
      stats.alreadyUsingNewKey += 1
      return { stats, update: null }
    } catch {
      stats.failedToDecrypt += 1
      return { stats, update: null }
    }
  }
}

function printStats(title: string, stats: RotationStats) {
  console.log(title)
  console.log(`  empty values: ${stats.emptyValues}`)
  console.log(`  plaintext values to encrypt: ${stats.plaintextToEncrypt}`)
  console.log(`  encrypted values to rotate: ${stats.encryptedToRotate}`)
  console.log(`  already using new key: ${stats.alreadyUsingNewKey}`)
  console.log(`  failed to decrypt: ${stats.failedToDecrypt}`)
}

async function buildRotationPlan(): Promise<RotationPlan> {
  const plan: RotationPlan = {
    stats: createStats(),
    digitalStockUpdates: [],
    digitalKeyUpdates: [],
    orderUpdates: [],
    deliveryItemUpdates: [],
  }

  const stocks = await prisma.digitalStock.findMany({
    select: { id: true, content: true },
  })
  for (const stock of stocks) {
    const result = planSecretValue(stock.content)
    addStats(plan.stats, result.stats)
    if (result.update) plan.digitalStockUpdates.push({ id: stock.id, content: result.update.nextValue })
  }

  const keys = await prisma.digitalKey.findMany({
    select: { id: true, keyData: true },
  })
  for (const key of keys) {
    const result = planSecretValue(key.keyData)
    addStats(plan.stats, result.stats)
    if (result.update) plan.digitalKeyUpdates.push({ id: key.id, keyData: result.update.nextValue })
  }

  const orders = await prisma.order.findMany({
    where: { deliveredContent: { not: null } },
    select: { id: true, deliveredContent: true },
  })
  for (const order of orders) {
    const result = planSecretValue(order.deliveredContent)
    addStats(plan.stats, result.stats)
    if (result.update) {
      plan.orderUpdates.push({ id: order.id, deliveredContent: result.update.nextValue })
    }
  }

  const deliveryItems = await prisma.deliveryItem.findMany({
    select: {
      id: true,
      creditCode: true,
      creditAmount: true,
      platform: true,
      email: true,
      password: true,
      loginUrl: true,
      licenseKey: true,
      expiresAt: true,
      instructions: true,
    },
  })

  for (const item of deliveryItems) {
    const data: Record<string, string | null> = {}

    for (const field of DELIVERY_SECRET_FIELDS) {
      const result = planSecretValue(item[field])
      addStats(plan.stats, result.stats)
      if (result.update) data[field] = result.update.nextValue
    }

    if (Object.keys(data).length > 0) {
      plan.deliveryItemUpdates.push({ id: item.id, data })
    }
  }

  return plan
}

async function applyRotationPlan(plan: RotationPlan) {
  await prisma.$transaction(
    async (tx) => {
      for (const update of plan.digitalStockUpdates) {
        await tx.digitalStock.update({
          where: { id: update.id },
          data: { content: update.content },
        })
      }

      for (const update of plan.digitalKeyUpdates) {
        await tx.digitalKey.update({
          where: { id: update.id },
          data: { keyData: update.keyData },
        })
      }

      for (const update of plan.orderUpdates) {
        await tx.order.update({
          where: { id: update.id },
          data: { deliveredContent: update.deliveredContent },
        })
      }

      for (const update of plan.deliveryItemUpdates) {
        await tx.deliveryItem.update({
          where: { id: update.id },
          data: update.data,
        })
      }
    },
    { timeout: 120_000 }
  )
}

async function main() {
  assertKeysAreUsable()

  console.log(`Encryption key rotation mode: ${isApplyMode ? 'apply' : 'dry-run'}`)
  console.log('No secret values, IDs, keys, passwords, or customer data will be printed.')
  console.log('')

  const plan = await buildRotationPlan()
  printStats('Planned rotation counts', plan.stats)

  const totalUpdates =
    plan.digitalStockUpdates.length +
    plan.digitalKeyUpdates.length +
    plan.orderUpdates.length +
    plan.deliveryItemUpdates.length

  console.log('')
  console.log(`Rows scheduled for update: ${totalUpdates}`)
  console.log(`  DigitalStock rows: ${plan.digitalStockUpdates.length}`)
  console.log(`  DigitalKey rows: ${plan.digitalKeyUpdates.length}`)
  console.log(`  Order rows: ${plan.orderUpdates.length}`)
  console.log(`  DeliveryItem rows: ${plan.deliveryItemUpdates.length}`)

  if (plan.stats.failedToDecrypt > 0) {
    throw new Error('Rotation aborted. At least one encrypted value could not be decrypted.')
  }

  if (!isApplyMode) {
    console.log('')
    console.log('Dry-run completed. No database writes were made.')
    console.log('Create a restorable backup before running with --apply --confirm-backup.')
    return
  }

  await applyRotationPlan(plan)
  console.log('')
  console.log('Rotation transaction committed.')

  const verificationPlan = await buildRotationPlan()
  printStats('Post-rotation verification counts', verificationPlan.stats)

  if (
    verificationPlan.stats.failedToDecrypt > 0 ||
    verificationPlan.stats.plaintextToEncrypt > 0 ||
    verificationPlan.stats.encryptedToRotate > 0
  ) {
    throw new Error('Post-rotation verification failed. Review counts before updating Vercel.')
  }
}

main()
  .catch((error) => {
    console.error('Encryption rotation failed without printing secret data.')
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
