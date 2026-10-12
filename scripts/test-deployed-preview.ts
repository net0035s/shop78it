import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { cloudSandboxEnvironment } from './cloud-sandbox-config'
let lastCheck = 'initialization'

async function main() {
  Object.assign(process.env, cloudSandboxEnvironment())
  const deployment = JSON.parse(readFileSync('docs/launch-preview-deployment-latest.json', 'utf8'))
  assert.equal(deployment.target, 'preview'); assert.equal(deployment.state, 'READY')
  const base = new URL(deployment.url).origin
  const request = require('../.cache/preview-request.cjs') as (path: string, options?: { method?: string; headers?: Record<string, string>; body?: unknown }) => Promise<{ status: number; body: string; headers: string }>
  const { default: db } = await import('../src/lib/db')
  const { cancelPendingOrder } = await import('../src/lib/inventory')
  const { transaction } = await import('../src/lib/transactions')
  const { cancelStripeCheckout } = await import('../src/lib/stripe-payments')
  const run = randomUUID(), email = 'preview-' + run + '@example.invalid', name = 'Preview smoke ' + run
  const report = { checkedAt: new Date().toISOString(), url: base, sandboxOnly: true, productionConnected: false, realPayments: false, externalMessages: 0, checks: [] as string[], passed: false, fixtureRemoved: false, originalCatalogPreserved: false }
  let productId: string | undefined, categoryId: string | undefined
  const baseline = JSON.stringify(await db.product.findMany({ orderBy: { id: 'asc' } }))
  async function test(label: string, fn: () => Promise<void>) { lastCheck = label; await fn(); report.checks.push(label); console.log('PASS ' + label) }
  try {
    await test('online Preview returns 200 with sandbox banner and three MOCK products', async () => {
      const page = await request('/'); assert.equal(page.status, 200)
      assert.ok(page.body.includes('เว็บทดลอง') && page.body.includes('MOCK Account') && page.body.includes('MOCK License') && page.body.includes('MOCK Manual Delivery'))
    })
    await test('admin and unauthenticated cron remain protected on the deployment', async () => {
      assert.equal((await request('/api/admin/readiness')).status, 401)
      assert.equal((await request('/api/cron/clear-unpaid')).status, 401)
    })
    const category = await db.category.create({ data: { name: 'MOCK temporary Preview smoke', slug: 'preview-smoke-' + run } }); categoryId = category.id
    const product = await db.product.create({ data: { name: 'MOCK temporary Preview smoke', description: 'Temporary fixture; no real delivery', price: 30.25, image: '/images/products/placeholder.png', category: category.slug, categoryId: category.id, stock: 1, stockStatus: 'low-stock', tags: '', deliveryType: 'manual' } }); productId = product.id
    const body = { items: [{ productId: product.id, quantity: 1 }], customer: { name, email } }
    const headers = { origin: base, 'content-type': 'application/json' }
    await test('foreign origin is rejected before creating an order', async () => {
      assert.equal((await request('/api/orders', { method: 'POST', headers: { ...headers, origin: 'https://foreign.example.invalid' }, body })).status, 403)
      assert.equal(await db.order.count({ where: { customerEmail: email } }), 0)
    })
    let number = '', cookie = ''
    await test('deployed checkout creates and reserves only its own MOCK fixture', async () => {
      const created = await request('/api/orders', { method: 'POST', headers, body }); assert.equal(created.status, 200)
      const result = JSON.parse(created.body); assert.equal(result.success, true); number = result.data.orderNumber
      cookie = created.headers.split(/\r?\n/).find(line => /^set-cookie:\s*oa_/i.test(line))?.replace(/^set-cookie:\s*/i, '').split(';')[0] || ''
      assert.ok(cookie)
      const order = await db.order.findUniqueOrThrow({ where: { orderNumber: number } })
      assert.equal(order.customerEmail, email); assert.equal(order.status, 'pending'); assert.equal(Number(order.total), 30.25)
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 0)
    })
    await test('order number alone is denied; the scoped HttpOnly cookie can read its pending order', async () => {
      const path = '/api/orders?orderNumber=' + encodeURIComponent(number)
      assert.equal((await request(path)).status, 403)
      const owned = await request(path, { headers: { cookie } }); assert.equal(owned.status, 200)
      const result = JSON.parse(owned.body); assert.equal(result.data.status, 'pending'); assert.equal(result.data.deliveryItems.length, 0)
    })
    await test('matching order and email show receipt metadata but never grant delivery access or claim email was sent', async () => {
      const summary = await request('/api/orders/track', { method: 'POST', headers, body: { orderNumber: number, email } })
      assert.equal(summary.status, 200)
      const result = JSON.parse(summary.body)
      assert.equal(result.data.status, 'pending'); assert.equal(result.data.items[0].name, product.name)
      assert.equal(result.accessEmailAvailable, false)
      for (const key of ['deliveryItems', 'deliveredContent', 'customer', 'internalNote', 'reference']) assert.ok(!(key in result.data))
      assert.ok(!/set-cookie:/i.test(summary.headers))
      const wrong = await request('/api/orders/track', { method: 'POST', headers, body: { orderNumber: number, email: 'wrong@example.invalid' } })
      assert.equal(wrong.status, 404)
      const link = await request('/api/orders/access', { method: 'POST', headers, body: { orderNumber: number, email } })
      assert.equal(link.status, 503)
    })
    await test('TrueMoney stays disabled; Stripe is either disabled or safely opens and cancels sandbox checkout', async () => {
      const owned = { ...headers, cookie }
      assert.equal((await request('/api/payment/truemoney', { method: 'POST', headers: owned, body: { orderId: number, voucherLink: 'MOCK-NOT-A-REAL-VOUCHER' } })).status, 503)
      const configuration = await request('/api/payment/stripe'); assert.equal(configuration.status, 200)
      const config = JSON.parse(configuration.body).data
      if (config.enabled) {
        assert.equal(config.testMode, true)
        assert.deepEqual(config.methods, ['card', 'promptpay'])
        lastCheck = 'Stripe sandbox checkout creation'
        const checkout = await request('/api/payment/stripe', { method: 'POST', headers: owned, body: { orderNumber: number } })
        console.log('Stripe sandbox checkout HTTP ' + checkout.status)
        assert.equal(checkout.status, 200)
        const result = JSON.parse(checkout.body).data
        assert.equal(new URL(result.url).hostname, 'checkout.stripe.com')
        assert.equal(result.order.status, 'payment_processing')
        lastCheck = 'Stripe sandbox checkout reuse'
        const again = await request('/api/payment/stripe', { method: 'POST', headers: owned, body: { orderNumber: number } })
        assert.equal(again.status, 200); assert.equal(JSON.parse(again.body).data.url, result.url)
        assert.equal(await db.paymentAttempt.count({ where: { order: { customerEmail: email } } }), 1)
        lastCheck = 'Stripe sandbox checkout status'
        assert.equal((await request('/api/payment/stripe/status', { method: 'POST', headers: owned, body: { orderNumber: number } })).status, 200)
        lastCheck = 'Stripe sandbox checkout cancellation'
        assert.equal((await request('/api/payment/stripe/cancel', { method: 'POST', headers: owned, body: { orderNumber: number } })).status, 200)
        const order = await db.order.findUniqueOrThrow({ where: { orderNumber: number }, include: { deliveryItems: true } })
        assert.equal(order.paidAt, null); assert.equal(order.deliveryItems.length, 0)
      } else {
        assert.equal((await request('/api/payment/stripe', { method: 'POST', headers: owned, body: { orderNumber: number } })).status, 503)
        assert.equal(await db.paymentAttempt.count({ where: { order: { customerEmail: email } } }), 0)
      }
    })
    report.passed = true
  } finally {
    for (const order of await db.order.findMany({ where: { customerEmail: email } })) {
      assert.equal(order.customerName, name)
      if (['payment_processing', 'payment_review'].includes(order.status)) await cancelStripeCheckout(order.id)
    }
    await transaction(async tx => {
      const owned = await tx.order.findMany({ where: { customerEmail: email }, include: { orderItems: true } })
      for (const order of owned) {
        assert.equal(order.customerName, name); assert.ok(order.orderItems.every(item => item.productId === productId))
        assert.ok(['pending', 'cancelled'].includes(order.status)); assert.equal(order.paidAt, null)
        if (order.status === 'pending') await cancelPendingOrder(tx, order.id, 'preview-smoke-cleanup')
        await tx.orderAuditEvent.deleteMany({ where: { orderId: order.id } })
        await tx.paymentAttempt.deleteMany({ where: { orderId: order.id } })
        await tx.order.delete({ where: { id: order.id } })
      }
      if (productId) await tx.product.delete({ where: { id: productId } })
      if (categoryId) await tx.category.delete({ where: { id: categoryId } })
    })
    report.fixtureRemoved = true
    report.originalCatalogPreserved = baseline === JSON.stringify(await db.product.findMany({ orderBy: { id: 'asc' } }))
    await db.$disconnect()
    writeFileSync('docs/launch-preview-smoke-latest.json', JSON.stringify(report, null, 2) + '\n')
    assert.ok(report.originalCatalogPreserved, 'Existing catalog differs; no original row was overwritten by cleanup')
  }
}
main().catch(() => { console.error('Deployed Preview test stopped at ' + lastCheck + '; private details withheld. Read the sanitized report.'); process.exitCode = 1 })
