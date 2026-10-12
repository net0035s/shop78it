import { listAdminOrders } from '@/lib/admin-order-list'
import { requireAdmin } from '@/lib/admin-auth'
import { adminOrderInclude, adminOrderData, updateAdminOrder } from '@/lib/admin-orders'
import { sameOrigin, readJson, apiError } from '@/lib/server-guards'
import { textField, CommerceError } from '@/lib/commerce-rules'
import { jsonUtf8 } from '@/lib/json-response'
import { tryNotifications } from '@/lib/notifications'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const auth = await requireAdmin(); if (!auth.authorized) return auth.response
  try {
    return jsonUtf8({ success:true, ...await listAdminOrders(new URL(request.url).searchParams) },{headers:{'Cache-Control':'private, no-store'}})
  } catch(error) { return apiError(error) }
}
export async function PUT(request: Request) {
  const auth = await requireAdmin(); if (!auth.authorized) return auth.response
  try { sameOrigin(request); const body = await readJson(request); const id=textField(body.id,'ออเดอร์',100); const data=await updateAdminOrder(id,body,auth.userId); await tryNotifications(id); return jsonUtf8({success:true,data}) } catch(error){return apiError(error)}
}
