import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'
import { previewIsIsolated } from '../src/lib/launch-readiness'
import { cancelPendingOrder } from '../src/lib/inventory'

async function main() {
  const report = JSON.parse(readFileSync('docs/netlify-deployment-latest.json', 'utf8'))
  assert.equal(report.url, 'https://shop78it.netlify.app')
  const env: Record<string,string> = {}
  for (const line of readFileSync('.env.netlify.local','utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/); if(m) env[m[1]] = JSON.parse(m[2])
  }
  assert.ok(previewIsIsolated(env))
  assert.ok(/^[rs]k_test_/.test(env.STRIPE_SECRET_KEY))
  for (const key of ['PAYMENTS_ENABLED','LAUNCH_APPROVED','MAINTENANCE_ENABLED']) assert.equal(env[key], 'false')
  for (const key of ['EMAIL_PASS','TELEGRAM_BOT_TOKEN']) assert.equal(env[key], '')
  const db = new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}})
  const stripe = new Stripe(env.STRIPE_SECRET_KEY)
  const fixtures: {id:string,number:string,cookie:string,session?:string}[] = []
  const groups: string[] = []
  const secrets = Object.entries(env).filter(([k,v])=>/SECRET|ENCRYPTION_KEY|DATABASE_URL|DIRECT_URL/.test(k)&&v.length>16).map(([,v])=>v)
  async function request(path:string, body?:unknown, cookie?:string) {
    const res = await fetch(report.url+path,{method:body===undefined?'GET':'POST',headers:{origin:report.url,'content-type':'application/json',...(cookie?{cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000)})
    const raw = await res.text(); assert.ok(!secrets.some(v=>raw.includes(v)))
    assert.equal(res.status,200,`${path}: HTTP ${res.status}`)
    return {json:JSON.parse(raw),cookie:res.headers.get('set-cookie')?.split(';')[0]}
  }
  try {
    // Recover only this verifier's expired, unpaid fixtures from interrupted runs.
    const interrupted=await db.order.findMany({where:{customerName:'MOCK Netlify verification',customerEmail:'netlify-check@example.invalid',status:'pending'},include:{paymentAttempts:true}})
    for(const order of interrupted) {
      for(const attempt of order.paymentAttempts) {
        assert.equal(attempt.method,'stripe');assert.equal(attempt.status,'failed')
        const session=await stripe.checkout.sessions.retrieve(attempt.reference!.replace(/^stripe:/,''))
        assert.equal(session.livemode,false);assert.equal(session.status,'expired');assert.equal(session.payment_status,'unpaid')
      }
      await db.$transaction(tx=>cancelPendingOrder(tx,order.id,'netlify-sandbox-verification'),{timeout:60000,maxWait:10000})
    }
    const config = await request('/api/payment/stripe')
    assert.equal(config.json.data.enabled,true); assert.equal(config.json.data.testMode,true)
    groups.push('deployed Stripe configuration enabled in test mode')
    const product = await db.product.findFirstOrThrow({where:{name:{contains:'MOCK'},deliveryType:'manual',stock:{gte:1}}})
    const initialStock = product.stock
    for(let i=0;i<2;i++) {
      const created = await request('/api/orders',{customer:{name:'MOCK Netlify verification',email:'netlify-check@example.invalid',phone:''},items:[{productId:product.id,quantity:1}]})
      assert.equal(created.json.success,true); assert.ok(created.cookie)
      const number=created.json.data.orderNumber
      const order=await db.order.findUniqueOrThrow({where:{orderNumber:number}})
      assert.equal(order.status,'pending'); assert.equal(order.customerEmail,'netlify-check@example.invalid')
      fixtures.push({id:order.id,number,cookie:created.cookie!})
      const fixture=fixtures[i]
      const checkout=await request('/api/payment/stripe',{orderNumber:number},fixture.cookie)
      assert.ok(checkout.json.data.url.startsWith('https://checkout.stripe.com/'))
      const attempt=await db.paymentAttempt.findFirstOrThrow({where:{orderId:order.id,method:'stripe'}})
      const session=await stripe.checkout.sessions.retrieve(attempt.reference!.replace(/^stripe:/,''))
      fixture.session=session.id
      assert.equal(session.livemode,false);assert.equal(session.currency,'thb');assert.equal(session.amount_total,Number(order.total)*100)
      assert.ok(session.allowed_payment_method_types?.includes('card'));assert.ok(session.allowed_payment_method_types?.includes('promptpay'))
      assert.ok(session.success_url?.startsWith(report.url+'/'));assert.ok(session.cancel_url?.startsWith(report.url+'/'))
      const repeated=await request('/api/payment/stripe',{orderNumber:number},fixture.cookie)
      assert.equal(repeated.json.data.url,checkout.json.data.url)
      assert.equal(await db.paymentAttempt.count({where:{orderId:order.id,method:'stripe'}}),1)
      await request('/api/payment/stripe/cancel',{orderNumber:fixture.number},fixture.cookie)
      assert.equal((await stripe.checkout.sessions.retrieve(fixture.session!)).status,'expired')
      await db.$transaction(tx=>cancelPendingOrder(tx,fixture.id,'netlify-sandbox-verification'),{timeout:60000,maxWait:10000})
    }
    assert.notEqual(fixtures[0].number,fixtures[1].number);assert.notEqual(fixtures[0].session,fixtures[1].session)
    groups.push('two new orders have distinct Stripe sessions; retry uses same session')
    groups.push('Stripe confirms THB, card and PromptPay, test mode and Netlify return URLs')
    const badSignature=await fetch(report.url+'/api/payment/stripe/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':'invalid'},body:'{}',signal:AbortSignal.timeout(30000)})
    assert.equal(badSignature.status,400)
    groups.push('webhook rejects invalid signatures')
    const payload=JSON.stringify({id:'evt_netlify_signature_check',object:'event',livemode:false,type:'checkout.session.completed',data:{object:{id:'cs_test_unrelated_netlify_check',metadata:{}}}})
    const signature=stripe.webhooks.generateTestHeaderString({payload,secret:env.STRIPE_WEBHOOK_SECRET})
    const signed=await fetch(report.url+'/api/payment/stripe/webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':signature},body:payload,signal:AbortSignal.timeout(30000)})
    assert.equal(signed.status,200);assert.equal((await signed.json()).received,true)
    const hook=await stripe.webhookEndpoints.retrieve(report.webhookId)
    assert.equal(hook.url,report.url+'/api/payment/stripe/webhook');assert.equal(hook.livemode,false);assert.equal(hook.status,'enabled')
    groups.push('dedicated test webhook active; signed unrelated event accepted without changing orders')
    assert.equal((await db.product.findUniqueOrThrow({where:{id:product.id}})).stock,initialStock)
    groups.push('test sessions expired, fixture orders cancelled and reserved stock restored')
    const result={checkedAt:new Date().toISOString(),url:report.url,deploymentId:report.deploymentId,passed:true,groups,testOrders:fixtures.length,realPaymentsEnabled:false,externalMessagesSent:0,stockRestored:true,actualStripePaymentCompleted:false}
    writeFileSync('docs/netlify-stripe-sandbox-latest.json',JSON.stringify(result,null,2))
    console.log(JSON.stringify(result))
  } finally {
    for(const fixture of fixtures) {
      if(fixture.session) {
        const session=await stripe.checkout.sessions.retrieve(fixture.session)
        if(session.status==='open') await stripe.checkout.sessions.expire(session.id)
        await request('/api/payment/stripe/status',{orderNumber:fixture.number},fixture.cookie)
      }
      const active=await db.paymentAttempt.count({where:{orderId:fixture.id,status:{in:['started','review']}}})
      if(active===0) await db.$transaction(tx=>cancelPendingOrder(tx,fixture.id,'netlify-sandbox-verification'),{timeout:60000,maxWait:10000})
    }
    await db.$disconnect()
  }
}
main().catch(error=>{
  let message=error instanceof Error?error.message:'unknown failure'
  for(const line of readFileSync('.env.netlify.local','utf8').split(/\r?\n/)) {
    const match=line.match(/^([A-Z_]+)=(.*)$/)
    if(match) {const value=JSON.parse(match[2]);if(value.length>12)message=message.split(value).join('[redacted]')}
  }
  message=message.replace(/(?:sk|rk|whsec)_[A-Za-z0-9_]+/g,'[redacted]').replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted database URL]')
  console.error('Sandbox verification failed:',message);process.exitCode=1
})
