async function main() {
  process.env.ENCRYPTION_KEY = 'c'.repeat(64)

  const {
    decryptTextWithKey,
    encryptTextWithKey,
    isEncryptedText,
    reencryptTextWithKeys,
  } = await import('../src/lib/encryption')

  const oldKey = 'a'.repeat(64)
  const newKey = 'b'.repeat(64)
  const sample = 'sample-secret-value'

  const encryptedWithOldKey = encryptTextWithKey(sample, oldKey, {
    variableName: 'OLD_ENCRYPTION_KEY',
  })

  if (!isEncryptedText(encryptedWithOldKey)) {
    throw new Error('Expected old encrypted value to use the encryption prefix')
  }

  const decryptedWithOldKey = decryptTextWithKey(encryptedWithOldKey, oldKey, {
    variableName: 'OLD_ENCRYPTION_KEY',
  })

  if (decryptedWithOldKey !== sample) {
    throw new Error('Old key did not decrypt its own encrypted value')
  }

  let newKeyIncorrectlyDecryptedOldValue = false
  try {
    decryptTextWithKey(encryptedWithOldKey, newKey, {
      variableName: 'ENCRYPTION_KEY',
    })
    newKeyIncorrectlyDecryptedOldValue = true
  } catch {
    newKeyIncorrectlyDecryptedOldValue = false
  }

  if (newKeyIncorrectlyDecryptedOldValue) {
    throw new Error('New key should not decrypt data encrypted with the old key')
  }

  const rotated = reencryptTextWithKeys(encryptedWithOldKey, oldKey, newKey)
  const decryptedWithNewKey = decryptTextWithKey(rotated, newKey, {
    variableName: 'ENCRYPTION_KEY',
  })

  if (decryptedWithNewKey !== sample) {
    throw new Error('Rotated value did not decrypt with the new key')
  }

  console.log('Encryption rotation utility test passed. No secret data was printed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
