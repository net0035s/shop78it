import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { sandboxSmtp } from './sandbox-smtp'
import { sandboxDatabase } from './sandbox-db'
import { databaseFingerprint, previewIsIsolated, assertOrderingReady, assertSafeDatabaseWrite, configurationChecks } from '../src/lib/launch-readiness'
import { verifiedAdminEmail } from '../src/lib/admin-identity'
import { assertRestoreTarget } from './backup-archive'

async function main() {
  const sandbox = await sandboxDatabase(), smtp = await sandboxSmtp()
  Object.assign(process.env, { NODE_ENV: 'test', APP_MODE: 'sandbox', VERCEL_ENV: 'development', ORDERS_ENABLED: 'true', PAYMENTS_ENABLED: 'true', DATABASE_URL: sandbox.url, DIRECT_URL: sandbox.url,
    ENCRYPTION_KEY: randomBytes(32).toString('hex'), EMAIL_USER: 'sender@example.invalid', EMAIL_PASS: 'sandbox-only', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port),
    TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '', CRON_SECRET: randomBytes(32).toString('hex') })
  const fetchOriginal = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('External requests are prohibited by launch tests') }
  const { default: db } = await import('../src/lib/db')
  const { encryptText } = await import('../src/lib/encryption')
  const { queueNotification, processNotifications } = await import('../src/lib/notifications')
  const { operationsSummary } = await import('../src/lib/operations')
  const { newToken, tokenHash } = await import('../src/lib/order-access')
  const { POST: createOrder } = await import('../src/app/api/orders/route')
  let passed = 0
  async function test(name: string, fn: () => unknown) { await fn(); passed++; console.log('PASS ' + name) }
  try {
    await test('closed storefront rejects orders before any database write', async () => {
      process.env.ORDERS_ENABLED = 'false'
      const response = await createOrder(new Request('http://localhost/api/orders', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: '{}' }))
      assert.equal(response.status, 503); assert.equal(await db.order.count(), 0); assert.equal(await db.rateLimitBucket.count(), 0)
      process.env.ORDERS_ENABLED = 'true'
    })
    await test('preview cannot write to a shared production database; pooled/direct Supabase identities agree', () => {
      const prod = 'postgresql://postgres.ref123:secret@aws-0-ap.pooler.supabase.com:6543/postgres'
      const direct = 'postgresql://postgres:secret@db.ref123.supabase.co:5432/postgres'
      assert.equal(databaseFingerprint(prod), databaseFingerprint(direct))
      const testUrl = 'postgresql://postgres:test@db.other456.supabase.co/postgres'
      const env = { VERCEL_ENV: 'preview', APP_MODE: 'sandbox', ORDERS_ENABLED: 'true', DATABASE_URL: prod, DIRECT_URL: direct, PRODUCTION_DATABASE_FINGERPRINT: databaseFingerprint(prod), SANDBOX_DATABASE_FINGERPRINT: databaseFingerprint(prod) }
      assert.equal(previewIsIsolated(env), false); assert.throws(() => assertSafeDatabaseWrite(env))
      assert.throws(() => assertSafeDatabaseWrite({ ...env, VERCEL_ENV:'development' }))
      assertOrderingReady({ ...env, DATABASE_URL: testUrl, DIRECT_URL: testUrl, SANDBOX_DATABASE_FINGERPRINT: databaseFingerprint(testUrl) })
      assert.throws(() => assertOrderingReady({ ORDERS_ENABLED: 'true', APP_MODE: 'live' }))
      assert.throws(() => assertOrderingReady({ VERCEL_ENV: 'production', ORDERS_ENABLED: 'true', APP_MODE: 'sandbox' }))
    })
    await test('admin authorization requires a verified primary email and never trusts a secondary match', () => {
      const user = { primaryEmailAddressId: 'primary', emailAddresses: [{ id: 'primary', emailAddress: 'Admin@Example.invalid', verification: { status: 'unverified' } }, { id: 'secondary', emailAddress: 'admin@example.invalid', verification: { status: 'verified' } }] }
      assert.equal(verifiedAdminEmail(user, 'admin@example.invalid'), '')
      user.emailAddresses[0].verification.status = 'verified'
      assert.equal(verifiedAdminEmail(user, ' admin@example.invalid '), 'admin@example.invalid')
      assert.equal(verifiedAdminEmail(user, 'customer@example.invalid'), '')
      assert.equal(verifiedAdminEmail({ ...user, primaryEmailAddressId: null }, 'admin@example.invalid'), '')
    })
    await test('configuration presence cannot masquerade as external test evidence; restore rejects real databases', () => {
      const checks = configurationChecks({ ENCRYPTION_KEY: 'your-32-character-secret-key-here', NEXT_PUBLIC_SITE_URL: 'http://localhost' })
      assert.equal(checks.find(c => c.id === 'encryption')?.status, 'blocked')
      assert.equal(checks.find(c => c.id === 'backup')?.status, 'pending')
      for (const url of ['postgresql://localhost/shop_real', 'postgresql://db.example.com/shop_restore_sandbox', 'https://localhost/shop_restore_sandbox']) assert.throws(() => assertRestoreTarget(url))
    })
    const order = await db.order.create({ data: { orderNumber: 'LAUNCH-' + randomUUID(), customerName: 'Sandbox', customerEmail: 'customer@example.invalid', total: 10.25, status: 'completed' } })
    await test('receipt goes through local SMTP and hidden product instructions stay hidden', async () => {
      await db.deliveryItem.create({ data: { orderId: order.id, productName: 'Sandbox product', type: 'license-key', licenseKey: encryptText('MOCK-KEY-ONLY'), instructions: encryptText('HIDDEN-INSTRUCTIONS-ONLY'), showInstruction: false } })
      await queueNotification(db as any, order.id, 'receipt', 'launch-receipt')
      await processNotifications(order.id)
      assert.equal((await db.notificationJob.findUniqueOrThrow({ where: { dedupKey: 'launch-receipt' } })).status, 'sent')
      assert.equal(smtp.messages.length, 1)
      const decoded = smtp.messages[0].replace(/=\n/g, '').replace(/=([a-f0-9]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      assert.ok(decoded.includes('MOCK-KEY-ONLY')); assert.ok(!decoded.includes('HIDDEN-INSTRUCTIONS-ONLY'))
    })
    await test('access email has a one-time link; expired or used links are never sent again', async () => {
      const token = newToken()
      const challenge = await db.orderAccessChallenge.create({ data: { orderId: order.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 60000) } })
      await queueNotification(db as any, order.id, 'access', 'launch-access', { url: 'https://sandbox.example.invalid/track#access=' + token })
      await processNotifications(order.id)
      assert.equal((await db.notificationJob.findUniqueOrThrow({ where: { dedupKey: 'launch-access' } })).status, 'sent')
      const messageCount = smtp.messages.length
      await db.orderAccessChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } })
      await queueNotification(db as any, order.id, 'access', 'launch-used-link', { url: 'https://sandbox.example.invalid/track#access=' + token })
      await processNotifications(order.id)
      assert.equal((await db.notificationJob.findUniqueOrThrow({ where: { dedupKey: 'launch-used-link' } })).status, 'expired')
      assert.equal(smtp.messages.length, messageCount)
      await db.orderAccessChallenge.update({ where: { id: challenge.id }, data: { usedAt: null, expiresAt: new Date(Date.now() - 1000) } })
      await queueNotification(db as any, order.id, 'access', 'launch-expired-link', { url: 'https://sandbox.example.invalid/track#access=' + token })
      await processNotifications(order.id)
      assert.equal((await db.notificationJob.findUniqueOrThrow({ where: { dedupKey: 'launch-expired-link' } })).status, 'expired')
      assert.equal(smtp.messages.length, messageCount)
    })
    await test('Telegram success is persisted and exhausted or crashed notifications become admin alerts', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'mock-only'; process.env.TELEGRAM_CHAT_ID = 'mock-only'
      globalThis.fetch = async (_input, init) => { assert.equal(JSON.parse(String(init?.body)).text, 'Sandbox notification'); return Response.json({ ok: true }) }
      await queueNotification(db as any, order.id, 'telegram', 'launch-telegram', { message: 'Sandbox notification' })
      await processNotifications(order.id)
      assert.equal((await db.notificationJob.findUniqueOrThrow({ where: { dedupKey: 'launch-telegram' } })).status, 'sent')
      globalThis.fetch = async () => Response.json({ ok: false, description: 'Sandbox failure' })
      await queueNotification(db as any, order.id, 'telegram', 'launch-failed', { message: 'Sandbox failure' })
      for (let i = 0; i < 6; i++) {
        await db.notificationJob.update({ where: { dedupKey: 'launch-failed' }, data: { nextAttemptAt: new Date(0) } })
        await processNotifications(order.id)
      }
      const exhausted = await db.notificationJob.findUniqueOrThrow({ where: { dedupKey: 'launch-failed' } })
      assert.equal(exhausted.attempts, 6); assert.equal(exhausted.sentAt, null)
      await db.notificationJob.update({ where: { id: exhausted.id }, data: { status: 'sending', lockedAt: new Date(0) } })
      await processNotifications(order.id)
      assert.equal((await db.notificationJob.findUniqueOrThrow({ where: { id: exhausted.id } })).status, 'failed')
      assert.equal((await operationsSummary()).failedNotifications, 1)
    })
    await test('external refund recording needs confirmed full payment and creates one immutable audit under concurrency', async () => {
      const { recordExternalRefund } = await import('../src/lib/refunds')
      const body = { amount: 10.25, reference: 'MOCK-REFUND-REFERENCE', reason: 'Sandbox only', confirmExternalRefund: true }
      await assert.rejects(() => recordExternalRefund(order.id, { ...body, confirmExternalRefund: false }, 'sandbox-admin'))
      await assert.rejects(() => recordExternalRefund(order.id, { ...body, amount: 1 }, 'sandbox-admin'))
      const results = await Promise.allSettled([recordExternalRefund(order.id, body, 'sandbox-admin'), recordExternalRefund(order.id, body, 'sandbox-admin')])
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, 'refunded')
      assert.equal(await db.orderAuditEvent.count({ where: { orderId: order.id, action: 'external_refund_recorded' } }), 1)
      const second = await db.order.create({ data: { orderNumber: 'REFUND-' + randomUUID(), customerName: 'Sandbox', customerEmail: 'second@example.invalid', total: 10.25, status: 'paid' } })
      await assert.rejects(() => recordExternalRefund(second.id, body, 'sandbox-admin'))
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: second.id } })).status, 'paid')
      const third = await db.order.create({ data: { orderNumber: 'REFUND-' + randomUUID(), customerName: 'Sandbox', customerEmail: 'third@example.invalid', total: 10.25, status: 'paid' } })
      const shared = { ...body, reference: 'MOCK-CROSS-ORDER-REFUND' }
      const concurrent = await Promise.allSettled([recordExternalRefund(second.id,shared,'sandbox-admin'),recordExternalRefund(third.id,shared,'sandbox-admin')])
      assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1)
      assert.equal(await db.orderAuditEvent.count({ where: { action: 'external_refund_recorded', note: { contains: shared.reference } } }),1)
    })
    await test('local development sandbox SMTP works; live and production still require TLS', async () => {
      const { sendOrderAccessEmail } = await import('../src/lib/mailer')
      const before = smtp.messages.length
      const original = { NODE_ENV: process.env.NODE_ENV, APP_MODE: process.env.APP_MODE, VERCEL_ENV: process.env.VERCEL_ENV }
      try {
        Object.assign(process.env, { NODE_ENV: 'development', APP_MODE: 'sandbox', VERCEL_ENV: 'development' })
        assert.equal(await sendOrderAccessEmail('customer@example.invalid', 'MOCK-SMTP', 'http://localhost/track'), true)
        assert.equal(smtp.messages.length, before + 1)
        process.env.APP_MODE = 'live'
        assert.equal(await sendOrderAccessEmail('customer@example.invalid', 'MOCK-SMTP', 'http://localhost/track'), false)
        Object.assign(process.env, { NODE_ENV: 'test', APP_MODE: 'sandbox', VERCEL_ENV: 'production' })
        assert.equal(await sendOrderAccessEmail('customer@example.invalid', 'MOCK-SMTP', 'http://localhost/track'), false)
        assert.equal(smtp.messages.length, before + 1)
      } finally { Object.assign(process.env, original) }
    })
    console.log('PASS LAUNCH TOTAL ' + passed)
  } finally { globalThis.fetch = fetchOriginal; await db.$disconnect(); await smtp.close(); await sandbox.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
