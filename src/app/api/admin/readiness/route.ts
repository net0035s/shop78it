import { deploymentKind } from '@/lib/hosting'
import { requireAdmin } from '@/lib/admin-auth'
import { configurationChecks, assertOrderingReady } from '@/lib/launch-readiness'
import { operationsSummary } from '@/lib/operations'
import { jsonUtf8 } from '@/lib/json-response'
import prisma from '@/lib/db'
import { DATA_API_SECURITY_SQL, assessDataApiSecurity, type DataApiTable } from '@/lib/data-api-security'

export const dynamic = 'force-dynamic'
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.response
  const checks = configurationChecks()
  let operations = null
  try {
    operations = await operationsSummary()
    checks.push({ id: 'schema', label: 'ฐานข้อมูลรองรับระบบร้านค้า', status: 'pass', detail: 'อ่านตารางหลักได้ ต้องผ่านการตรวจ schema และซ้อมย้ายข้อมูลเพิ่มเติม' })
  } catch {
    checks.push({ id: 'schema', label: 'ฐานข้อมูลรองรับระบบร้านค้า', status: 'blocked', detail: 'ตรวจการเชื่อมต่อและ migration ตามแผนก่อนเปิดร้าน' })
  }
  try {
    const result = assessDataApiSecurity(await prisma.$queryRawUnsafe<DataApiTable[]>(DATA_API_SECURITY_SQL))
    checks.push({ id:'dataApi', label:'สิทธิ์เข้าถึงฐานข้อมูลผ่าน Data API', status:result.safe ? 'pass' : 'blocked', detail:result.safe ? 'เปิด RLS และปิดสิทธิ์บทบาทสาธารณะบนตารางร้านแล้ว' : 'ต้องตรวจ RLS และถอนสิทธิ์เข้าถึงตารางร้านของบทบาทสาธารณะก่อนเปิด' })
  } catch {
    checks.push({id:'dataApi',label:'สิทธิ์เข้าถึงฐานข้อมูลผ่าน Data API',status:'blocked',detail:'ยังตรวจสิทธิ์ฐานข้อมูลไม่ได้'})
  }
  let ordersEnabled = false
  try { assertOrderingReady(); ordersEnabled = true } catch { /* Fail closed. */ }
  const paymentsEnabled = ordersEnabled && process.env.PAYMENTS_ENABLED === 'true' && deploymentKind() !== 'preview' && process.env.APP_MODE !== 'sandbox'
  return jsonUtf8({ success: true, data: { checks, operations, ordersEnabled, paymentsEnabled } }, { headers: { 'Cache-Control': 'private, no-store' } })
}
