import { requireAdmin } from '@/lib/admin-auth'
import { recordExternalRefund } from '@/lib/refunds'
import { sameOrigin, readJson, apiError } from '@/lib/server-guards'
import { jsonUtf8 } from '@/lib/json-response'
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.authorized) return auth.response
  try {
    sameOrigin(request)
    const { id } = await params
    return jsonUtf8({ success: true, data: await recordExternalRefund(id, await readJson(request), auth.userId) })
  } catch (error) { return apiError(error) }
}
