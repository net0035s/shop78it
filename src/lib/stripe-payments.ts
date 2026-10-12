import Stripe from 'stripe'
import { randomUUID, createHash } from 'node:crypto'
import prisma from './db'
import { CommerceError, cents, expiry } from './commerce-rules'
import { assertStripeReady, stripeSiteUrl } from './stripe-config'
import { startPayment, recordPayment, rejectPayment, reviewPayment } from './payments'
import { fulfillPaidOrder } from './order-fulfillment'
import { transaction } from './transactions'
import { cancelPendingOrder } from './inventory'

export type StripeGateway = Pick<Stripe['checkout']['sessions'], 'create' | 'retrieve' | 'expire'> & { retrievePaymentIntent: Stripe['paymentIntents']['retrieve'] }
export function stripeClient() {
  assertStripeReady(false)
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 10000, maxNetworkRetries: 1 })
}
export function stripeGateway(client = stripeClient()): StripeGateway {
  return { create: (...args) => client.checkout.sessions.create(...args), retrieve: (...args) => client.checkout.sessions.retrieve(...args),
    expire: (...args) => client.checkout.sessions.expire(...args), retrievePaymentIntent: (...args) => client.paymentIntents.retrieve(...args) }
}
const binding = (requestKey: string) => createHash('sha256').update(requestKey).digest('hex')
function sessionId(reference: string | null) { return reference?.startsWith('stripe:cs_') ? reference.slice(7) : null }

