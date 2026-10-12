import { randomBytes, createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import prisma from './db'
import { CommerceError } from './commerce-rules'

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
export const newToken = () => randomBytes(32).toString('base64url')
const cookieName = (number: string) => `oa_${tokenHash(number).slice(0,24)}`
export async function createOrderSession(tx: Prisma.TransactionClient, orderId: string) {
  const token = newToken()
  await tx.orderAccessSession.create({ data: { orderId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now()+30*86400000) } })
  return token
}
export function setOrderCookie(response: NextResponse, number: string, token: string) {
  response.cookies.set(cookieName(number), token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 30*86400 })
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
export async function requireOrderAccess(request: Request, number: string) {
  const order = await prisma.order.findFirst({ where: { OR: [{ orderNumber: number }, { id: number }] }, select: { id: true, orderNumber: true } })
  if (!order) throw new CommerceError('กรุณายืนยันสิทธิ์เข้าถึงออเดอร์', 403, 'ORDER_ACCESS_REQUIRED')
  const cookie = (request.headers.get('cookie') || '').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${cookieName(order.orderNumber)}=`))
  const token = cookie?.slice(cookie.indexOf('=')+1) || ''
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new CommerceError('กรุณายืนยันสิทธิ์ผ่านอีเมลที่ใช้สั่งซื้อ', 403, 'ORDER_ACCESS_REQUIRED')
  const grant = await prisma.orderAccessSession.findUnique({ where: { tokenHash: tokenHash(token) } })
  if (!grant || grant.orderId !== order.id || grant.expiresAt.getTime() <= Date.now()) throw new CommerceError('สิทธิ์หมดอายุ กรุณายืนยันผ่านอีเมลอีกครั้ง', 403, 'ORDER_ACCESS_REQUIRED')
  return order
}
