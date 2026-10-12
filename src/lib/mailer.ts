import { deploymentKind } from './hosting'
import nodemailer from 'nodemailer'

type EmailDeliveryItem = {
  productName?: string | null
  type?: string | null
  quantity?: number | null
  creditCode?: string | null
  creditAmount?: string | null
  platform?: string | null
  email?: string | null
  password?: string | null
  loginUrl?: string | null
  licenseKey?: string | null
  expiresAt?: string | null
  instructions?: string | null
  deliveredContent?: string | null
}

const LINE_OA_TEXT = process.env.NEXT_PUBLIC_LINE_URL || 'หน้าช่วยเหลือบนเว็บไซต์ร้าน'
function mailTransport(user: string, pass: string) {
  if (!process.env.SMTP_HOST) return nodemailer.createTransport({ service: 'gmail', auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 })
  const port = Number(process.env.SMTP_PORT || 587)
  const host = process.env.SMTP_HOST
  if (!/^[a-zA-Z0-9.-]+$/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SMTP configuration')
  // Next dev compiles NODE_ENV as development, so sandbox SMTP sinks also need this path.
  // Production and every non-loopback server continue to require encrypted transport.
  const localTest = deploymentKind() !== 'production' &&
    (process.env.NODE_ENV === 'test' || process.env.APP_MODE === 'sandbox') &&
    ['127.0.0.1', 'localhost'].includes(host)
  return nodemailer.createTransport({ host, port, secure: port === 465, requireTLS: !localTest && port !== 465, auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 })
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function nl2br(value: unknown): string {
  return escapeHtml(value).replace(/\n/g, '<br />')
}

function hasInstantDeliveryDetails(item: EmailDeliveryItem): boolean {
  return Boolean(
    item.licenseKey ||
    item.creditCode ||
    item.creditAmount ||
    item.platform ||
    item.email ||
    item.password ||
    item.loginUrl ||
    item.expiresAt ||
    item.instructions ||
    item.deliveredContent
  )
}

function isPendingManualItem(item: EmailDeliveryItem): boolean {
  return item.type === 'manual' && !hasInstantDeliveryDetails(item)
}

function isProcessedUpdateWithoutContent(item: EmailDeliveryItem, isUpdate: boolean): boolean {
  return isUpdate && item.type === 'manual' && !String(item.deliveredContent ?? '').trim()
}

function renderProductDetails(item: EmailDeliveryItem, isUpdate: boolean): string {
  const rows = [
    item.licenseKey && ['รายละเอียดสินค้า', item.licenseKey],
    item.creditCode && ['รหัสสินค้า/เครดิต', item.creditCode],
    item.creditAmount && ['จำนวนเครดิต', item.creditAmount],
    item.platform && ['แพลตฟอร์ม', item.platform],
    item.email && ['อีเมลสำหรับใช้งาน', item.email],
    item.password && ['รหัสผ่าน', item.password],
    item.loginUrl && ['ลิงก์เข้าสู่ระบบ', item.loginUrl],
    item.expiresAt && ['วันหมดอายุ/ระยะเวลา', item.expiresAt],
  ].filter(Boolean) as string[][]

  const deliveredContent = item.deliveredContent
    ? `<div style="margin-top:14px;padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">
        <div style="font-size:12px;color:#475569;font-weight:800;margin-bottom:7px;">${isUpdate ? 'เนื้อหาสินค้าที่แอดมินจัดส่ง' : 'ข้อมูลการจัดส่ง'}</div>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.8;color:#0f172a;word-break:break-word;">${nl2br(item.deliveredContent)}</div>
      </div>`
    : ''

  const detailRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:7px 0;color:#64748b;width:150px;font-size:13px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:7px 0;color:#0f172a;font-size:13px;font-weight:700;word-break:break-word;">${escapeHtml(value)}</td>
    </tr>
  `).join('')

  const instructions = item.instructions
    ? `<p style="margin:12px 0 0;color:#475569;font-size:13px;line-height:1.8;">${nl2br(item.instructions)}</p>`
    : ''

  return `
    ${detailRows ? `<table style="width:100%;border-collapse:collapse;margin-top:10px;">${detailRows}</table>` : ''}
    ${deliveredContent}
    ${instructions}
  `
}

function renderManualNotice(orderId: string): string {
  return `
    <div style="margin-top:14px;padding:14px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:13px;line-height:1.8;">
      สินค้าชิ้นนี้ต้องดำเนินการโดยแอดมิน โปรดติดต่อและส่งหมายเลขออเดอร์
      <strong style="color:#7c2d12;">${escapeHtml(orderId)}</strong>
      ไปที่ Line OA: <strong style="color:#7c2d12;">${escapeHtml(LINE_OA_TEXT)}</strong>
      เพื่อดำเนินการต่อ
    </div>
  `
}

function renderProcessedUpdateNotice(): string {
  return `
    <div style="margin-top:14px;padding:14px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-size:13px;line-height:1.8;">
      ขอบคุณสำหรับคำสั่งซื้อ ออเดอร์ของคุณได้รับการประมวลผลสำเร็จแล้ว
      หากต้องการสอบถามเพิ่มเติม สามารถติดต่อแอดมินพร้อมแจ้งหมายเลขออเดอร์ได้ทันที
    </div>
  `
}

function renderOrderItem(item: EmailDeliveryItem, index: number, orderId: string, isUpdate: boolean): string {
  const pendingManual = isPendingManualItem(item)
  const processedUpdateWithoutContent = isProcessedUpdateWithoutContent(item, isUpdate)
  const isSuccess = !pendingManual || processedUpdateWithoutContent
  const statusText = isSuccess ? 'จัดส่งเรียบร้อย' : 'รอดำเนินการโดยแอดมิน'
  const statusIcon = isSuccess ? '✅' : '⏳'
  const statusBg = isSuccess ? '#ecfdf5' : '#fff7ed'
  const statusColor = isSuccess ? '#047857' : '#9a3412'
  const statusBorder = isSuccess ? '#a7f3d0' : '#fed7aa'

  return `
    <div style="margin-top:14px;padding:16px;border-radius:16px;border:1px solid #e2e8f0;background:#ffffff;">
      <div style="display:block;">
        <div style="font-size:15px;font-weight:900;color:#0f172a;line-height:1.45;">
          ${index + 1}. ${escapeHtml(item.productName || 'สินค้า')}
        </div>
        <div style="margin-top:10px;display:inline-block;padding:6px 10px;border-radius:999px;background:${statusBg};border:1px solid ${statusBorder};color:${statusColor};font-size:12px;font-weight:800;">
          ${statusIcon} ${statusText}
        </div>
        <div style="font-size:12px;color:#64748b;margin-top:10px;">
          ${item.quantity ? `จำนวน: ${escapeHtml(item.quantity)}` : 'รายการสินค้า'}
        </div>
      </div>
      ${processedUpdateWithoutContent ? renderProcessedUpdateNotice() : pendingManual ? renderManualNotice(orderId) : renderProductDetails(item, isUpdate)}
    </div>
  `
}

function buildOrderReceiptHtml(orderId: string, orderItems: EmailDeliveryItem[], isUpdate: boolean): string {
  const items = orderItems.length > 0 ? orderItems : [{
    productName: 'รายการสั่งซื้อ',
    type: 'manual',
  }]

  const title = isUpdate ? 'อัปเดตสถานะ: ดำเนินการจัดส่งสำเร็จ' : 'ใบเสร็จรับเงิน / ยืนยันคำสั่งซื้อ'
  const intro = isUpdate
    ? 'ออเดอร์ของคุณได้รับการอัปเดตสถานะเรียบร้อยแล้ว รายละเอียดสินค้าอยู่ด้านล่างนี้'
    : 'ขอบคุณสำหรับคำสั่งซื้อ ระบบได้รับยอดชำระและบันทึกออเดอร์ของคุณเรียบร้อยแล้ว'

  const itemHtml = items.map((item, index) => renderOrderItem(item, index, orderId, isUpdate)).join('')

  return `
    <div style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,'Noto Sans Thai',sans-serif;color:#111827;">
      <div style="max-width:680px;margin:0 auto;padding:22px 12px;">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;">
          <div style="padding:22px 20px;background:#111827;color:#ffffff;">
            <div style="font-size:22px;font-weight:900;letter-spacing:0;">Shop78it</div>
            <div style="font-size:14px;color:#d1d5db;margin-top:6px;">${escapeHtml(title)}</div>
          </div>

          <div style="padding:22px 20px;">
            <div style="padding:18px;border-radius:16px;background:#eef2ff;border:1px solid #c7d2fe;text-align:center;margin-bottom:18px;">
              <div style="font-size:12px;color:#475569;font-weight:800;text-transform:uppercase;">หมายเลขออเดอร์</div>
              <div style="font-size:28px;line-height:1.2;color:#312e81;font-weight:900;margin-top:6px;word-break:break-word;">${escapeHtml(orderId)}</div>
            </div>

            <p style="margin:0;color:#374151;font-size:15px;line-height:1.8;">${escapeHtml(intro)}</p>

            <h2 style="font-size:17px;margin:24px 0 4px;color:#111827;">รายละเอียดสินค้าและข้อมูลการจัดส่ง</h2>
            ${itemHtml}

            <div style="margin-top:22px;padding:14px;border-radius:14px;background:#f9fafb;color:#4b5563;font-size:13px;line-height:1.8;border:1px solid #e5e7eb;">
              กรุณาเก็บอีเมลนี้ไว้เป็นหลักฐาน หากต้องติดต่อแอดมิน โปรดแจ้งหมายเลขออเดอร์ด้านบนทุกครั้ง
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

export async function sendOrderReceiptEmail(
  orderId: string,
  email: string,
  orderItems: EmailDeliveryItem[],
  isUpdate = false
): Promise<boolean> {
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS

  if (!user || !pass || !email) {
    console.warn('EMAIL_USER, EMAIL_PASS, or customer email is missing.')
    return false
  }

  const transporter = mailTransport(user, pass)

  const subject = isUpdate
    ? `อัปเดตสถานะ: ดำเนินการจัดส่งสำเร็จ - ${orderId}`
    : `ใบเสร็จรับเงิน / ยืนยันคำสั่งซื้อ - ${orderId}`

  try {
    await transporter.sendMail({
      from: `"Shop78it" <${user}>`,
      to: email,
      subject,
      html: buildOrderReceiptHtml(orderId, orderItems, isUpdate),
    })
    return true
  } catch (error) {
    console.error('Order receipt email failed:', error instanceof Error ? error.name : 'unknown')
    return false
  }
}

export async function sendOrderAccessEmail(email: string, orderNumber: string, url: string): Promise<boolean> {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return false
  try {
    const transport = mailTransport(process.env.EMAIL_USER, process.env.EMAIL_PASS)
    await transport.sendMail({ from: `"Shop78it" <${process.env.EMAIL_USER}>`, to: email, subject: `ยืนยันสิทธิ์ดูออเดอร์ ${orderNumber}`, html: `<p>ลิงก์นี้ใช้ได้ครั้งเดียวภายใน 15 นาที กรุณาอย่าส่งต่อ</p><p><a href="${escapeHtml(url)}">เปิดออเดอร์ ${escapeHtml(orderNumber)}</a></p><p>หากไม่ได้ขอลิงก์นี้ ไม่ต้องดำเนินการใด ๆ</p>` })
    return true
  } catch { return false }
}
