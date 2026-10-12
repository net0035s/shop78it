export const ORDER_TTL_MS = 60 * 60 * 1000
export const PAID_STATUSES = ['paid', 'completed', 'needs_manual_delivery']
export class CommerceError extends Error {
  constructor(message: string, public status = 400, public code = 'INVALID_REQUEST') { super(message) }
}
export function cents(value: unknown): number {
  if (value === null || value === undefined || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) throw new CommerceError('ยอดเงินไม่ถูกต้อง')
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 9999999999) throw new CommerceError('ยอดเงินไม่ถูกต้อง')
  return Math.round(n * 100)
}
export function textField(value: unknown, label: string, max = 200, optional = false): string {
  if (optional && (value === undefined || value === null || value === '')) return ''
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new CommerceError(`${label}ไม่ถูกต้อง`)
  return value.trim()
}
export function emailField(value: unknown) {
  const email = textField(value, 'อีเมล', 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CommerceError('รูปแบบอีเมลไม่ถูกต้อง')
  return email
}
export function normalizeCart(input: unknown): { productId: string; quantity: number }[] {
  if (!Array.isArray(input) || !input.length || input.length > 50) throw new CommerceError('ตะกร้าต้องมีสินค้า 1–50 รายการ')
  const grouped = new Map<string, number>()
  for (const item of input) {
    const id = textField(item?.productId, 'รหัสสินค้า', 100)
    const qty = item?.quantity
    if (typeof qty !== 'number' || !Number.isSafeInteger(qty) || qty < 1 || qty > 100) throw new CommerceError('จำนวนสินค้าต้องเป็นจำนวนเต็ม 1–100')
    grouped.set(id, (grouped.get(id) || 0) + qty)
    if (grouped.get(id)! > 100) throw new CommerceError('จำนวนสินค้าต่อชนิดต้องไม่เกิน 100')
  }
  return Array.from(grouped, ([productId, quantity]) => ({ productId, quantity })).sort((a,b) => a.productId.localeCompare(b.productId))
}
export function expiry(order: { expiresAt?: Date | string | null; createdAt: Date | string }) {
  return order.expiresAt ? new Date(order.expiresAt) : new Date(new Date(order.createdAt).getTime() + ORDER_TTL_MS)
}
export function calculateDiscount(lines: { product: any; quantity: number }[], discount: any, categorySlug?: string) {
  const subtotal = lines.reduce((sum,l) => sum + cents(l.product.price) * l.quantity, 0)
  if (!discount) return { subtotal, discountAmount: 0, total: subtotal }
  if (!discount.isActive || (discount.expiresAt && new Date(discount.expiresAt).getTime() <= Date.now())) throw new CommerceError('คูปองไม่พร้อมใช้หรือหมดอายุแล้ว')
  if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) throw new CommerceError('สิทธิ์คูปองถูกใช้หรือจองครบแล้ว')
  if (subtotal < cents(discount.minPurchaseAmount)) throw new CommerceError('ยอดสั่งซื้อไม่ถึงขั้นต่ำของคูปอง')
  const eligible = lines.filter(({product:p}) => (!discount.applicableType || p.deliveryType === discount.applicableType) && (!discount.applicableCategoryId || p.categoryId === discount.applicableCategoryId || (categorySlug !== undefined && p.category === categorySlug)))
    .reduce((sum,l) => sum + cents(l.product.price) * l.quantity, 0)
  if (!eligible) throw new CommerceError('คูปองนี้ไม่ตรงกับสินค้าในตะกร้า')
  if (!['PERCENT','FIXED'].includes(discount.discountType)) throw new CommerceError('ชนิดคูปองไม่ถูกต้อง')
  const value = Number(discount.discountValue)
  if (!Number.isFinite(value) || value <= 0 || (discount.discountType === 'PERCENT' && value > 100)) throw new CommerceError('มูลค่าคูปองไม่ถูกต้อง')
  const amount = Math.min(eligible, discount.discountType === 'PERCENT' ? Math.round(eligible * value / 100) : cents(value))
  return { subtotal, discountAmount: amount, total: subtotal - amount }
}
export function bangkokDay(date = new Date()) {
  const local = new Date(date.getTime() + 7 * 3600000)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 7 * 3600000)
}
export function parseStockLine(type: string, line: string): Record<string, string> {
  if (type === 'license-key') return { licenseKey: textField(line, 'คีย์', 10000) }
  if (type === 'ai-credit') return { creditCode: textField(line, 'รหัสเครดิต', 10000) }
  if (type === 'login-link') return { loginUrl: httpUrl(line) }
  if (type !== 'login-info') throw new CommerceError('ประเภทสต็อกไม่ถูกต้อง')
  // JSON supports arbitrary characters; pipe format keeps colons in passwords/URLs intact.
  const data = line.startsWith('{') ? JSON.parse(line) : (() => {
    const parts = line.split('|')
    if (parts.length !== 3) throw new CommerceError('ใช้ email|password|https://url หรือ JSON หนึ่งบัญชีต่อบรรทัด')
    return { email: parts[0], password: parts[1], loginUrl: parts[2] }
  })()
  if (typeof data.password !== 'string' || !data.password.length || data.password.length > 2000) throw new CommerceError('รหัสผ่านไม่ถูกต้อง')
  return { email: emailField(data.email), password: data.password, loginUrl: httpUrl(data.loginUrl) }
}
export function httpUrl(input: unknown) {
  const text = textField(input, 'URL', 4000)
  try { const url = new URL(text); if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString() } catch {}
  throw new CommerceError('URL ต้องขึ้นต้นด้วย http หรือ https')
}