async function releaseUnpaid(attemptId: string) {
  await transaction(async tx => {
    const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { order: true } })
    const changed = await tx.paymentAttempt.updateMany({ where: { id: attemptId, status: { in: ['started', 'review'] } }, data: { status: 'failed', note: 'Stripe confirmed unpaid and closed' } })
    if (!changed.count) return
    await tx.order.updateMany({ where: { id: attempt.orderId, status: { in: ['payment_processing', 'payment_review'] } }, data: { status: 'pending' } })
    if (expiry(attempt.order).getTime() <= Date.now()) await cancelPendingOrder(tx, attempt.orderId, 'stripe-expiry')
  })
}
async function applySession(attemptId: string, session: Stripe.Checkout.Session, gateway: StripeGateway, asyncFailed = false) {
  const mode = assertStripeReady(false)
  const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })
  if (attempt.method !== 'stripe' || session.mode !== 'payment' || session.livemode !== (mode === 'live') ||
      session.client_reference_id !== attempt.orderId || session.metadata?.paymentAttemptId !== attempt.id ||
      session.metadata?.binding !== binding(attempt.requestKey) || session.currency !== 'thb' ||
      session.amount_total !== cents(attempt.expectedAmount) ||
      !/^cs_(test_|live_)[A-Za-z0-9]+$/.test(session.id) || (attempt.reference && attempt.reference !== 'stripe:' + session.id)) {
    await reviewPayment(attempt.id, 'Stripe session identity, mode, currency or amount mismatch')
    throw new CommerceError('ผล Stripe ไม่ตรงกับออเดอร์ ต้องให้ร้านตรวจสอบ', 409)
  }
  // A reference remains the unique Checkout Session throughout the attempt, including after payment.
  await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, reference: null }, data: { reference: 'stripe:' + session.id } })
  if (session.payment_status === 'paid') {
    if (session.status !== 'complete') throw new CommerceError('Stripe ยังยืนยันรายการไม่ครบ', 409)
    const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
    const intent = intentId ? await gateway.retrievePaymentIntent(intentId) : null
    if (!intent || intent.status !== 'succeeded' || intent.livemode !== (mode === 'live') || intent.currency !== 'thb' ||
        intent.amount_received !== cents(attempt.expectedAmount) || intent.metadata.binding !== binding(attempt.requestKey)) {
      await reviewPayment(attempt.id, 'Stripe payment intent does not confirm the expected received amount')
      throw new CommerceError('ยอดรับจาก Stripe ยังยืนยันไม่ครบ กรุณารอร้านตรวจสอบ', 409)
    }
    await recordPayment(attempt.id, 'stripe:' + session.id, session.amount_total! / 100)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: attempt.orderId } })
    if (order.status === 'paid') await fulfillPaidOrder(order.id)
    return
  }
  if (session.payment_status === 'unpaid' && (session.status === 'expired' || (asyncFailed && session.status === 'complete'))) {
    const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
    if (intentId) {
      const intent = await gateway.retrievePaymentIntent(intentId)
      // An asynchronous payment may still be processing after the browser/Checkout closes.
      if (intent.status !== 'canceled') { await reviewPayment(attempt.id, 'Stripe intent is not canceled; keep reservation until payment outcome is certain'); return }
    }
    await releaseUnpaid(attempt.id)
  }
}
function params(attempt: { id: string; requestKey: string; expectedAmount: unknown }, order: { id: string; orderNumber: string; createdAt: Date; expiresAt: Date | null }) : Stripe.Checkout.SessionCreateParams {
  const base = stripeSiteUrl(), number = encodeURIComponent(order.orderNumber)
  return {
    mode: 'payment', locale: 'th', allowed_payment_method_types: ['card', 'promptpay'], adaptive_pricing: { enabled: false },
    client_reference_id: order.id, metadata: { paymentAttemptId: attempt.id, binding: binding(attempt.requestKey) },
    payment_intent_data: { metadata: { binding: binding(attempt.requestKey) } },
    line_items: [{ quantity: 1, price_data: { currency: 'thb', unit_amount: cents(attempt.expectedAmount), product_data: { name: 'Shop78it ออเดอร์ ' + order.orderNumber } } }],
    expires_at: Math.floor(expiry(order).getTime() / 1000),
    success_url: `${base}/checkout?order=${number}&stripe_return=1`, cancel_url: `${base}/checkout?order=${number}&stripe_cancel=1`,
  }
}
async function getSession(attemptId: string, gateway: StripeGateway) {
  const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { order: true } })
  const id = sessionId(attempt.reference)
  let session: Stripe.Checkout.Session
  try {
    // Repeating a timed-out creation uses the same stored attempt, exact parameters and idempotency key.
    session = id ? await gateway.retrieve(id) : await gateway.create(params(attempt, attempt.order), { idempotencyKey: 'shop78it:' + attempt.id })
  } catch (error) {
    const definiteCreationFailure = !id && error instanceof Stripe.errors.StripeError &&
      ['StripeInvalidRequestError', 'StripeAuthenticationError', 'StripePermissionError'].includes(error.type)
    if (definiteCreationFailure && attempt.status === 'started') await rejectPayment(attempt.id, 'Stripe refused checkout creation')
    else await reviewPayment(attempt.id, 'Stripe result unavailable; retry identical session before releasing stock')
    throw new CommerceError('ตรวจผล Stripe ไม่สำเร็จ กรุณาตรวจสถานะก่อนชำระซ้ำ', 503)
  }
  await applySession(attempt.id, session, gateway)
  return session
}
export async function createStripeCheckout(orderId: string, gateway: StripeGateway = stripeGateway()) {
  assertStripeReady()
  const active = await prisma.paymentAttempt.findFirst({ where: { orderId, method: 'stripe', status: { in: ['started', 'review'] } }, orderBy: { createdAt: 'desc' } })
  let attemptId = active?.id
  if (!attemptId) {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    // THB settlement minimum and Checkout's 30-minute minimum expiry. Never extend an existing bill silently.
    if (cents(order.total) < 1000) throw new CommerceError('Stripe ต้องมียอดอย่างน้อย 10 บาท กรุณาเลือกซองทรูมันนี่', 400)
    if (expiry(order).getTime() < Date.now() + 31 * 60000) throw new CommerceError('เวลาบิลเหลือน้อยเกินไปสำหรับ Stripe กรุณาสร้างออเดอร์ใหม่หรือใช้ซองทรูมันนี่', 409)
    attemptId = (await startPayment(orderId, 'stripe', 'stripe:' + randomUUID())).attempt.id
  }
  const session = await getSession(attemptId, gateway)
  if (session.status !== 'open') return { url: null }
  const url = new URL(session.url || '')
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.username || url.password) throw new CommerceError('Stripe ส่งลิงก์ชำระไม่ถูกต้อง', 503)
  return { url: url.toString() }
}
export async function reconcileStripeOrder(orderId: string, gateway: StripeGateway = stripeGateway()) {
  assertStripeReady(false)
  const attempt = await prisma.paymentAttempt.findFirst({ where: { orderId, method: 'stripe', status: { in: ['started', 'review'] } }, orderBy: { createdAt: 'desc' } })
  if (attempt) await getSession(attempt.id, gateway)
}
export async function handleStripeEvent(event: Stripe.Event, gateway: StripeGateway = stripeGateway()) {
  const mode = assertStripeReady(false)
  if (event.livemode !== (mode === 'live')) throw new CommerceError('Webhook ใช้โหมดไม่ตรงกับระบบ', 400)
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired', 'checkout.session.async_payment_failed'].includes(event.type)) return
  const object = event.data.object as Stripe.Checkout.Session
  const attempt = await prisma.paymentAttempt.findUnique({ where: { id: object.metadata?.paymentAttemptId || '' } })
  // Ignore other applications' sessions on the same Stripe account, without exposing or modifying an order.
  if (!attempt || attempt.method !== 'stripe') return
  const session = await gateway.retrieve(object.id)
  await applySession(attempt.id, session, gateway, event.type === 'checkout.session.async_payment_failed')
}
export async function reconcileStripeQueue() {
  const attempts = await prisma.paymentAttempt.findMany({ where: { method: 'stripe', status: { in: ['started', 'review'] } }, orderBy: { updatedAt: 'asc' }, take: 3 })
  for (const attempt of attempts) {
    try { await reconcileStripeOrder(attempt.orderId) } catch { console.error('Stripe attempt kept locked for reconciliation') }
  }
}
export async function cancelStripeCheckout(orderId: string, gateway: StripeGateway = stripeGateway()) {
  assertStripeReady(false)
  const attempt = await prisma.paymentAttempt.findFirst({ where: { orderId, method: 'stripe', status: { in: ['started', 'review'] } }, orderBy: { createdAt: 'desc' } })
  if (!attempt) return
  let session = await getSession(attempt.id, gateway)
  if (session.status === 'open') {
    try { session = await gateway.expire(session.id) }
    catch { session = await gateway.retrieve(session.id) }
    await applySession(attempt.id, session, gateway)
    if (session.status === 'open') throw new CommerceError('Stripe ยังไม่ยืนยันการปิดหน้าชำระ กรุณารอก่อนเปลี่ยนช่องทาง', 503)
  }
}
