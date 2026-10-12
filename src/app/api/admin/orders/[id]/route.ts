import { requireAdmin } from '@/lib/admin-auth'
import { updateAdminOrder } from '@/lib/admin-orders'
import { readJson, sameOrigin, apiError } from '@/lib/server-guards'
import { tryNotifications } from '@/lib/notifications'
import { jsonUtf8 } from '@/lib/json-response'
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}) {
  const auth=await requireAdmin(); if(!auth.authorized)return auth.response
  try { sameOrigin(request);const {id}=await params;const data=await updateAdminOrder(id,await readJson(request),auth.userId);await tryNotifications(id);return jsonUtf8({success:true,data}) } catch(error){return apiError(error)}
}
