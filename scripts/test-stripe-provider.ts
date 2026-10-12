import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { cloudSandboxEnvironment } from './cloud-sandbox-config'
import { sandboxDatabase } from './sandbox-db'

async function main() {
  const report = { checkedAt: new Date().toISOString(), sandboxOnly: true, productionConnected: false, deployed: false, realPayments: false, externalMessages: 0,
    providerContacted: false, passed: false, checkoutCreated: false, sessionReused: false, sessionExpired: false, fixtureClosed: false, cardOrPromptPayPaidTested: false, webhookFromStripeTested: false }
  let sandbox: Awaited<ReturnType<typeof sandboxDatabase>> | undefined
  let db: (typeof import('../src/lib/db'))['default'] | undefined
  try {
    const env = cloudSandboxEnvironment()
    assert.ok(/^[rs]k_test_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY || ''), 'Only a Stripe sandbox server key is allowed')
    sandbox = await sandboxDatabase()
    Object.assign(process.env, env, { NODE_ENV: 'test', DATABASE_URL: sandbox.url, DIRECT_URL: sandbox.url, ENCRYPTION_KEY: randomBytes(32).toString('hex'), OLD_ENCRYPTION_KEY: '', STRIPE_ENABLED: 'true', PAYMENTS_ENABLED: 'false' })
    db = (await import('../src/lib/db')).default
    const { transaction } = await import('../src/lib/transactions')
    const { reserveInventory } = await import('../src/lib/inventory')
    const { createStripeCheckout, cancelStripeCheckout, stripeClient } = await import('../src/lib/stripe-payments')
    const category = await db.category.create({ data: { name: 'MOCK provider test', slug: 'stripe-provider-' + randomUUID() } })
    const product = await db.product.create({ data: { name: 'MOCK Stripe API verification', description: 'Sandbox only; no real product', price: 30, image: '/images/products/placeholder.png', category: category.slug, categoryId: category.id, stock: 1, stockStatus: 'low-stock', deliveryType: 'manual', tags: '' } })
    const order = await transaction(async tx => {
      const o = await tx.order.create({ data: { orderNumber: 'STRIPE-PROVIDER-MOCK-' + randomUUID(), customerName: 'MOCK provider fixture', customerEmail: 'sandbox@example.invalid', total: 30, subTotal: 30, expiresAt: new Date(Date.now() + 3600000), orderItems: { create: { productId: product.id, quantity: 1, price: 30, productName: product.name, deliveryType: 'manual' } } } })
      await reserveInventory(tx, o.id); return o
    })
    report.providerContacted = true
    const first = await createStripeCheckout(order.id), again = await createStripeCheckout(order.id)
    assert.ok(first.url); assert.equal(first.url, again.url)
    const attempt = await db.paymentAttempt.findFirstOrThrow({ where: { orderId: order.id, method: 'stripe' } })
    assert.equal(await db.paymentAttempt.count({ where: { orderId: order.id } }), 1)
    const session = await stripeClient().checkout.sessions.retrieve(attempt.reference!.slice(7))
    assert.equal(session.livemode, false); assert.equal(session.currency, 'thb'); assert.equal(session.amount_total, 3000)
    report.checkoutCreated = true; report.sessionReused = true
    await cancelStripeCheckout(order.id)
    const closed = await stripeClient().checkout.sessions.retrieve(session.id)
    assert.equal(closed.status, 'expired'); assert.equal(closed.payment_status, 'unpaid')
    report.sessionExpired = true; report.passed = true
  } finally {
    await db?.$disconnect(); await sandbox?.close()
    report.fixtureClosed = true
    writeFileSync('docs/launch-stripe-provider-latest.json', JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report))
  }
}
main().catch(() => { console.error('Stripe provider test stopped. Check sandbox key and required API permissions; private details withheld.'); process.exitCode = 1 })
