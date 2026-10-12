import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import { loadEnvConfig } from '@next/env'
import { createClerkClient } from '@clerk/backend'
import { clerk, clerkSetup } from '@clerk/testing/playwright'
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test'
import { sandboxDatabase } from './sandbox-db'
import { sandboxSmtp, decodeSandboxMail } from './sandbox-smtp'

async function freePort() {
  const server = createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  await new Promise<void>(resolve => server.close(() => resolve()))
  return port
}

async function main() {
  // Read only Clerk test credentials; overwrite all database and delivery settings before app imports.
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} })
  const publicKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''
  const secretKey = process.env.CLERK_SECRET_KEY || ''
  assert.ok(publicKey.startsWith('pk_test_') && secretKey.startsWith('sk_test_'), 'E2E requires Clerk test keys')
  const clerkHost = Buffer.from(publicKey.slice(8), 'base64').toString().replace(/\$$/, '')
  assert.ok(clerkHost.endsWith('.clerk.accounts.dev'), 'Only a Clerk development instance is allowed')
  const sandbox = await sandboxDatabase()
  const smtp = await sandboxSmtp()
  const port = await freePort(), base = `http://localhost:${port}`
  const run = randomUUID().replaceAll('-', '').slice(0, 12)
  const adminEmail = `shop78it-e2e-admin-${run}+clerk_test@example.com`
  const customerEmail = `shop78it-e2e-customer-${run}+clerk_test@example.com`
  const password = randomBytes(24).toString('base64url') + '!a9'
  const env = { ...process.env, STRIPE_ENABLED: 'false', STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', NODE_ENV: 'test', APP_MODE: 'sandbox', VERCEL_ENV: 'development', ORDERS_ENABLED: 'true', PAYMENTS_ENABLED: 'false', LAUNCH_APPROVED: 'false',
    DATABASE_URL: sandbox.url, DIRECT_URL: sandbox.url, ENCRYPTION_KEY: randomBytes(32).toString('hex'), OLD_ENCRYPTION_KEY: '',
    NEXT_PUBLIC_SITE_URL: base, NEXT_PUBLIC_BASE_URL: base, NEXT_PUBLIC_SUPPORT_EMAIL: 'support@example.invalid', NEXT_PUBLIC_LINE_URL: '',
    EMAIL_USER: 'sender@example.invalid', EMAIL_PASS: 'sandbox-only', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port),
    TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '', TMN_RECEIVE_PHONE: '', PROMPTPAY_NUMBER: '', SLIPOK_API_KEY: '', SLIPOK_BRANCH_ID: '', SLIP_VERIFY_API_KEY: '', SLIP_VERIFY_API_URL: '',
    NEXT_PUBLIC_GA_ID: '', NEXT_PUBLIC_FB_PIXEL_ID: '', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publicKey, CLERK_SECRET_KEY: secretKey,
    ADMIN_EMAILS: adminEmail, CRON_SECRET: randomBytes(32).toString('hex'), SHOP_E2E_RUN: 'true', SHOP_E2E_PORT: String(port), NEXT_TELEMETRY_DISABLED: '1', CLERK_TELEMETRY_DISABLED: '1' }
  Object.assign(process.env, env)
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(sandbox.url).hostname))
  const { default: db } = await import('../src/lib/db')
  const { encryptText, decryptText } = await import('../src/lib/encryption')
  const { startPayment, recordPayment } = await import('../src/lib/payments')
  const { fulfillPaidOrder } = await import('../src/lib/order-fulfillment')
  const { processNotifications } = await import('../src/lib/notifications')
  const { cancelPendingOrder } = await import('../src/lib/inventory')
  const { transaction } = await import('../src/lib/transactions')
  const client = createClerkClient({ secretKey, publishableKey: publicKey })
  const ownedUsers: string[] = []
  const report = { checkedAt: new Date().toISOString(), passed: false, sandboxOnly: true, database: 'temporary-loopback', deployed: false, realPayments: false, externalEmailsSent: 0,
    clerkInstance: 'test', loginMethod: 'official Clerk Playwright helper with real test sessions', checks: [] as string[], syntheticUsersRemoved: false, fixtureDatabaseClosed: false, localSmtpMessages: 0 }
  let server: ChildProcess | undefined
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  let lastStage = 'setup'
  async function test(name: string, fn: () => Promise<void>) { lastStage = name; await fn(); report.checks.push(name); console.log('PASS ' + name) }
  try {
    const category = await db.category.create({ data: { name: 'E2E Sandbox', slug: 'e2e-sandbox' } })
    const auto = await db.product.create({ data: { id: 'e2e-auto', name: 'MOCK E2E License', description: 'Synthetic local fixture; no real fulfillment', price: 10.25, image: '/images/products/placeholder.png', category: category.slug, categoryId: category.id, stock: 4, stockStatus: 'low-stock', tags: '[]', deliveryType: 'auto' } })
    const manual = await db.product.create({ data: { id: 'e2e-manual', name: 'MOCK E2E Manual', description: 'Synthetic local fixture; no real fulfillment', price: 20, image: '/images/products/placeholder.png', category: category.slug, categoryId: category.id, stock: 3, stockStatus: 'low-stock', tags: '', deliveryType: 'manual' } })
    const account = await db.product.create({ data: { id: 'e2e-account', name: 'MOCK E2E Account', description: 'Synthetic local credentials only', price: 30, image: '/images/products/placeholder.png', category: category.slug, categoryId: category.id, stock: 1, stockStatus: 'low-stock', tags: '', deliveryType: 'auto' } })
    await db.digitalStock.create({ data: { productId: account.id, type: 'login-info', content: encryptText(JSON.stringify({ email: 'mock-account@example.invalid', password: 'MOCK-PASSWORD-ONLY', loginUrl: 'https://example.invalid/login', instructions: 'HIDDEN-E2E-INSTRUCTION' })), showInstruction: false } })
    for (let i = 0; i < 4; i++) await db.digitalStock.create({ data: { productId: auto.id, type: 'license-key', content: encryptText(JSON.stringify({ licenseKey: 'MOCK-E2E-LICENSE-' + i, instructions: 'HIDDEN-E2E-INSTRUCTION' })), showInstruction: false } })
    await db.discountCode.create({ data: { code: 'E2E10', discountType: 'PERCENT', discountValue: 10, maxUses: 2 } })
    await db.discountCode.create({ data: { code: 'E2EFREE', discountType: 'PERCENT', discountValue: 100, maxUses: 1 } })
    for (const email of [adminEmail, customerEmail]) {
      const user = await client.users.createUser({ emailAddress: [email], password })
      ownedUsers.push(user.id)
      assert.equal(user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.verification?.status, 'verified')
    }
    await clerkSetup({ publishableKey: publicKey, secretKey })
    server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/storefront-e2e-app.ts'], { env: { ...env, NODE_ENV: 'development' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    await new Promise<void>((resolve, reject) => {
      let output = ''
      const timer = setTimeout(() => reject(new Error('Sandbox server startup timeout')), 90000)
      server!.once('error', reject)
      server!.once('exit', () => { clearTimeout(timer); reject(new Error('Sandbox server exited before ready')) })
      server!.stdout!.on('data', chunk => { output = (output + chunk.toString()).slice(-1000); if (output.includes('SHOP_E2E_READY')) { clearTimeout(timer); resolve() } })
      server!.stderr!.on('data', () => {})
    })
    browser = await chromium.launch({ ...(process.platform === 'win32' ? { channel: 'msedge' } : {}), headless: true })
    mkdirSync('.cache/storefront-e2e', { recursive: true })
    async function context(viewport = { width: 1280, height: 900 }): Promise<BrowserContext> {
      const ctx = await browser!.newContext({ viewport })
      ctx.setDefaultTimeout(30000)
      ctx.setDefaultNavigationTimeout(60000)
      await ctx.route('**/*', route => {
        const url = new URL(route.request().url())
        return ['localhost', '127.0.0.1', clerkHost].includes(url.hostname) ? route.continue() : route.abort()
      })
      return ctx
    }
    async function dismissCookies(page: Page) {
      const button = page.getByRole('button', { name: 'ปฏิเสธ', exact: true })
      try { await button.waitFor({ state: 'visible', timeout: 2000 }); await button.click() } catch { /* Banner may already be dismissed. */ }
    }
    async function checkout(productId: string, coupon?: string, viewport = { width: 1280, height: 900 }) {
      const ctx = await context(viewport), page = await ctx.newPage()
      await page.goto(base + '/#products')
      await page.locator('#view-details-' + productId).waitFor()
      await dismissCookies(page)
      await page.locator('#view-details-' + productId).click()
      await page.locator('#modal-add-to-cart').click()
      await page.locator('#proceed-to-checkout').click()
      await page.locator('#customer-name').fill('Sandbox buyer')
      await page.locator('#customer-email').fill('buyer@example.invalid')
      if (coupon) {
        await page.getByPlaceholder('กรอกโค้ดส่วนลด...').fill(coupon)
        const [applied] = await Promise.all([
          page.waitForResponse(r => r.url().endsWith('/api/discount/apply')),
          page.getByRole('main').getByRole('button', { name: 'ใช้โค้ด', exact: true }).click(),
        ])
        assert.equal(applied.status(), 200)
      }
      const [response] = await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/api/orders') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'ไปขั้นตอนชำระเงิน', exact: true }).click(),
      ])
      const body = await response.json()
      assert.equal(response.status(), 200); assert.equal(body.success, true)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      return { ctx, page, order: await db.order.findUniqueOrThrow({ where: { orderNumber: body.data.orderNumber } }) }
    }
    async function mockPayment(orderId: string, total: number) {
      // Only this test-controller process enables the mock; the HTTP app remains payment-disabled.
      process.env.PAYMENTS_ENABLED = 'true'
      try {
        const attempt = await startPayment(orderId, 'slipok', 'mock-e2e:' + orderId)
        await recordPayment(attempt.attempt.id, 'slipok:mock-e2e:' + orderId, total)
      } finally { process.env.PAYMENTS_ENABLED = 'false' }
      await fulfillPaidOrder(orderId)
      await processNotifications(orderId)
    }
    async function repeatPurchase(page: Page, previousNumber: string) {
      const previous = await db.order.findUniqueOrThrow({ where: { orderNumber: previousNumber } })
      await page.goto(base + '/#products')
      await page.locator('#view-details-' + auto.id).click()
      await page.locator('#modal-add-to-cart').click()
      await page.locator('#proceed-to-checkout').click()
      await page.locator('#customer-name').waitFor({ state: 'visible' })
      assert.equal(new URL(page.url()).pathname, '/checkout')
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shopauto-order') || '{}').state)
      assert.equal(saved.currentOrderNumber, null)
      assert.ok(saved.orderHistory.includes(previousNumber))
      await page.locator('#customer-name').fill('Sandbox repeat buyer')
      await page.locator('#customer-email').fill('repeat-buyer@example.invalid')
      const [response] = await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/api/orders') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'ไปขั้นตอนชำระเงิน', exact: true }).click(),
      ])
      assert.equal(response.status(), 200)
      const result = await response.json()
      assert.equal(result.success, true); assert.notEqual(result.data.orderNumber, previousNumber)
      assert.equal(result.data.status, 'pending')
      const fresh = await db.order.findUniqueOrThrow({ where: { orderNumber: result.data.orderNumber } })
      await transaction(tx => cancelPendingOrder(tx, fresh.id, 'repeat-purchase-fixture-cleanup'))
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: previous.id } })).status, previous.status)
      // A deliberate link to the paid order must still show its original delivery.
      await page.goto(base + '/checkout?order=' + encodeURIComponent(previousNumber))
      await page.waitForURL(base + '/thank-you')
      await page.getByText(previousNumber, { exact: true }).first().waitFor()
    }
    const anonymous = await context(), anonPage = await anonymous.newPage()
    await anonPage.goto(base)
    await test('anonymous admin API denied and foreign-origin order creates no data', async () => {
      assert.equal((await anonymous.request.get(base + '/api/admin/readiness')).status(), 401)
      assert.equal((await anonymous.request.post(base + '/api/orders', { headers: { origin: 'https://foreign.example.invalid' }, data: {} })).status(), 403)
      assert.equal(await db.order.count(), 0)
    })
    await anonymous.close()
    const admin = await context(), adminPage = await admin.newPage()
    await adminPage.goto(base)
    await clerk.signIn({ page: adminPage, emailAddress: adminEmail })
    await test('Clerk verified-primary test admin accepted and ordinary customer denied', async () => {
      const status = await adminPage.evaluate(async () => (await fetch('/api/admin/readiness')).status)
      assert.equal(status, 200)
      const customer = await context(), page = await customer.newPage()
      await page.goto(base); await clerk.signIn({ page, emailAddress: customerEmail })
      assert.equal(await page.evaluate(async () => (await fetch('/api/admin/readiness')).status), 403)
      await customer.close()
    })
    let autoOrder: Awaited<ReturnType<typeof checkout>>
    await test('browser checkout reserves automatic stock; real payment endpoint stays disabled', async () => {
      autoOrder = await checkout(auto.id)
      assert.equal(Number(autoOrder.order.total), 10.25)
      assert.equal(autoOrder.order.status, 'pending')
      assert.equal(await db.digitalStock.count({ where: { orderId: autoOrder.order.id, isSold: false } }), 1)
      const payment = await autoOrder.ctx.request.post(base + '/api/payment/promptpay', { headers: { origin: base }, data: { orderNumber: autoOrder.order.orderNumber } })
      assert.equal(payment.status(), 503)
      await autoOrder.page.screenshot({ path: '.cache/storefront-e2e/pending-checkout.png', fullPage: true })
    })
    await test('checkout shows exactly TrueMoney and Stripe; unconfigured Stripe cannot charge', async () => {
      await autoOrder.page.getByRole('button', { name: /บัตร \/ PromptPay/ }).click()
      await autoOrder.page.getByText('Stripe ยังไม่พร้อมชำระเงิน กรุณาติดต่อร้านค้า', { exact: true }).waitFor()
      await expect(autoOrder.page.getByRole('button', { name: 'ไปชำระผ่าน Stripe', exact: true })).toBeDisabled()
      assert.equal(await autoOrder.page.locator('input[type="file"]').count(), 0)
      await autoOrder.page.setViewportSize({ width: 390, height: 844 })
      await autoOrder.page.screenshot({ path: '.cache/storefront-e2e/stripe-payment-mobile.png', fullPage: true })
      const overflow = await autoOrder.page.evaluate(() => [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed').map(el => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right })).slice(0, 8))
      if (overflow.length) console.log('Sandbox mobile overflow: ' + JSON.stringify(overflow))
      assert.equal(await autoOrder.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      await autoOrder.page.getByRole('button', { name: /ซองทรูมันนี่/ }).click()
    })
    await test('mock-confirmed automatic order delivers once and displays key after reload', async () => {
      await mockPayment(autoOrder.order.id, 10.25)
      await fulfillPaidOrder(autoOrder.order.id)
      const item = await db.deliveryItem.findFirstOrThrow({ where: { orderId: autoOrder.order.id } })
      assert.equal(await db.deliveryItem.count({ where: { orderId: autoOrder.order.id } }), 1)
      assert.ok(smtp.messages.map(decodeSandboxMail).some(message => message.includes(decryptText(item.licenseKey!))))
      await autoOrder.page.goto(base + '/thank-you')
      await expect(autoOrder.page.locator('input[readonly]')).toHaveValue(decryptText(item.licenseKey!))
      assert.ok(!(await autoOrder.page.locator('body').innerText()).includes('HIDDEN-E2E-INSTRUCTION'))
      await autoOrder.page.reload()
      await expect(autoOrder.page.locator('input[readonly]')).toHaveValue(decryptText(item.licenseKey!))
      await autoOrder.page.screenshot({ path: '.cache/storefront-e2e/automatic-delivery.png', fullPage: true })
      await test('completed order remains in history while the same browser creates a new purchase', () => repeatPurchase(autoOrder.page, autoOrder.order.orderNumber))
      await autoOrder.ctx.close()
    })
    await test('manual order stays pending delivery until authenticated admin supplies content', async () => {
      const fixture = await checkout(manual.id, undefined, { width: 390, height: 844 })
      await mockPayment(fixture.order.id, 20)
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: fixture.order.id } })).status, 'needs_manual_delivery')
      await fixture.page.goto(base + '/thank-you')
      await fixture.page.getByText('รอร้านค้าจัดส่ง', { exact: true }).waitFor()
      await test('paid manual-delivery order does not redirect the next purchase to its old bill', () => repeatPurchase(fixture.page, fixture.order.orderNumber))
      const tracking = await context(), trackingPage = await tracking.newPage()
      await trackingPage.goto(base + '/track'); await dismissCookies(trackingPage)
      await trackingPage.locator('#track-number').fill(fixture.order.orderNumber)
      await trackingPage.locator('#track-email').fill('buyer@example.invalid')
      await trackingPage.getByRole('button', { name: 'ค้นหาออเดอร์', exact: true }).click()
      await trackingPage.getByText('รับเงินแล้ว รอร้านค้าจัดส่งส่วนที่เหลือ', { exact: true }).waitFor()
      const result = await adminPage.evaluate(async ({ id, content }) => {
        const r = await fetch('/api/admin/orders/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'completed', deliveredContent: content, sendEmailNotification: true }) })
        return { status: r.status, body: await r.json() }
      }, { id: fixture.order.id, content: 'MOCK E2E MANUAL DELIVERY' })
      assert.equal(result.status, 200); assert.equal(result.body.success, true)
      assert.notEqual((await db.order.findUniqueOrThrow({ where: { id: fixture.order.id } })).deliveredContent, 'MOCK E2E MANUAL DELIVERY')
      await test('admin completion updates both the open tracking page and delivery page without reload', async () => {
        await fixture.page.getByText('MOCK E2E MANUAL DELIVERY', { exact: true }).waitFor()
        await trackingPage.getByText('จัดส่งครบแล้ว', { exact: true }).waitFor()
        assert.equal(await trackingPage.getByRole('link', { name: 'เปิดข้อมูลสินค้าที่ได้รับ' }).count(), 0)
      })
      await tracking.close()
      assert.equal(await fixture.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      await fixture.page.screenshot({ path: '.cache/storefront-e2e/manual-delivery-mobile.png', fullPage: true })
      await fixture.ctx.close()
    })
    await test('cross-device order access needs email link; browser exchange is single-use', async () => {
      const ctx = await context({ width: 390, height: 844 }), page = await ctx.newPage()
      assert.equal((await ctx.request.get(base + '/api/orders?orderNumber=' + autoOrder.order.orderNumber)).status(), 403)
      const before = smtp.messages.length
      const requested = await ctx.request.post(base + '/api/orders/access', { headers: { origin: base }, data: { orderNumber: autoOrder.order.orderNumber, email: 'buyer@example.invalid' } })
      assert.equal(requested.status(), 202); assert.equal(smtp.messages.length, before + 1)
      const link = decodeSandboxMail(smtp.messages.at(-1)!).match(/href="([^"]+#access=[^"]+)"/)?.[1]
      assert.ok(link && link.startsWith(base + '/track#access='))
      await page.goto(link)
      await page.getByRole('heading', { name: autoOrder.order.orderNumber, exact: true }).waitFor()
      assert.equal(new URL(page.url()).hash, '')
      await page.getByRole('link', { name: 'เปิดข้อมูลสินค้าที่ได้รับ' }).click()
      const key = decryptText((await db.deliveryItem.findFirstOrThrow({ where: { orderId: autoOrder.order.id } })).licenseKey!)
      await expect(page.locator('input[readonly]')).toHaveValue(key)
      const replay = await ctx.request.post(base + '/api/orders/access', { headers: { origin: base }, data: { token: new URL(link).hash.slice('#access='.length) } })
      assert.equal(replay.status(), 403)
      await ctx.close()
    })
    await test('order number and email show fresh receipt metadata without an email link or delivery access', async () => {
      const ctx = await context({ width: 390, height: 844 }), page = await ctx.newPage()
      const mailBefore = smtp.messages.length, grantsBefore = await db.orderAccessSession.count()
      const endpoint = base + '/api/orders/track', headers = { origin: base }
      const wrong = await ctx.request.post(endpoint, { headers, data: { orderNumber: autoOrder.order.orderNumber, email: 'wrong@example.invalid' } })
      const missing = await ctx.request.post(endpoint, { headers, data: { orderNumber: 'SA-NOT-A-REAL-ORDER', email: 'buyer@example.invalid' } })
      assert.equal(wrong.status(), 404); assert.equal(missing.status(), 404)
      assert.deepEqual(await wrong.json(), await missing.json())
      assert.equal((await ctx.request.post(endpoint, { headers: { origin: 'https://foreign.example.invalid' }, data: {} })).status(), 403)
      const found = await ctx.request.post(endpoint, { headers, data: { orderNumber: autoOrder.order.orderNumber, email: 'BUYER@example.invalid' } })
      assert.equal(found.status(), 200)
      const body = await found.json()
      assert.deepEqual(Object.keys(body.data).sort(), ['orderNumber','status','total','createdAt','paidAt','items'].sort())
      assert.equal(body.data.status, 'completed'); assert.equal(body.data.items[0].name, auto.name)
      assert.ok(!found.headers()['set-cookie']); assert.match(found.headers()['cache-control'], /no-store/)
      assert.equal((await ctx.request.get(base + '/api/orders?orderNumber=' + autoOrder.order.orderNumber)).status(), 403)
      await page.goto(base + '/track'); await dismissCookies(page)
      await page.locator('#track-number').fill(autoOrder.order.orderNumber)
      await page.locator('#track-email').fill('buyer@example.invalid')
      await page.getByRole('button', { name: 'ค้นหาออเดอร์', exact: true }).click()
      await page.getByText('จัดส่งครบแล้ว', { exact: true }).waitFor()
      assert.equal(await page.getByRole('link', { name: 'เปิดข้อมูลสินค้าที่ได้รับ' }).count(), 0)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      assert.equal(smtp.messages.length, mailBefore); assert.equal(await db.orderAccessSession.count(), grantsBefore)
      await page.screenshot({ path: '.cache/storefront-e2e/track-summary-mobile.png', fullPage: true })
      await ctx.close()
    })
    await test('coupon checkout and authenticated maintenance release expired holds exactly once', async () => {
      const fixture = await checkout(auto.id, 'E2E10')
      assert.equal(Number(fixture.order.total), 9.22)
      const stockBefore = (await db.product.findUniqueOrThrow({ where: { id: auto.id } })).stock
      assert.equal((await db.discountCode.findUniqueOrThrow({ where: { code: 'E2E10' } })).usedCount, 1)
      await db.order.update({ where: { id: fixture.order.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
      assert.equal((await fixture.ctx.request.get(base + '/api/cron/clear-unpaid')).status(), 401)
      const invoke = () => fixture.ctx.request.get(base + '/api/cron/clear-unpaid', { headers: { authorization: 'Bearer ' + env.CRON_SECRET } })
      assert.equal((await invoke()).status(), 200); assert.equal((await invoke()).status(), 200)
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: fixture.order.id } })).status, 'cancelled')
      assert.equal((await db.product.findUniqueOrThrow({ where: { id: auto.id } })).stock, stockBefore + 1)
      assert.equal((await db.discountCode.findUniqueOrThrow({ where: { code: 'E2E10' } })).usedCount, 0)
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: autoOrder.order.id } })).status, 'completed')
      await fixture.ctx.close()
    })
    await test('100 percent coupon completes a browser purchase without any provider', async () => {
      const fixture = await checkout(auto.id, 'E2EFREE')
      assert.equal(Number(fixture.order.total), 0); assert.equal(fixture.order.status, 'completed')
      await fixture.page.waitForURL('**/thank-you')
      const item = await db.deliveryItem.findFirstOrThrow({ where: { orderId: fixture.order.id } })
      await expect(fixture.page.locator('input[readonly]')).toHaveValue(decryptText(item.licenseKey!))
      await fixture.ctx.close()
    })
    await test('mobile account delivery masks password and downloads only visible instructions', async () => {
      const fixture = await checkout(account.id, undefined, { width: 390, height: 844 })
      await mockPayment(fixture.order.id, 30)
      await fixture.page.goto(base + '/thank-you')
      await expect(fixture.page.locator('input[type="password"]')).toHaveValue('MOCK-PASSWORD-ONLY')
      await fixture.page.getByRole('button', { name: 'Show password', exact: true }).click()
      await expect(fixture.page.locator('input[readonly]').nth(0)).toHaveValue('mock-account@example.invalid')
      await expect(fixture.page.locator('input[readonly]').nth(1)).toHaveValue('MOCK-PASSWORD-ONLY')
      await fixture.page.getByRole('button', { name: 'Hide password', exact: true }).click()
      assert.equal(await fixture.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      const [download] = await Promise.all([fixture.page.waitForEvent('download'), fixture.page.getByRole('button', { name: 'ดาวน์โหลดคีย์ (.TXT)', exact: true }).click()])
      const stream = await download.createReadStream(), chunks: Buffer[] = []
      assert.ok(stream)
      for await (const chunk of stream) chunks.push(Buffer.from(chunk))
      const content = Buffer.concat(chunks).toString('utf8')
      assert.ok(content.includes('MOCK-PASSWORD-ONLY')); assert.ok(!content.includes('HIDDEN-E2E-INSTRUCTION'))
      await fixture.page.screenshot({ path: '.cache/storefront-e2e/account-delivery-mobile.png', fullPage: true })
      await fixture.ctx.close()
    })
    await admin.close()
    report.passed = true
  } finally {
    await browser?.close()
    if (server && server.exitCode === null) {
      server.kill('SIGTERM')
      await new Promise<void>(resolve => { if (server!.exitCode !== null) return resolve(); server!.once('exit', () => resolve()); setTimeout(resolve, 10000) })
    }
    for (const id of ownedUsers) await client.users.deleteUser(id)
    report.syntheticUsersRemoved = true
    report.localSmtpMessages = smtp.messages.length
    await db.$disconnect(); await smtp.close(); await sandbox.close()
    report.fixtureDatabaseClosed = true
    writeFileSync('docs/launch-storefront-e2e-latest.json', JSON.stringify(report, null, 2) + '\n')
    if (!report.passed) console.error('E2E failed at: ' + lastStage)
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message.replace(/(sk_test_|pk_test_)[^\s]+/g, '[private]') : 'E2E test failed'); process.exitCode = 1 })
