import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import Stripe from 'stripe'
import { createHash } from 'node:crypto'
import { cloudSandboxEnvironment } from './cloud-sandbox-config'

async function main(){
 const env=cloudSandboxEnvironment();Object.assign(process.env,env)
 assert.ok(env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))
 const stripe=new Stripe(env.STRIPE_SECRET_KEY!,{timeout:10000,maxNetworkRetries:1})
 const {default:db}=await import('../src/lib/db')
 const {cents,PAID_STATUSES}=await import('../src/lib/commerce-rules')
 const {decryptDeliveryItemFields}=await import('../src/lib/encryption')
 try{
  const attempts=await db.$transaction(async tx=>{
   await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
   return tx.paymentAttempt.findMany({where:{method:'stripe',status:'verified'},orderBy:{createdAt:'desc'},take:10,include:{order:{include:{orderItems:true,deliveryItems:true,notifications:{select:{kind:true,status:true}}}}}})
  })
  const checks=[]
  for(const attempt of attempts){
   assert.ok(attempt.reference?.startsWith('stripe:cs_test_'))
   const session=await stripe.checkout.sessions.retrieve(attempt.reference!.slice(7))
   const intentId=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id
   assert.ok(intentId)
   const intent=await stripe.paymentIntents.retrieve(intentId!,{expand:['latest_charge']})
   const charge=typeof intent.latest_charge==='object'?intent.latest_charge:null
   const binding=createHash('sha256').update(attempt.requestKey).digest('hex')
   const paymentVerified=session.livemode===false&&intent.livemode===false&&session.status==='complete'&&session.payment_status==='paid'&&intent.status==='succeeded'&&session.currency==='thb'&&intent.currency==='thb'&&session.amount_total===cents(attempt.expectedAmount)&&intent.amount_received===cents(attempt.expectedAmount)&&session.client_reference_id===attempt.orderId&&session.metadata?.paymentAttemptId===attempt.id&&session.metadata?.binding===binding&&intent.metadata.binding===binding
   let deliveryReadable=true
   try{for(const delivery of attempt.order.deliveryItems)decryptDeliveryItemFields(delivery)}catch{deliveryReadable=false}
   const automaticQuantity=attempt.order.orderItems.filter(i=>i.deliveryType!=='manual').reduce((n,i)=>n+i.quantity,0)
   const deliveryComplete=attempt.order.deliveryItems.length===automaticQuantity&&deliveryReadable
   checks.push({paymentMethod:charge?.payment_method_details?.type||'unknown',amountTHB:Number(attempt.receivedAmount),providerSandboxPaidVerified:paymentVerified,orderStatus:attempt.order.status,paidAtRecorded:!!attempt.order.paidAt,orderPaidStateValid:PAID_STATUSES.includes(attempt.order.status),automaticQuantity,deliveryCount:attempt.order.deliveryItems.length,deliveryComplete,notificationStates:attempt.order.notifications})
  }
  const report={checkedAt:new Date().toISOString(),sandboxOnly:true,databaseReadOnly:true,realPayments:false,externalMessages:0,checkedOrders:checks.length,cardPaymentVerified:checks.some(c=>c.paymentMethod==='card'&&c.providerSandboxPaidVerified&&c.paidAtRecorded&&c.orderPaidStateValid&&c.deliveryComplete),promptPayPaymentVerified:checks.some(c=>c.paymentMethod==='promptpay'&&c.providerSandboxPaidVerified&&c.paidAtRecorded&&c.orderPaidStateValid&&c.deliveryComplete),checks}
  writeFileSync('docs/launch-stripe-paid-sandbox-latest.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))
 }finally{await db.$disconnect()}
}
main().catch(()=>{console.error('Paid sandbox check stopped; private details withheld. No database write was requested.');process.exitCode=1})
