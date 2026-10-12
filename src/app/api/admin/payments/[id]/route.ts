import { requireAdmin } from '@/lib/admin-auth'
import { transaction } from '@/lib/transactions'
import { recordPayment } from '@/lib/payments'
import { fulfillPaidOrder } from '@/lib/order-fulfillment'
import { tryNotifications } from '@/lib/notifications'
import { readJson, sameOrigin, apiError } from '@/lib/server-guards'
import { textField, CommerceError } from '@/lib/commerce-rules'
import { jsonUtf8 } from '@/lib/json-response'
import prisma from '@/lib/db'
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  const auth=await requireAdmin();if(!auth.authorized)return auth.response
  try {
    sameOrigin(request);const {id}=await params;const body=await readJson(request);const note=textField(body.note,'ผลตรวจจากบัญชีรับเงินจริง',1000)
    const attempt=await prisma.paymentAttempt.findUniqueOrThrow({where:{id}})
    if(!['started','review'].includes(attempt.status))throw new CommerceError('รายการนี้ได้รับการสรุปผลแล้ว',409)
    if(attempt.createdAt.getTime()>Date.now()-60000)throw new CommerceError('กรุณารอคำขอรับเงินเดิมสิ้นสุดก่อนตรวจผล',409)
    if(body.resolution==='paid') {
      const reference=textField(body.reference,'เลขอ้างอิงพร้อมชื่อช่องทาง',240)
      if(!reference.startsWith(`${attempt.method}:`))throw new CommerceError('เลขอ้างอิงต้องขึ้นต้นด้วยชื่อช่องทางและเครื่องหมาย :')
      await recordPayment(id,reference,Number(body.receivedAmount))
      await prisma.orderAuditEvent.create({data:{orderId:attempt.orderId,actor:auth.userId,action:'payment_reconciled_paid',note}})
      await fulfillPaidOrder(attempt.orderId);await tryNotifications(attempt.orderId)
    } else if(body.resolution==='not_paid') {
      await transaction(async tx=>{
        const changed=await tx.paymentAttempt.updateMany({where:{id,status:{in:['started','review']}},data:{status:'failed',note}})
        if(!changed.count)throw new CommerceError('รายการเปลี่ยนแล้ว',409)
        await tx.order.updateMany({where:{id:attempt.orderId,status:{in:['payment_processing','payment_review']}},data:{status:'pending'}})
        await tx.orderAuditEvent.create({data:{orderId:attempt.orderId,actor:auth.userId,action:'payment_reconciled_not_paid',note}})
      })
    } else throw new CommerceError('กรุณาเลือกผลตรวจรับเงิน')
    return jsonUtf8({success:true})
  }catch(error){return apiError(error)}
}
