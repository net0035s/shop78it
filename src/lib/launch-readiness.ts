import { deploymentKind } from './hosting'
import { createHash } from 'node:crypto'
import { getEncryptionKeyProblem } from './encryption'
import { CommerceError } from './commerce-rules'
import { siteUrl } from './site-url'

type Environment = Record<string, string | undefined>
export type ReadinessCheck = { id: string; label: string; status: 'pass' | 'blocked' | 'pending'; detail: string }

export function databaseFingerprint(value?: string): string {
  if (!value) return ''
  try {
    const url = new URL(value)
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) return ''
    const host = url.hostname.toLowerCase()
    const direct = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/)
    const pooled = host.endsWith('.pooler.supabase.com') ? decodeURIComponent(url.username).match(/\.([a-z0-9]+)$/) : null
    const identity = (direct || pooled) ? 'supabase:' + (direct || pooled)![1] + url.pathname : host + url.pathname
    return createHash('sha256').update(identity).digest('hex')
  } catch { return '' }
}

export function previewIsIsolated(env: Environment): boolean {
  const expected = env.SANDBOX_DATABASE_FINGERPRINT
  const production = env.PRODUCTION_DATABASE_FINGERPRINT
  return env.APP_MODE === 'sandbox' && !!expected && /^[a-f0-9]{64}$/.test(expected) &&
    !!production && /^[a-f0-9]{64}$/.test(production) && expected !== production &&
    databaseFingerprint(env.DATABASE_URL) === expected && databaseFingerprint(env.DIRECT_URL) === expected
}

export function assertSafeDatabaseWrite(env: Environment = process.env) {
  if (deploymentKind(env) === 'preview' && !previewIsIsolated(env)) throw new CommerceError('เว็บทดสอบยังไม่พร้อมรับคำสั่งซื้อ', 503)
  if (deploymentKind(env) === 'production' && env.APP_MODE === 'sandbox') throw new CommerceError('ร้านยังไม่พร้อมรับคำสั่งซื้อ', 503)
  if (env.APP_MODE === 'sandbox' && deploymentKind(env) !== 'preview') {
    const loopback = (value?: string) => { try { const url = new URL(value || ''); return ['postgres:', 'postgresql:'].includes(url.protocol) && ['localhost','127.0.0.1'].includes(url.hostname) } catch { return false } }
    if (!(loopback(env.DATABASE_URL) && loopback(env.DIRECT_URL)) && !previewIsIsolated(env)) throw new CommerceError('ตัวจำลองต้องใช้ฐานข้อมูลทดสอบที่แยกจากข้อมูลร้าน', 503)
  }
}

export function assertOrderingReady(env: Environment = process.env) {
  assertSafeDatabaseWrite(env)
  if (env.ORDERS_ENABLED !== 'true') throw new CommerceError('ร้านกำลังเตรียมระบบ ยังไม่เปิดรับคำสั่งซื้อ', 503)
  if (env.APP_MODE !== 'sandbox' && env.LAUNCH_APPROVED !== 'true') throw new CommerceError('ร้านยังไม่เปิดรับคำสั่งซื้อ', 503)
}

export function httpsUrl(value?: string): boolean {
  try { const url = new URL(value || ''); return url.protocol === 'https:' && !url.username && !url.password && !!url.hostname } catch { return false }
}

