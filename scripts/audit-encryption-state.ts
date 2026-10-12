import prisma from '../src/lib/db'
import {
  decryptTextWithKey,
  DELIVERY_SECRET_FIELDS,
  getEncryptionKeyProblem,
  isEncryptedText,
} from '../src/lib/encryption'

type FieldStats = {
  totalValues: number
  emptyValues: number
  plaintextValues: number
  encryptedValues: number
  decryptableWithCurrentKey: number
  decryptableWithOldKey: number
  failedWithCurrentKey: number
  failedWithOldKey: number
}

type AuditRow = {
  area: string
  field: string
  stats: FieldStats
}

const shouldValidateDecryption = process.argv.includes('--validate-decryption')
const currentKey = process.env.ENCRYPTION_KEY
const oldKey = process.env.OLD_ENCRYPTION_KEY

function createStats(): FieldStats {
  return {
    totalValues: 0,
    emptyValues: 0,
    plaintextValues: 0,
    encryptedValues: 0,
    decryptableWithCurrentKey: 0,
    decryptableWithOldKey: 0,
    failedWithCurrentKey: 0,
    failedWithOldKey: 0,
  }
}

function canDecryptWithKey(value: string, key: string | undefined, variableName: string) {
  if (!key) return null

  try {
    decryptTextWithKey(value, key, {
      allowUnsafeDefault: variableName === 'OLD_ENCRYPTION_KEY',
      variableName,
    })
    return true
  } catch {
    return false
  }
}

function addValue(stats: FieldStats, rawValue: string | null | undefined) {
  stats.totalValues += 1

  if (!rawValue) {
    stats.emptyValues += 1
    return
  }

  if (!isEncryptedText(rawValue)) {
    stats.plaintextValues += 1
    return
  }

  stats.encryptedValues += 1

  if (!shouldValidateDecryption) return

  const currentResult = canDecryptWithKey(rawValue, currentKey, 'ENCRYPTION_KEY')
  if (currentResult === true) stats.decryptableWithCurrentKey += 1
  if (currentResult === false) stats.failedWithCurrentKey += 1

  const oldResult = canDecryptWithKey(rawValue, oldKey, 'OLD_ENCRYPTION_KEY')
  if (oldResult === true) stats.decryptableWithOldKey += 1
  if (oldResult === false) stats.failedWithOldKey += 1
}

function printKeyStatus() {
  const currentProblem = getEncryptionKeyProblem(currentKey, { variableName: 'ENCRYPTION_KEY' })
  const oldProblem = getEncryptionKeyProblem(oldKey, {
    allowUnsafeDefault: true,
    variableName: 'OLD_ENCRYPTION_KEY',
  })

  console.log('Encryption audit key status')
  console.log(`- ENCRYPTION_KEY: ${currentProblem ? 'not ready' : 'present and format-valid'}`)
  console.log(`- OLD_ENCRYPTION_KEY: ${oldProblem ? 'not provided or not usable' : 'present and format-valid'}`)
  console.log(`- Decryption validation: ${shouldValidateDecryption ? 'enabled' : 'disabled'}`)
  console.log('')
}

async function main() {
  printKeyStatus()

  const auditRows: AuditRow[] = []

  const stocks = await prisma.digitalStock.findMany({
    select: { content: true },
  })
  const stockStats = createStats()
  for (const stock of stocks) addValue(stockStats, stock.content)
  auditRows.push({ area: 'DigitalStock', field: 'content', stats: stockStats })

  const keys = await prisma.digitalKey.findMany({
    select: { keyData: true },
  })
  const keyStats = createStats()
  for (const key of keys) addValue(keyStats, key.keyData)
  auditRows.push({ area: 'DigitalKey', field: 'keyData', stats: keyStats })

  const orders = await prisma.order.findMany({
    select: { deliveredContent: true },
  })
  const deliveredContentStats = createStats()
  for (const order of orders) addValue(deliveredContentStats, order.deliveredContent)
  auditRows.push({ area: 'Order', field: 'deliveredContent', stats: deliveredContentStats })

  const deliveryItems = await prisma.deliveryItem.findMany({
    select: Object.fromEntries(DELIVERY_SECRET_FIELDS.map((field) => [field, true])),
  })

  for (const field of DELIVERY_SECRET_FIELDS) {
    const stats = createStats()
    for (const item of deliveryItems) {
      addValue(stats, item[field])
    }
    auditRows.push({ area: 'DeliveryItem', field, stats })
  }

  console.log('Encryption audit counts only')
  for (const row of auditRows) {
    console.log(`${row.area}.${row.field}`)
    console.log(`  total values: ${row.stats.totalValues}`)
    console.log(`  empty: ${row.stats.emptyValues}`)
    console.log(`  plaintext: ${row.stats.plaintextValues}`)
    console.log(`  encrypted: ${row.stats.encryptedValues}`)

    if (shouldValidateDecryption) {
      console.log(`  decryptable with ENCRYPTION_KEY: ${row.stats.decryptableWithCurrentKey}`)
      console.log(`  failed with ENCRYPTION_KEY: ${row.stats.failedWithCurrentKey}`)
      console.log(`  decryptable with OLD_ENCRYPTION_KEY: ${row.stats.decryptableWithOldKey}`)
      console.log(`  failed with OLD_ENCRYPTION_KEY: ${row.stats.failedWithOldKey}`)
    }
  }
}

main()
  .catch((error) => {
    console.error('Encryption audit failed without printing secret data.')
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
