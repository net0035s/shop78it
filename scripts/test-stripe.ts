import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import Stripe from 'stripe'
import { sandboxDatabase } from './sandbox-db'

async function main() {
  const sandbox = await sandboxDatabase()
  Object.assign(process.env, { NODE_ENV: 'test', APP_MODE: 'sandbox', VERCEL_ENV: 'development', DATABASE_URL: sandbox.url, DIRECT_URL: sandbox.url,
    ENCRYPTION_KEY: randomBytes(32).toString('hex'), OLD_ENCRYPTION_KEY: '', ORDERS_ENABLED: 'true', PAYMENTS_ENABLED: 'false', LAUNCH_APPROVED: 'false',
    STRIPE_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_localfixture', STRIPE_WEBHOOK_SECRET: 'whsec_' + randomBytes(32).toString('hex'),
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000', EMAIL_USER: '', EMAIL_PASS: '', TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '' })
  const fetchOriginal = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('External calls forbidden by Stripe fixture') }
  const { default: db } = await import('../src/lib/db')
  const { encryptText } = await import('../src/lib/encryption')
  const { transaction } = await import('../src/lib/transactions')
  const { reserveInventory } = await import('../src/lib/inventory')
  const { startPayment } = await import('../src/lib/payments')
  const { assertStripeReady } = await import('../src/lib/stripe-config')
  const { createStripeCheckout, reconcileStripeOrder, cancelStripeCheckout, handleStripeEvent } = await import('../src/lib/stripe-payments')
  const { stripeWebhook, stripeOrderRequest, stripePublicConfiguration } = await import('../src/lib/stripe-handlers')
  type Gateway = import('../src/lib/stripe-payments').StripeGateway
  const checks: string[] = [], sessions = new Map<string, Stripe.Checkout.Session>(), idempotency = new Map<string, { session: Stripe.Checkout.Session; params: string }>()
  let createCalls = 0, uncertainCreation = false, expireRacesPaid = false
  const intentOverrides = new Map<string, Partial<Stripe.PaymentIntent>>()
  const gateway = {
    create: async (params: Stripe.Checkout.SessionCreateParams, options: { idempotencyKey: string }) => {
      createCalls++
      const previous = idempotency.get(options.idempotencyKey)
      if (previous) { assert.equal(JSON.stringify(params), previous.params); return previous.session }
      assert.deepEqual(params.allowed_payment_method_types, ['card', 'promptpay'])
      assert.equal(params.mode, 'payment'); assert.equal(params.line_items?.[0].quantity, 1)
      const id = 'cs_test_' + randomUUID().replaceAll('-', '')
      const session = { id, object: 'checkout.session', mode: 'payment', livemode: false, currency: 'thb', client_reference_id: params.client_reference_id,
        metadata: params.metadata, amount_total: params.line_items![0].price_data!.unit_amount, status: 'open', payment_status: 'unpaid', url: 'https://checkout.stripe.com/c/pay/' + id } as Stripe.Checkout.Session
      idempotency.set(options.idempotencyKey, { session, params: JSON.stringify(params) }); sessions.set(id, session)
      if (uncertainCreation) { uncertainCreation = false; throw new Error('Synthetic response lost after Stripe created session') }
      return session
    },
    retrieve: async (id: string) => { const session = sessions.get(id); assert.ok(session); if (session.payment_status === 'paid' && !session.payment_intent) session.payment_intent = 'pi_' + id; return session },
    retrievePaymentIntent: async (id: string) => {
      const session = [...sessions.values()].find(s => s.payment_intent === id)!; assert.ok(session)
      return { id, status: session.payment_status === 'paid' ? 'succeeded' : 'canceled', amount_received: session.amount_total, currency: session.currency, livemode: session.livemode, metadata: { binding: session.metadata!.binding }, ...intentOverrides.get(id) } as Stripe.PaymentIntent
    },
    expire: async (id: string) => { const session = sessions.get(id)!; assert.ok(session); if (expireRacesPaid) { expireRacesPaid = false; session.status = 'complete'; session.payment_status = 'paid'; throw new Error('Synthetic expiry raced payment') } session.status = 'expired'; return session },
  } as unknown as Gateway
  const category = await db.category.create({ data: { name: 'Stripe fixture', slug: 'stripe-fixture-' + randomUUID() } })
  async function fixture(price = 30, manual = false) {
    const product = await db.product.create({ data: { name: 'MOCK Stripe', description: 'Only synthetic', price, image: '/images/products/placeholder.png', category: category.slug, categoryId: category.id, stock: 1, stockStatus: 'low-stock', tags: '', deliveryType: manual ? 'manual' : 'auto' } })
    if (!manual) await db.digitalStock.create({ data: { productId: product.id, type: 'license-key', content: encryptText(JSON.stringify({ licenseKey: 'MOCK-STRIPE-' + randomUUID() })) } })
    const order = await transaction(async tx => {
      const o = await tx.order.create({ data: { orderNumber: 'STRIPE-MOCK-' + randomUUID(), customerName: 'Sandbox', customerEmail: 'sandbox@example.invalid', total: price, subTotal: price, expiresAt: new Date(Date.now() + 3600000), orderItems: { create: { productId: product.id, quantity: 1, price, productName: product.name, deliveryType: product.deliveryType } } } })
      await reserveInventory(tx, o.id); return o
    })
    return { product, order }
  }
  async function active(orderId: string) { return db.paymentAttempt.findFirstOrThrow({ where: { orderId, method: 'stripe' }, orderBy: { createdAt: 'desc' } }) }
  async function remote(orderId: string) { return sessions.get((await active(orderId)).reference!.slice(7))! }
  function event(session: Stripe.Checkout.Session, type: string = 'checkout.session.completed') { return { id: 'evt_test_' + randomUUID(), livemode: false, type, data: { object: session } } as Stripe.Event }
  async function test(name: string, fn: () => Promise<void> | void) { await fn(); checks.push(name); console.log('PASS ' + name) }
  try {
    await test('sandbox rejects live keys, test keys on live data and disabled Stripe; general payments stay closed', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_live_fixture'; assert.throws(() => assertStripeReady())
      process.env.STRIPE_SECRET_KEY = 'sk_test_localfixture'; process.env.APP_MODE = 'live'; assert.throws(() => assertStripeReady())
      process.env.APP_MODE = 'sandbox'; process.env.STRIPE_ENABLED = 'false'; assert.throws(() => assertStripeReady())
      process.env.STRIPE_ENABLED = 'true'; assert.equal(assertStripeReady(), 'test'); assert.equal(process.env.PAYMENTS_ENABLED, 'false')
    })
    const one = await fixture(30.25)
    await test('server amount in satang and order binding; repeated checkout resumes one session', async () => {
      const first = await createStripeCheckout(one.order.id, gateway), again = await createStripeCheckout(one.order.id, gateway)
      assert.equal(first.url, again.url); assert.equal(createCalls, 1)
      assert.equal((await remote(one.order.id)).amount_total, 3025)
      assert.equal(await db.paymentAttempt.count({ where: { orderId: one.order.id } }), 1)
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: one.order.id } })).status, 'payment_processing')
      await assert.rejects(() => startPayment(one.order.id, 'truemoney', 'must-remain-disabled'))
    })
    await test('unpaid or delayed completion never delivers or releases reservation', async () => {
      const session = await remote(one.order.id); session.status = 'complete'
      await handleStripeEvent(event(session), gateway)
      assert.equal(await db.deliveryItem.count({ where: { orderId: one.order.id } }), 0)
      assert.equal(await db.digitalStock.count({ where: { orderId: one.order.id, isSold: false } }), 1)
    })
    await test('paid event and browser status concurrently fulfill once; stale expiry cannot undo paid', async () => {
      const session = await remote(one.order.id); session.payment_status = 'paid'
      await Promise.all([handleStripeEvent(event(session), gateway), reconcileStripeOrder(one.order.id, gateway)])
      await handleStripeEvent(event(session, 'checkout.session.expired'), gateway)
      assert.equal(await db.deliveryItem.count({ where: { orderId: one.order.id } }), 1)
      assert.equal(await db.orderAuditEvent.count({ where: { orderId: one.order.id, action: 'paid' } }), 1)
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: one.order.id } })).status, 'completed')
    })
    await test('new orders paused after accepting a session still reconcile an existing payment', async () => {
      const f = await fixture(); await createStripeCheckout(f.order.id, gateway)
      const session = await remote(f.order.id); session.status = 'complete'; session.payment_status = 'paid'
      process.env.ORDERS_ENABLED = 'false'; process.env.STRIPE_ENABLED = 'false'
      try { await handleStripeEvent(event(session), gateway); assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, 'completed') }
      finally { process.env.ORDERS_ENABLED = 'true'; process.env.STRIPE_ENABLED = 'true' }
    })
    await test('lost creation response remains locked and recovers with identical idempotency parameters', async () => {
      const f = await fixture(); uncertainCreation = true
      const before = sessions.size
      await assert.rejects(() => createStripeCheckout(f.order.id, gateway))
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, 'payment_review')
      assert.equal((await active(f.order.id)).reference, null)
      await createStripeCheckout(f.order.id, gateway)
      assert.equal(sessions.size, before + 1); assert.ok((await active(f.order.id)).reference)
    })
    await test('wrong amount currency mode or binding remains locked with no delivered secret', async () => {
      for (const property of ['amount_total', 'currency', 'livemode', 'client_reference_id', 'binding']) {
        const f = await fixture(); await createStripeCheckout(f.order.id, gateway)
        const session = await remote(f.order.id); session.status = 'complete'; session.payment_status = 'paid'
        if (property === 'amount_total') session.amount_total = 1
        else if (property === 'currency') session.currency = 'usd'
        else if (property === 'livemode') session.livemode = true
        else if (property === 'client_reference_id') session.client_reference_id = 'foreign-order'
        else session.metadata!.binding = 'wrong'
        await assert.rejects(() => handleStripeEvent(event(session), gateway))
        assert.equal(await db.deliveryItem.count({ where: { orderId: f.order.id } }), 0)
        assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, 'payment_review')
      }
    })
    await test('confirmed expired unpaid session releases stock exactly once and cancels expired order', async () => {
      const f = await fixture(); await createStripeCheckout(f.order.id, gateway)
      await db.order.update({ where: { id: f.order.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
      const session = await remote(f.order.id); session.status = 'expired'
      await handleStripeEvent(event(session, 'checkout.session.expired'), gateway); await handleStripeEvent(event(session, 'checkout.session.expired'), gateway)
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, 'cancelled')
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).stock, 1)
    })
    await test('cancel waits for provider expiry; payment winning the race is fulfilled instead', async () => {
      const f = await fixture(); await createStripeCheckout(f.order.id, gateway); await cancelStripeCheckout(f.order.id, gateway)
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, 'pending')
      process.env.PAYMENTS_ENABLED = 'true'
      try { await startPayment(f.order.id, 'truemoney', 'mock-truemoney-after-stripe-cancel') } finally { process.env.PAYMENTS_ENABLED = 'false' }
      const paid = await fixture(); await createStripeCheckout(paid.order.id, gateway); expireRacesPaid = true; await cancelStripeCheckout(paid.order.id, gateway)
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: paid.order.id } })).status, 'completed')
    })
    await test('closed Checkout with a still-processing intent never releases stock', async () => {
      const f = await fixture(); await createStripeCheckout(f.order.id, gateway)
      const session = await remote(f.order.id); session.status = 'expired'; session.payment_intent = 'pi_processing_' + session.id
      intentOverrides.set(session.payment_intent, { status: 'processing' })
      await handleStripeEvent(event(session, 'checkout.session.expired'), gateway)
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, 'payment_review')
      assert.equal(await db.digitalStock.count({ where: { orderId: f.order.id, isSold: false } }), 1)
      intentOverrides.set(session.payment_intent, { status: 'canceled' })
      await handleStripeEvent(event(session, 'checkout.session.expired'), gateway)
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, 'pending')
    })
    await test('paid Checkout with unconfirmed intent received amount cannot deliver', async () => {
      const f = await fixture(); await createStripeCheckout(f.order.id, gateway)
      const session = await remote(f.order.id); session.status = 'complete'; session.payment_status = 'paid'; session.payment_intent = 'pi_wrong_' + session.id
      intentOverrides.set(session.payment_intent, { amount_received: 1 })
      await assert.rejects(() => handleStripeEvent(event(session), gateway))
      assert.equal(await db.deliveryItem.count({ where: { orderId: f.order.id } }), 0)
    })
    await test('manual payment waits for admin delivery and refund replay cannot expose delivery again', async () => {
      const f = await fixture(30, true); await createStripeCheckout(f.order.id, gateway)
      const session = await remote(f.order.id); session.status = 'complete'; session.payment_status = 'paid'
      await handleStripeEvent(event(session), gateway)
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status, 'needs_manual_delivery')
      await db.order.update({ where: { id: one.order.id }, data: { status: 'refunded' } })
      await handleStripeEvent(event(await remote(one.order.id)), gateway)
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: one.order.id } })).status, 'refunded')
      assert.equal(await db.deliveryItem.count({ where: { orderId: one.order.id } }), 1)
    })
    await test('minimum amount and short expiry reject before provider call or payment claim', async () => {
      const low = await fixture(9), old = await fixture()
      await db.order.update({ where: { id: old.order.id }, data: { expiresAt: new Date(Date.now() + 20 * 60000) } })
      const before = createCalls
      await assert.rejects(() => createStripeCheckout(low.order.id, gateway)); await assert.rejects(() => createStripeCheckout(old.order.id, gateway))
      assert.equal(createCalls, before); assert.equal(await db.paymentAttempt.count({ where: { orderId: { in: [low.order.id, old.order.id] } } }), 0)
    })
    await test('concurrent checkout creates one attempt and never two sessions', async () => {
      const f = await fixture(), before = sessions.size
      const results = await Promise.allSettled([createStripeCheckout(f.order.id, gateway), createStripeCheckout(f.order.id, gateway)])
      assert.ok(results.some(r => r.status === 'fulfilled')); assert.equal(sessions.size, before + 1)
      assert.equal(await db.paymentAttempt.count({ where: { orderId: f.order.id } }), 1)
    })
    await test('HTTP rejects foreign origin and order-number-only access before provider calls', async () => {
      const make = (origin: string) => new Request('http://localhost:3000/api/payment/stripe', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ orderNumber: one.order.orderNumber }) })
      assert.equal((await stripeOrderRequest(make('https://foreign.example.invalid'), 'checkout')).status, 403)
      assert.equal((await stripeOrderRequest(make('http://localhost:3000'), 'checkout')).status, 403)
      assert.ok(!(await stripePublicConfiguration().text()).includes(process.env.STRIPE_SECRET_KEY!))
    })
    await test('raw webhook signature rejects tampering and oversized payloads; other-app events ignored', async () => {
      const payload = JSON.stringify({ id: 'evt_test_mock', object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: { id: 'cs_test_otherapp', metadata: {} } } })
      const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! })
      const req = (body: string) => new Request('http://localhost:3000/api/payment/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': signature, 'content-type': 'application/json' }, body })
      assert.equal((await stripeWebhook(req(payload + ' '))).status, 400)
      assert.equal((await stripeWebhook(req('x'.repeat(262145)))).status, 413)
      assert.equal((await stripeWebhook(req(payload))).status, 200)
    })
    writeFileSync('docs/launch-stripe-fixture-latest.json', JSON.stringify({ checkedAt: new Date().toISOString(), passed: checks.length, checks, sandboxOnly: true, database: sandbox.url.includes('127.0.0.1') ? 'temporary-loopback' : 'loopback', provider: 'mock only', realPayments: false, externalMessages: 0, deployed: false }, null, 2) + '\n')
  } finally { globalThis.fetch = fetchOriginal; await db.$disconnect(); await sandbox.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
