import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'

async function main(){
 const keys=['MAINTENANCE_ENABLED','NEXT_PUBLIC_SITE_URL','CRON_SECRET']
 const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]))
 const originalFetch=globalThis.fetch
 const secret=randomBytes(32).toString('hex');let calls=0,ok=true,complete=true
 const {default:worker}=await import(pathToFileURL(resolve('netlify/functions/shop-maintenance.mjs')).href)
 globalThis.fetch=async(url,init)=>{
   calls++;assert.equal(String(url),'https://shop78it.netlify.app/api/cron/cancel-orders')
   assert.equal(new Headers(init?.headers).get('authorization'),'Bearer '+secret)
   assert.equal(init?.redirect,'error')
   return Response.json({success:complete},{status:ok?200:500})
 }
 try{
  process.env.MAINTENANCE_ENABLED='false';assert.equal((await worker()).status,204);assert.equal(calls,0)
  Object.assign(process.env,{MAINTENANCE_ENABLED:'true',NEXT_PUBLIC_SITE_URL:'https://shop78it.netlify.app',CRON_SECRET:secret})
  assert.equal((await worker()).status,204);assert.equal(calls,1)
  process.env.NEXT_PUBLIC_SITE_URL='https://user:password@shop78it.netlify.app';await assert.rejects(()=>worker());assert.equal(calls,1)
  process.env.NEXT_PUBLIC_SITE_URL='https://shop78it.netlify.app';process.env.CRON_SECRET='short';await assert.rejects(()=>worker());assert.equal(calls,1)
  process.env.CRON_SECRET=secret;ok=false;await assert.rejects(()=>worker())
  ok=true;complete=false;await assert.rejects(()=>worker())
  console.log(JSON.stringify({passed:true,checks:6,networkRequests:0,realPayments:false,externalMessages:0}))
 }finally{globalThis.fetch=originalFetch;for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key]}}
}
main().catch(()=>{console.error('Maintenance test failed; private values withheld');process.exitCode=1})
