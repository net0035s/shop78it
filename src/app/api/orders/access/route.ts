import prisma from '@/lib/db'
import { createOrderSession, newToken, setOrderCookie, tokenHash } from '@/lib/order-access'
import { transaction } from '@/lib/transactions'
import { emailField, textField, CommerceError } from '@/lib/commerce-rules'
import { sameOrigin, limitRequests, readJson, apiError } from '@/lib/server-guards'
import { assertEncryptionReady } from '@/lib/encryption'
import { queueNotification, tryNotifications } from '@/lib/notifications'
import { jsonUtf8 } from '@/lib/json-response'
import { siteUrl } from '@/lib/site-url'
export async function POST(request: Request) {
  try {
    sameOrigin(request); assertEncryptionReady(); await limitRequests(request, 'order-access', 5, 15*60000)
    const body = await readJson(request)
    if (body.token) {
      const hash = tokenHash(textField(body.token, 'ลิงก์ยืนยัน', 100))
      const grant = await transaction(async tx=>{
        const challenge = await tx.orderAccessChallenge.findUnique({ where: { tokenHash: hash }, include: { order: true } })
        if (!challenge || challenge.usedAt || challenge.expiresAt.getTime()<=Date.now()) throw new CommerceError('ลิงก์หมดอายุหรือใช้งานแล้ว กรุณาขอใหม่', 403)
        const claimed = await tx.orderAccessChallenge.updateMany({ where: { id: challenge.id, usedAt: null }, data: { usedAt: new Date() } })
        if (!claimed.count) throw new CommerceError('ลิงก์ถูกใช้แล้ว', 403)
        return { number: challenge.order.orderNumber, token: await createOrderSession(tx, challenge.orderId) }
      })
      return setOrderCookie(jsonUtf8({ success: true, data: { orderNumber: grant.number } }), grant.number, grant.token)
    }
    const orderNumber = textField(body.orderNumber, 'ออเดอร์', 100).toUpperCase(), email = emailField(body.email)
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) throw new CommerceError(process.env.APP_MODE === 'sandbox'
      ? 'เว็บทดสอบปิดการส่งอีเมลอยู่ ดูสถานะได้ด้วยเลขออเดอร์และอีเมล หรือเปิดข้อมูลจัดส่งจากเครื่องที่ซื้อ'
      : 'ร้านค้ายังไม่พร้อมส่งอีเมลยืนยัน กรุณาติดต่อร้านเพื่อรับข้อมูลจัดส่ง', 503)
    const order = await prisma.order.findFirst({ where: { orderNumber, customerEmail: { equals: email, mode: 'insensitive' } } })
    if (order) {
      const token = newToken()
      const site = siteUrl()
      if (!site) throw new CommerceError('ร้านค้ายังตั้งค่าลิงก์ยืนยันไม่ครบ', 503)
      const url = new URL('/track', site); url.hash = `access=${token}`
      await transaction(async tx=>{
        const challenge = await tx.orderAccessChallenge.create({ data: { orderId: order.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now()+15*60000) } })
        await queueNotification(tx, order.id, 'access', `access:${challenge.id}`, { url: url.toString() })
      })
      await tryNotifications(order.id)
    }
    return jsonUtf8({ success: true, message: 'หากเลขออเดอร์และอีเมลตรงกัน ระบบจะส่งลิงก์ยืนยันให้ กรุณาตรวจกล่องอีเมลและสแปม' }, { status: 202 })
  } catch (error) { return apiError(error) }
}