export function configurationChecks(env: Environment = process.env): ReadinessCheck[] {
  const checks: ReadinessCheck[] = []
  const check = (id: string, label: string, ok: boolean, detail: string) => checks.push({ id, label, status: ok ? 'pass' : 'blocked', detail: ok ? 'ตั้งค่าแล้ว ต้องตรวจผลใช้งานตามแผนเปิดร้าน' : detail })
  check('database', 'การตั้งค่าฐานข้อมูล', !!databaseFingerprint(env.DATABASE_URL) && !!databaseFingerprint(env.DIRECT_URL), 'ยังตั้งค่าฐานข้อมูลไม่ครบ')
  check('encryption', 'กุญแจเข้ารหัส', !getEncryptionKeyProblem(env.ENCRYPTION_KEY) && !env.OLD_ENCRYPTION_KEY, 'ตรวจแผนกุญแจและข้อมูลเดิมก่อนเปลี่ยนค่า ห้ามเปลี่ยนเพื่อให้การตรวจผ่านเฉย ๆ')
  check('site', 'ลิงก์ร้านและลิงก์รับสินค้า', httpsUrl(siteUrl(env)), 'ตั้ง URL ร้านให้เป็น HTTPS ของสภาพแวดล้อมนี้')
  const clerkKind = env.APP_MODE === 'sandbox' ? 'test' : 'live'
  check('clerk', 'ระบบเข้าสู่ระบบ', !!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_' + clerkKind + '_') && !!env.CLERK_SECRET_KEY?.startsWith('sk_' + clerkKind + '_') && !!env.ADMIN_EMAILS?.trim(), 'ใช้ Clerk ' + clerkKind + ' และระบุแอดมินที่ยืนยันอีเมลแล้ว')
  check('email', 'อีเมลรับสินค้าและยืนยันออเดอร์', !!env.EMAIL_USER && !!env.EMAIL_PASS, 'ตั้งค่าบัญชีส่งอีเมลและทดสอบการรับข้อความ')
  check('support', 'ช่องทางติดต่อร้าน', httpsUrl(env.NEXT_PUBLIC_LINE_URL) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.NEXT_PUBLIC_SUPPORT_EMAIL || ''), 'ตั้ง LINE หรืออีเมลช่วยเหลือที่ลูกค้าติดต่อได้จริง')
  check('cron', 'กุญแจงานอัตโนมัติ', !!env.CRON_SECRET && env.CRON_SECRET.length >= 32, 'ตั้งกุญแจสุ่มอย่างน้อย 32 ตัวอักษรให้ตรงกับตัวเรียกงาน')
  const stripeKey = env.APP_MODE === 'sandbox' ? /^[rs]k_test_[A-Za-z0-9]+$/ : /^[rs]k_live_[A-Za-z0-9]+$/
  const stripeConfigured = env.STRIPE_ENABLED === 'true' && stripeKey.test(env.STRIPE_SECRET_KEY || '') && !!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')
  check('provider', 'ช่องทางรับเงิน', !!env.TMN_RECEIVE_PHONE || stripeConfigured, 'ตั้งค่า TrueMoney หรือ Stripe และตรวจผลกับผู้ให้บริการก่อนเปิด')
  if (env.STRIPE_ENABLED === 'true') check('stripe', 'Stripe และ webhook', stripeConfigured, 'ตั้ง server key ตรงโหมด และ webhook signing secret ของ endpoint นี้')
  if (deploymentKind(env) === 'preview') check('isolation', 'แยกเว็บทดสอบจากข้อมูลจริง', previewIsIsolated(env), 'ต้องใช้ฐานข้อมูลทดสอบแยก พร้อม fingerprint ของฐานทดสอบและฐานจริง')
  for (const [id, label, variable] of [
    ['backup', 'สำรองและทดลองกู้คืนข้อมูล', 'BACKUP_RESTORE_VERIFIED'],
    ['migration', 'ซ้อมย้ายข้อมูลและตรวจการถอดรหัส', 'MIGRATION_REHEARSAL_VERIFIED'],
    ['providerTest', 'ทดสอบผู้ให้บริการใน sandbox', 'PROVIDER_SANDBOX_VERIFIED'],
    ['adminTest', 'ทดสอบสิทธิ์แอดมินกับ Clerk', 'CLERK_ADMIN_VERIFIED'],
    ['workerTest', 'ทดสอบงานอัตโนมัติและส่งข้อความ', 'MAINTENANCE_VERIFIED'],
    ['hosting', 'โฮสต์รองรับการขายจริง', 'HOSTING_COMMERCIAL_CONFIRMED'],
  ]) checks.push({ id, label, status: env[variable] === 'true' ? 'pass' : 'pending', detail: env[variable] === 'true' ? 'ผู้ดูแลบันทึกว่าตรวจแล้ว ให้เก็บหลักฐานตามแผนเปิดร้าน' : 'ยังไม่มีผลตรวจยืนยัน ห้ามตั้งผ่านก่อนทำจริง' })
  checks.push({ id: 'approval', label: 'อนุมัติเปิดร้าน', status: env.LAUNCH_APPROVED === 'true' ? 'pass' : 'pending', detail: 'เปิดหลังตรวจหลักฐานทุกขั้นตอนแล้วเท่านั้น' })
  return checks
}
