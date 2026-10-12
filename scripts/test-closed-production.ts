import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { Client } from 'pg'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { loadTransitionState } from './execute-source-transition'
import { snapshotTables } from './backup-archive'
async function main() {
  const deployment=JSON.parse(readFileSync('docs/launch-closed-production-deployment-latest.json','utf8'))
  assert.equal(deployment.state,'READY');assert(deployment.closed&&deployment.target==='production')
  const {state}=loadTransitionState();assert.equal(state.phase,'verified')
  const url=process.argv.includes('--primary')?'https://shop78it.vercel.app':deployment.url
  assert(new URL(url).hostname==='shop78it.vercel.app'||new URL(url).hostname===new URL(deployment.url).hostname)
  const match=readFileSync('.env.sandbox.local','utf8').match(/^\s*VERCEL_AUTOMATION_BYPASS_SECRET\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))/m)
  const bypass=match?.[1]??match?.[2]??match?.[3];assert(bypass&&bypass.length>=16)
  const db=new Client({connectionString:state.adminUrl,connectionTimeoutMillis:15000});await db.connect()
  const app=new Client({connectionString:state.runtimeDirectUrl,connectionTimeoutMillis:15000});await app.connect()
  let fixtureSession:{id:string;hash:string}|null=null
  const report:any={checkedAt:new Date().toISOString(),url,production:true,closed:true,groups:[],passed:false,realPaymentsAttempted:0,messagesSent:0}
  async function request(path:string, body?:unknown, origin=url, extraHeaders:Record<string,string>={}) {
    const response=await fetch(new URL(path,url),{method:body?'POST':'GET',headers:{'x-vercel-protection-bypass':bypass!,'content-type':'application/json',...(body?{origin}:{}),...extraHeaders},body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(60000)})
    return {status:response.status,text:await response.text(),headers:response.headers}
  }
  try {
    const before=await snapshotTables(db)
    const root=await request('/');assert.equal(root.status,200);assert(root.text.includes('Shop78it'))
    for(const secret of [state.newKey,state.runtimePassword,state.runtimeUrl,state.adminUrl])assert(!root.text.includes(secret))
    report.groups.push('storefront loads and server credentials absent from HTML')
    for(const path of ['/track','/checkout','/terms','/privacy','/refund','/help'])assert.equal((await request(path)).status,200)
    report.groups.push('tracking checkout and customer policy pages load')
    for(const path of ['/api/admin/orders','/api/admin/readiness','/api/cron/clear-unpaid'])assert.equal((await request(path)).status,401)
    report.groups.push('admin and worker reject unauthenticated requests')
    const order=await request('/api/orders',{items:[],customer:{name:'Closed probe',email:'no-mail@example.invalid'}})
    assert.equal(order.status,503);assert(JSON.parse(order.text).error.includes('ยังไม่เปิดรับคำสั่งซื้อ'))
    report.groups.push('new orders rejected before a business write')
    const stripe=await request('/api/payment/stripe');assert.equal(stripe.status,200);assert.equal(JSON.parse(stripe.text).data.enabled,false);assert.equal(JSON.parse(stripe.text).data.testMode,false)
    assert.equal((await request('/api/payment/truemoney',{orderId:'CLOSED-NO-ORDER',voucherLink:'INVALID-NO-VOUCHER'})).status,503)
    const deniedStripe=await request('/api/payment/stripe',{orderNumber:'CLOSED-NO-ORDER'})
    assert.equal(deniedStripe.status,403);assert.equal(JSON.parse(deniedStripe.text).code,'ORDER_ACCESS_REQUIRED')
    const sample=state.original.Order.rows.find(row=>typeof row.customerEmail==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.customerEmail))!
    assert(sample)
    // A short-lived, local probe grant proves Stripe stays closed even with valid order access.
    // No order/payment/stock is created, and this exact grant is removed in finally.
    const accessToken=randomBytes(32).toString('base64url'),hash=(s:string)=>createHash('sha256').update(s).digest('hex')
    fixtureSession={id:randomUUID(),hash:hash(accessToken)}
    await app.query('INSERT INTO public."OrderAccessSession" (id,"orderId","tokenHash","expiresAt") VALUES ($1,$2,$3,$4)',[fixtureSession.id,sample.id,fixtureSession.hash,new Date(Date.now()+300000)])
    assert.equal((await request('/api/payment/stripe',{orderNumber:sample.orderNumber},url,{cookie:'oa_'+hash(String(sample.orderNumber)).slice(0,24)+'='+accessToken})).status,503)
    await app.query('DELETE FROM public."OrderAccessSession" WHERE id=$1 AND "tokenHash"=$2',[fixtureSession.id,fixtureSession.hash]);fixtureSession=null
    report.groups.push('Stripe and TrueMoney disabled, including Stripe with a valid scoped probe grant')
    const tracked=await request('/api/orders/track',{orderNumber:sample.orderNumber,email:sample.customerEmail})
    assert.equal(tracked.status,200);const body=JSON.parse(tracked.text)
    assert.equal(body.data.orderNumber,sample.orderNumber)
    const current=(await db.query('SELECT status FROM public."Order" WHERE id=$1',[sample.id])).rows[0]
    assert.equal(body.data.status,current.status);assert(!tracked.headers.has('set-cookie'))
    for(const key of ['customerEmail','deliveredContent','deliveryItems','licenseKey','instructions','internalNote','paymentReference'])assert(!tracked.text.includes('"'+key+'"'))
    assert.equal((await request('/api/orders/track',{orderNumber:sample.orderNumber,email:'wrong@example.invalid'})).status,404)
    assert.equal((await request('/api/orders/track',{orderNumber:sample.orderNumber,email:sample.customerEmail},'https://example.invalid')).status,403)
    report.groups.push('existing order plus email reflects database status without exposing goods or sending mail')
    const after=await snapshotTables(db)
    for(const [table,value]of Object.entries(before))if(table!=='RateLimitBucket')assert.deepEqual(after[table],value,'Business rows changed during closed checks')
    assert.equal(after.Order.count,26)
    report.businessRowsUnchanged=true;report.rateLimitMetadataMayChange=true;report.orders=26;report.passed=true
  } finally {
    if(fixtureSession)await app.query('DELETE FROM public."OrderAccessSession" WHERE id=$1 AND "tokenHash"=$2',[fixtureSession.id,fixtureSession.hash])
    await app.end()
    await db.end();writeFileSync('docs/launch-closed-production-smoke-latest.json',JSON.stringify(report,null,2)+'\n')
    console.log(JSON.stringify({passed:report.passed,groups:report.groups.length,businessRowsUnchanged:report.businessRowsUnchanged||false,url,closed:true}))
  }
}
main().catch(error=>{const frame=String(error.stack||'').split('\n').find(line=>/test-closed-production\.ts:\d+:\d+/.test(line));console.error(JSON.stringify({stopped:true,category:error.name,location:frame?.match(/test-closed-production\.ts:\d+:\d+/)?.[0],privateDetailsWithheld:true}));process.exitCode=1})
