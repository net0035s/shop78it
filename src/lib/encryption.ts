import crypto from 'crypto'

const ENCRYPTION_PREFIX = 'enc:v1'
const IV_LENGTH = 12

function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_KEY

  if (!secret) {
    throw new Error('ENCRYPTION_KEY is required for encrypted data')
  }

  return crypto.createHash('sha256').update(secret).digest()
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
