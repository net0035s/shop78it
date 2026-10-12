import crypto from 'crypto'

export const ENCRYPTION_PREFIX = 'enc:v1'
const IV_LENGTH = 12
export const DEFAULT_UNSAFE_ENCRYPTION_KEYS = new Set([
  '1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p',
  'your-32-character-secret-key-here',
])

type EncryptionKeyValidationOptions = {
  allowUnsafeDefault?: boolean
  variableName?: string
}

export function getEncryptionKeyProblem(
  secret: string | undefined,
  options: EncryptionKeyValidationOptions = {}
) {
  const variableName = options.variableName ?? 'ENCRYPTION_KEY'

  if (!secret) return `${variableName} is missing`
  if (secret.length < 32) return `${variableName} must be at least 32 characters long`
  if (!options.allowUnsafeDefault && DEFAULT_UNSAFE_ENCRYPTION_KEYS.has(secret)) {
    return `${variableName} is using an unsafe default value`
  }
  return ''
}

export function validateEncryptionSecret(
  secret: string | undefined,
  options: EncryptionKeyValidationOptions = {}
) {
  const problem = getEncryptionKeyProblem(secret, options)

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

// Validate when a secret is used, not while Next.js imports routes at build time.
// This preserves fail-closed encryption without requiring production keys to build.
export function assertEncryptionReady() {
  deriveEncryptionKey(process.env.ENCRYPTION_KEY)
}

export function deriveEncryptionKey(
  secret: string | undefined,
  options: EncryptionKeyValidationOptions = {}
) {
  const problem = getEncryptionKeyProblem(secret, options)
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
  return encryptTextWithKey(text, process.env.ENCRYPTION_KEY)
}

export function encryptTextWithKey(
  text: string,
  secret: string | undefined,
  options: EncryptionKeyValidationOptions = {}
) {
  if (isEncryptedText(text)) return text

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveEncryptionKey(secret, options), iv)
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
  return decryptTextWithKey(encryptedText, process.env.ENCRYPTION_KEY)
}

export function decryptTextWithKey(
  encryptedText: string,
  secret: string | undefined,
  options: EncryptionKeyValidationOptions = {}
) {
  if (!isEncryptedText(encryptedText)) return encryptedText

  const [, , ivBase64, tagBase64, encryptedBase64] = encryptedText.split(':')
  if (!ivBase64 || !tagBase64 || !encryptedBase64) {
    throw new Error('Invalid encrypted text format')
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveEncryptionKey(secret, options),
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

export function reencryptTextWithKeys(
  encryptedText: string,
  oldSecret: string | undefined,
  newSecret: string | undefined
) {
  const plaintext = decryptTextWithKey(encryptedText, oldSecret, {
    allowUnsafeDefault: true,
    variableName: 'OLD_ENCRYPTION_KEY',
  })

  return encryptTextWithKey(plaintext, newSecret, {
    variableName: 'ENCRYPTION_KEY',
  })
}

export const DELIVERY_SECRET_FIELDS = [
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
