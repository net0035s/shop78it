import { createHash } from 'node:crypto'
import prisma from './db'
import { assertSafeDatabaseWrite } from './launch-readiness'
import { CommerceError } from './commerce-rules'
import { jsonUtf8 } from './json-response'
import { siteUrl } from './site-url'
import { clientAddress } from './hosting'

export async function readJson(request: Request, maxBytes = 32768) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new CommerceError('ต้องส่งข้อมูล JSON', 415)
  const reader = request.body?.getReader()
  if (!reader) throw new CommerceError('ไม่พบข้อมูล')
  const chunks: Uint8Array[] = []; let size = 0
  while (true) {
    const { value, done } = await reader.read(); if (done) break
    size += value.length
    if (size > maxBytes) { await reader.cancel(); throw new CommerceError('ข้อมูลมีขนาดใหญ่เกินไป', 413) }
    chunks.push(value)
  }
  try {
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected object')
    return body
  } catch { throw new CommerceError('ข้อมูล JSON ไม่ถูกต้อง') }
}
export function sameOrigin(request: Request) {
  assertSafeDatabaseWrite()
  const origin = request.headers.get('origin')
  const expected = new URL(request.url).origin
  const configured = siteUrl()
  if (!origin || (origin !== expected && (!configured || origin !== new URL(configured).origin))) throw new CommerceError('คำขอไม่ได้มาจากเว็บไซต์ร้านค้า', 403)
}
export async function limitRequests(request: Request, scope: string, limit = 30, windowMs = 60000) {
  assertSafeDatabaseWrite()
  // Trust only the deployment proxy's normalized address, never arbitrary client headers locally.
  const client = clientAddress(request)
  const key = createHash('sha256').update(`${scope}:${client}:${Math.floor(Date.now()/windowMs)}`).digest('hex')
  const bucket = await prisma.rateLimitBucket.upsert({ where: { key }, create: { key, count: 1, expiresAt: new Date(Date.now()+windowMs*2) }, update: { count: { increment: 1 } } })
  if (bucket.count > limit) throw new CommerceError('ทำรายการถี่เกินไป กรุณารอสักครู่', 429)
}
export function apiError(error: unknown) {
  if (error instanceof CommerceError) return jsonUtf8({ success: false, error: error.message, code: error.code }, { status: error.status })
  console.error('Request failed:', error instanceof Error ? error.name : 'unknown')
  return jsonUtf8({ success: false, error: 'ระบบไม่พร้อมให้บริการ กรุณาลองใหม่หรือติดต่อร้านค้า' }, { status: 503 })
}
