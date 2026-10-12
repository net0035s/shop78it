import prisma from './db'
import { stripeAvailable, stripeKeyMode, assertStripeReady } from './stripe-config'
import { stripeClient, stripeGateway, createStripeCheckout, reconcileStripeOrder, cancelStripeCheckout, handleStripeEvent } from './stripe-payments'
import { sameOrigin, limitRequests, readJson, apiError } from './server-guards'
import { requireOrderAccess } from './order-access'
import { textField, CommerceError } from './commerce-rules'
import { orderInclude, orderSummary } from './order-summary'
import { jsonUtf8 } from './json-response'

export function stripePublicConfiguration() {
  return jsonUtf8({ success: true, data: { enabled: stripeAvailable(), testMode: stripeKeyMode() === 'test', methods: ['card', 'promptpay'] } })
}
export async function stripeOrderRequest(request: Request, action: 'checkout' | 'status' | 'cancel') {
  try {
    sameOrigin(request)
    await limitRequests(request, 'stripe-' + action, action === 'status' ? 30 : 10)
    const body = await readJson(request), access = await requireOrderAccess(request, textField(body.orderNumber, 'ออเดอร์', 100))
    let url: string | null = null
    if (action === 'checkout') url = (await createStripeCheckout(access.id)).url
    else if (action === 'cancel') await cancelStripeCheckout(access.id)
    else await reconcileStripeOrder(access.id)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: access.id }, include: orderInclude })
    return jsonUtf8({ success: true, data: { url, order: orderSummary(order) } })
  } catch (error) { return apiError(error) }
}
export async function stripeWebhook(request: Request) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret?.startsWith('whsec_')) throw new CommerceError('ยังไม่ตั้งค่า Stripe webhook', 503)
    assertStripeReady(false)
    const reader = request.body?.getReader(), chunks: Uint8Array[] = []
    let size = 0
    if (!reader) throw new CommerceError('ไม่มีข้อมูล webhook', 400)
    while (true) {
      const { value, done } = await reader.read(); if (done) break
      size += value.length
      if (size > 262144) { await reader.cancel(); throw new CommerceError('Webhook ใหญ่เกินไป', 413) }
      chunks.push(value)
    }
    const client = stripeClient()
    let event
    try { event = client.webhooks.constructEvent(Buffer.concat(chunks), request.headers.get('stripe-signature') || '', secret) }
    catch { throw new CommerceError('ลายเซ็น Stripe ไม่ถูกต้อง', 400) }
    await handleStripeEvent(event, stripeGateway(client))
    return jsonUtf8({ received: true })
  } catch (error) { return apiError(error) }
}
