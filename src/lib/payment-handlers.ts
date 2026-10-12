import generatePromptPayPayload from 'promptpay-qr'
import prisma from './db'
import { requireOrderAccess, tokenHash } from './order-access'
import { sameOrigin, readJson, limitRequests, apiError } from './server-guards'
import { assertPaymentsReady, startPayment, rejectPayment, reviewPayment, recordPayment } from './payments'
import { fulfillPaidOrder } from './order-fulfillment'
import { tryNotifications } from './notifications'
import { cents, CommerceError, expiry, textField } from './commerce-rules'
import { jsonUtf8 } from './json-response'

function reviewResult(orderNumber: string) {
  return jsonUtf8({ success: true, warning: true, message: 'กำลังตรวจสอบผลชำระเงิน กรุณาติดตามสถานะและอย่าชำระซ้ำ', data: { orderNumber, status: 'payment_review' } }, { status: 202 })
}
async function success(orderId: string) {
  const data = await fulfillPaidOrder(orderId)
  await tryNotifications(orderId)
  return jsonUtf8({ success: true, data })
}
export async function handleTrueMoney(request: Request) {
  let attemptId = '', number = ''
  try {
    sameOrigin(request); assertPaymentsReady(); await limitRequests(request, 'payment', 10)
    const body = await readJson(request)
    const access = await requireOrderAccess(request, textField(body.orderId, 'ออเดอร์', 100))
    number = access.orderNumber
    const input = textField(body.voucherLink, 'ซอง', 1000)
    let code = input
    if (input.startsWith('http')) {
      const url = new URL(input)
      if (url.protocol !== 'https:' || url.hostname !== 'gift.truemoney.com') throw new CommerceError('ลิงก์ซองไม่ถูกต้อง')
      code = url.searchParams.get('v') || ''
    }
    if (!/^[a-zA-Z0-9]{12,100}$/.test(code)) throw new CommerceError('รหัสซองไม่ถูกต้อง')
    const phone = process.env.TMN_RECEIVE_PHONE?.replace(/\D/g, '').replace(/^66/, '0')
    if (!phone || !/^0\d{9}$/.test(phone)) throw new CommerceError('ร้านค้ายังตั้งค่าการรับเงินไม่ครบ', 503)
    const { attempt, order } = await startPayment(access.id, 'truemoney', `truemoney:${tokenHash(code)}`)
    attemptId = attempt.id
    // Verify exact value before redeeming. Only single-recipient vouchers are supported.
    const verified = await fetch(`https://gift.truemoney.com/campaign/vouchers/${code}/verify`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
    const verify = await verified.json()
    const voucher = verify?.data?.voucher
    if (!verified.ok || verify?.status?.code !== 'SUCCESS' || !voucher) {
      await rejectPayment(attemptId, 'Voucher verification rejected'); attemptId = ''
      throw new CommerceError('ตรวจซองไม่ผ่าน กรุณาตรวจสอบลิงก์ซอง')
    }
    if (Number(voucher.member) !== 1 || cents(voucher.amount_baht) !== cents(order.total)) {
      await rejectPayment(attemptId, 'Voucher amount/member mismatch'); attemptId = ''
      throw new CommerceError(`กรุณาสร้างซองสำหรับ 1 คน ยอดตรง ${Number(order.total).toFixed(2)} บาท`)
    }
    const response = await fetch(`https://gift.truemoney.com/campaign/vouchers/${code}/redeem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile: phone, voucher_hash: code }), signal: AbortSignal.timeout(20000) })
    const result = await response.json()
    if (!response.ok || result?.status?.code !== 'SUCCESS') {
      if (['VOUCHER_NOT_FOUND','VOUCHER_EXPIRED','BAD_PARAM','CANNOT_GET_OWN_VOUCHER'].includes(result?.status?.code)) {
        await rejectPayment(attemptId, result.status.code); attemptId = ''
        throw new CommerceError('ซองไม่พร้อมใช้ กรุณาตรวจสอบซอง')
      }
      throw new Error('Unknown redemption result')
    }
    const amount = cents(result?.data?.my_ticket?.amount_baht)/100
    await recordPayment(attemptId, `truemoney:${tokenHash(code)}`, amount)
    return await success(access.id)
  } catch (error) {
    if (attemptId) { await reviewPayment(attemptId, 'Check provider ledger before retrying; payment or fulfillment result uncertain'); return reviewResult(number) }
    return apiError(error)
  }
}
export async function handleSlip(request: Request) {
  let attemptId = '', number = ''
  try {
    sameOrigin(request); assertPaymentsReady(); await limitRequests(request, 'payment', 10)
    if (!process.env.SLIPOK_BRANCH_ID || !process.env.SLIPOK_API_KEY) throw new CommerceError('ร้านค้ายังตั้งค่าตรวจสลิปไม่ครบ', 503)
    const length = Number(request.headers.get('content-length'))
    if (length > 6*1024*1024) throw new CommerceError('ไฟล์ต้องไม่เกิน 5 MB', 413)
    // Bound the actual body as well as Content-Length (which a client can omit).
    const reader = request.body?.getReader(); const chunks: Uint8Array[] = []; let bytes = 0
    if (!reader) throw new CommerceError('ไม่พบไฟล์สลิป')
    while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 6*1024*1024) { await reader.cancel(); throw new CommerceError('ไฟล์ต้องไม่เกิน 5 MB', 413) } chunks.push(value) }
    const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData()
    const access = await requireOrderAccess(request, textField(form.get('orderId'), 'ออเดอร์', 100)); number = access.orderNumber
    const file = form.get('files')
    if (!(file instanceof File) || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size === 0 || file.size > 5*1024*1024) throw new CommerceError('ใช้ภาพ JPG, PNG หรือ WEBP ขนาดไม่เกิน 5 MB')
    const buffer = Buffer.from(await file.arrayBuffer())
    const isImage = buffer.subarray(0,3).equals(Buffer.from([255,216,255])) || buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || (buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP')
    if (!isImage) throw new CommerceError('เนื้อหาไฟล์ไม่ใช่ภาพที่รองรับ')
    const { attempt, order } = await startPayment(access.id, 'slipok', `slip:${tokenHash(buffer.toString('base64'))}`); attemptId = attempt.id
    const body = new FormData(); body.append('files', file); body.append('log','true'); body.append('amount',Number(order.total).toFixed(2))
    const response = await fetch(`https://api.slipok.com/api/line/apikey/${encodeURIComponent(process.env.SLIPOK_BRANCH_ID)}`, { method: 'POST', headers: { 'x-authorization': process.env.SLIPOK_API_KEY }, body, signal: AbortSignal.timeout(25000) })
    const result = await response.json()
    if (!response.ok || result?.success !== true) {
      const code = Number(result?.code)
      // Duplicate slips and ambiguous gateway errors require reconciliation, not another payment.
      if ([1001,1002,1003,1004,1005,1006,1007,1008,1011,1014].includes(code)) {
        await rejectPayment(attemptId, `SlipOK rejected ${code}`); attemptId = ''
        throw new CommerceError(code === 1013 ? 'ยอดบนสลิปไม่ตรงกับออเดอร์' : code === 1014 ? 'บัญชีผู้รับไม่ตรงกับร้าน' : 'ตรวจสลิปไม่ผ่าน กรุณาตรวจสอบภาพหรือแจ้งร้านค้า')
      }
      throw new Error('SlipOK result uncertain')
    }
    const data = result.data, transferred = new Date(data?.transTimestamp)
    if (!Number.isFinite(transferred.getTime()) || transferred.getTime() < order.createdAt.getTime()-10*60000 || transferred.getTime()>Date.now()+60000 || transferred.getTime()>expiry(order).getTime()) throw new Error('Slip time requires review')
    if (!data?.transRef || !data?.sendingBank) throw new Error('Missing bank reference')
    await recordPayment(attemptId, `slipok:${data.sendingBank}:${data.transRef}`, cents(data.amount)/100)
    return await success(access.id)
  } catch (error) {
    if (attemptId) { await reviewPayment(attemptId, 'Check SlipOK/bank ledger before retrying; result requires reconciliation'); return reviewResult(number) }
    return apiError(error)
  }
}
export async function handlePromptPay(request: Request) {
  try {
    sameOrigin(request); assertPaymentsReady(); await limitRequests(request, 'qr', 20)
    const body = await readJson(request), access = await requireOrderAccess(request, textField(body.orderId, 'ออเดอร์', 100))
    const order = await prisma.order.findUniqueOrThrow({ where: { id: access.id } })
    if (order.status !== 'pending' || expiry(order).getTime()<=Date.now() || cents(order.total)<=0) throw new CommerceError('ออเดอร์นี้ไม่สามารถชำระเงินได้แล้ว', 409)
    const receiver = process.env.PROMPTPAY_NUMBER?.replace(/\D/g,'')
    if (!receiver || !/^(\d{10}|\d{13})$/.test(receiver)) throw new CommerceError('ร้านค้ายังตั้งค่า PromptPay ไม่ครบ', 503)
    return jsonUtf8({ success: true, data: { payload: generatePromptPayPayload(receiver, { amount: Number(order.total) }), amount: Number(order.total), orderNumber: order.orderNumber, expiresAt: expiry(order).toISOString() } })
  } catch (error) { return apiError(error) }
}
