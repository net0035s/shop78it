import crypto from 'crypto'

const ENCRYPTION_PREFIX = 'enc:v1'
const IV_LENGTH = 12
const DEFAULT_UNSAFE_KEYS = new Set([
  '1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p',
  'your-32-character-secret-key-here',
])

function getEncryptionKeyProblem(secret: string | undefined) {
  if (!secret) return 'ENCRYPTION_KEY is missing'
  if (secret.length < 32) return 'ENCRYPTION_KEY must be at least 32 characters long'
  if (DEFAULT_UNSAFE_KEYS.has(secret)) return 'ENCRYPTION_KEY is using an unsafe default value'
  return ''
}

function validateEncryptionKey(secret: string | undefined) {
  const problem = getEncryptionKeyProblem(secret)

  if (problem && process.env.NODE_ENV === 'production') {
    throw new Error(
      `${problem}. Generate a secure key with: npx tsx scripts/generate-encryption-key.ts`
    )
  }

  if (problem && process.env.NODE_ENV !== 'test') {
    console.warn(
      `[security] ${problem}. Generate a secure key with: npx tsx scripts/generate-encryption-key.ts`
    )
  }
}

validateEncryptionKey(process.env.ENCRYPTION_KEY)

function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY

  const problem = getEncryptionKeyProblem(secret)
  if (problem) {
    throw new Error(
      `${problem}. Generate a secure key with: npx tsx scripts/generate-encryption-key.ts`
    )
  }

  return crypto.createHash('sha256').update(secret as string).digest()
}

export function isEncryptedText(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${ENCRYPTION_PREFIX}:`)
}

export function encryptText(text: string) {
  if (isEncryptedText(text)) return text

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    ENCRYPTION_PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export function decryptText(encryptedText: string) {
  if (!isEncryptedText(encryptedText)) return encryptedText

  const [, , ivBase64, tagBase64, encryptedBase64] = encryptedText.split(':')
  if (!ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error('Invalid encrypted text format')
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivBase64, 'base64')
  )
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

export function encryptNullableText(value: string | null | undefined) {
  return value ? encryptText(value) : null
}

export function decryptNullableText(value: string | null | undefined) {
  return value ? decryptText(value) : null
}

const DELIVERY_SECRET_FIELDS = [
  'creditCode',
  'creditAmount',
  'platform',
  'email',
  'password',
  'loginUrl',
  'licenseKey',
  'expiresAt',
  'instructions',
] as const

export function encryptDeliveryItemFields<T extends Record<string, any>>(item: T): T {
  const encrypted = { ...item }

  for (const field of DELIVERY_SECRET_FIELDS) {
    if (field in encrypted) {
      encrypted[field as keyof T] = encryptNullableText(encrypted[field as keyof T]) as T[keyof T]
    }
  }

  return encrypted
}

export function decryptDeliveryItemFields<T extends Record<string, any>>(item: T): T {
  const decrypted = { ...item }

  for (const field of DELIVERY_SECRET_FIELDS) {
    if (field in decrypted) {
      decrypted[field as keyof T] = decryptNullableText(decrypted[field as keyof T]) as T[keyof T]
    }
  }

  return decrypted
}
