import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { previewIsIsolated } from '../src/lib/launch-readiness'
import { verifyNetlifyAssets } from './netlify-asset-check'

async function main(){
 const report=JSON.parse(readFileSync('docs/netlify-deployment-latest.json','utf8'))
 assert.equal(report.siteId,'1d1c3222-a3ce-4ad2-a38c-bae6a324f56c')
 assert.equal(report.url,'https://shop78it.netlify.app');assert.equal(report.deployed,true)
 const env:Record<string,string>={}
 for(const line of readFileSync('.env.netlify.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=JSON.parse(m[2])}
 assert.ok(previewIsIsolated(env))
 const db=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}})
 const counts=async()=>({orders:await db.order.count(),stock:await db.digitalStock.count(),deliveries:await db.deliveryItem.count(),payments:await db.paymentAttempt.count(),notifications:await db.notificationJob.count()})
 const secrets=Object.entries(env).filter(([k,v])=>/SECRET|ENCRYPTION_KEY|DATABASE_URL|DIRECT_URL/.test(k)&&v.length>16).map(([,v])=>v)
 const passed:string[]=[]
 async function request(path:string,init:RequestInit={}){const response=await fetch(report.url+path,{...init,redirect:'manual',signal:AbortSignal.timeout(30000)});const body=await response.text();assert.ok(!secrets.some(v=>body.includes(v)),'Private environment leaked');return{status:response.status,body,headers:response.headers}}
 try{
  const before=await counts()
  for(const path of ['/','/checkout','/track','/help','/privacy','/terms','/refund']){const r=await request(path);assert.equal(r.status,200,path)}
  await verifyNetlifyAssets(report.url)
  passed.push('public pages reachable without login; no server secrets')
  const settings=await request('/api/settings');assert.equal(settings.status,200);assert.equal(JSON.parse(settings.body).success,true)
  const missing=await request('/api/orders/track',{method:'POST',headers:{'content-type':'application/json',origin:report.url},body:JSON.stringify({orderNumber:'NETLIFY-NONEXISTENT',email:'netlify-check@example.invalid'})})
  assert.equal(missing.status,404);assert.equal(JSON.parse(missing.body).success,false)
  const existing=await db.order.findFirst({select:{orderNumber:true,customerEmail:true,status:true},orderBy:{createdAt:'desc'}})
  if(existing){const lookup=await request('/api/orders/track',{method:'POST',headers:{'content-type':'application/json',origin:report.url},body:JSON.stringify({orderNumber:existing.orderNumber,email:existing.customerEmail})});assert.equal(lookup.status,200);const json=JSON.parse(lookup.body);assert.equal(json.data.status,existing.status);assert.equal(lookup.headers.get('set-cookie'),null);assert.ok(lookup.headers.get('cache-control')?.includes('no-store'));assert.ok(!/"(?:licenseKey|deliveryItems|customerEmail|paymentReference)"/.test(lookup.body))}
  passed.push('Linux Prisma queries and order lookup reflect database without exposing goods or sending email')
  for(const path of ['/api/admin/orders','/api/admin/readiness','/api/cron/cancel-orders']){const r=await request(path);assert.ok([401,403].includes(r.status),path+' must require authentication')}
  passed.push('admin and cron unauthenticated requests rejected')
  const order=await request('/api/orders',{method:'POST',headers:{'content-type':'application/json',origin:report.url},body:JSON.stringify({customerName:'Netlify isolated check',customerEmail:'netlify-check@example.invalid',items:[]})})
  assert.equal(order.status,503);assert.ok(/ยังไม่เปิดรับ|ยังไม่เปิดรับคำสั่งซื้อ|เตรียมระบบ/.test(order.body))
  passed.push('new orders stay closed before business writes')
  const stripe=await request('/api/payment/stripe');assert.equal(stripe.status,200);assert.equal(JSON.parse(stripe.body).data.enabled,false)
  const tmn=await request('/api/payment/truemoney',{method:'POST',headers:{'content-type':'application/json',origin:report.url},body:JSON.stringify({orderNumber:'NETLIFY-UNKNOWN',voucherUrl:'https://gift.truemoney.com/campaign/?v=invalid'})});assert.ok([403,503].includes(tmn.status))
  passed.push('Stripe disabled and TrueMoney cannot accept money')
  const foreign=await request('/api/payment/stripe',{method:'POST',headers:{'content-type':'application/json',origin:'https://foreign.invalid'},body:'{}'});assert.equal(foreign.status,403)
  passed.push('foreign-origin writes rejected')
  const after=await counts();assert.deepEqual(after,before)
  passed.push('orders stock deliveries payment and notification counts unchanged')
  const result={checkedAt:new Date().toISOString(),url:report.url,siteId:report.siteId,deploymentId:report.deploymentId,passed:true,groups:passed,realPaymentsEnabled:false,ordersEnabled:false,externalMessagesSent:0,businessCountsUnchanged:true}
  writeFileSync('docs/netlify-smoke-latest.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result))
 }finally{await db.$disconnect()}
}
main().catch(e=>{console.error('Netlify verification failed:',e instanceof Error?e.message:'unknown');process.exitCode=1})
