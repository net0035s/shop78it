import { deploymentKind } from './hosting'
import { CommerceError } from './commerce-rules'
import { assertEncryptionReady } from './encryption'
import { assertOrderingReady, assertSafeDatabaseWrite, httpsUrl } from './launch-readiness'
import { siteUrl } from './site-url'

type Environment = Record<string, string | undefined>
export function stripeKeyMode(env: Environment = process.env): 'test' | 'live' | null {
  const key = env.STRIPE_SECRET_KEY || ''
  if (/^[rs]k_test_[A-Za-z0-9]+$/.test(key)) return 'test'
  if (/^[rs]k_live_[A-Za-z0-9]+$/.test(key)) return 'live'
  return null
}
export function stripeAvailable(env: Environment = process.env) {
  const mode = stripeKeyMode(env)
  return env.STRIPE_ENABLED === 'true' && ((mode === 'test' && env.APP_MODE === 'sandbox' && deploymentKind(env) !== 'production') ||
    (mode === 'live' && deploymentKind(env) !== 'preview' && env.APP_MODE === 'live' && env.PAYMENTS_ENABLED === 'true' && env.LAUNCH_APPROVED === 'true' && !!env.STRIPE_WEBHOOK_SECRET))
}
export function assertStripeReady(newPayment = true) {
  assertSafeDatabaseWrite()
  assertEncryptionReady()
  const mode = stripeKeyMode()
  if (!mode || (mode === 'test' ? process.env.APP_MODE !== 'sandbox' || deploymentKind() === 'production' : process.env.APP_MODE !== 'live' || deploymentKind() === 'preview')) {
    throw new CommerceError('Stripe ต้องใช้กุญแจตรงกับสภาพแวดล้อม และ sandbox ห้ามใช้กุญแจเงินจริง', 503)
  }
  if (newPayment) {
    assertOrderingReady()
    if (!stripeAvailable()) throw new CommerceError('Stripe ยังไม่พร้อมชำระเงิน กรุณาติดต่อร้านค้า', 503)
  }
  return mode
}
export function stripeSiteUrl() {
  const value = siteUrl()
  try {
    const url = new URL(value)
    const local = stripeKeyMode() === 'test' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:'
    if ((!httpsUrl(value) && !local) || url.username || url.password) throw new Error()
    return url.origin
  } catch { throw new CommerceError('ยังตั้งค่าลิงก์กลับจาก Stripe ไม่ถูกต้อง', 503) }
}
