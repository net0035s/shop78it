import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { cloudSandboxEnvironment } from './cloud-sandbox-config'

let step = 'configuration'
async function main() {
 const env = cloudSandboxEnvironment()
 assert.ok(env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))
 assert.ok(/^whsec_[A-Za-z0-9]+$/.test(env.STRIPE_WEBHOOK_SECRET || ''))
 const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET!
 assert.ok(bypass.length >= 16)
 const stripe = new Stripe(env.STRIPE_SECRET_KEY!)
 const deployment = JSON.parse(readFileSync('docs/launch-preview-deployment-latest.json','utf8'))
 assert.equal(deployment.target,'preview'); assert.equal(deployment.state,'READY')
 const prior = JSON.parse(readFileSync('docs/launch-stripe-webhook-preparation-latest.json','utf8'))
 const project = JSON.parse(readFileSync('.vercel/project.json','utf8'))
 assert.equal(project.projectId,'prj_7klbKPGuzckoZ5liEDP9UXQRxvcV')
 const auth = JSON.parse(readFileSync(join(process.env.APPDATA!,'com.vercel.cli/Data/auth.json'),'utf8'))
 const headers = {Authorization:'Bearer '+(auth.token||auth.accessToken||auth.access_token)}
 async function api(path:string) {const r=await fetch('https://api.vercel.com'+path+'?teamId='+project.orgId,{headers});assert.ok(r.ok);return r.json()}
 step='Stripe destination configuration'
 const endpoint = readFileSync('.cache/stripe-webhook-endpoint.private.txt','utf8').trim()
 const parsed = new URL(endpoint)
 assert.equal(parsed.hostname,prior.alias)
 assert.equal(parsed.searchParams.get('x-vercel-protection-bypass'),bypass)
 const endpoints = await stripe.webhookEndpoints.list({limit:100})
 assert.equal(endpoints.has_more,false)
 const listening = endpoints.data.filter(e=>e.status==='enabled'&&(e.enabled_events.includes('*')||e.enabled_events.includes('checkout.session.expired')))
 // A single eligible destination makes pending_webhooks=0 an unambiguous delivery acknowledgement.
 assert.equal(listening.length,1)
 assert.equal(listening[0].url,endpoint)
 assert.equal(listening[0].livemode,false)
 for(const event of ['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'])assert.ok(listening[0].enabled_events.includes(event))
 step='preview and alias identity verification'
 const ready=await api('/v13/deployments/'+new URL(deployment.url).hostname)
 assert.equal(ready.readyState,'READY');assert.notEqual(ready.target,'production');assert.equal(ready.projectId,project.projectId)
 const primary=await api('/v4/aliases/shop78it.vercel.app')
 const alias=await api('/v4/aliases/'+prior.alias)
 assert.equal(alias.projectId,project.projectId)
 const allowedPrevious=[prior.targetDeploymentId,ready.id]
 if(existsSync('docs/launch-stripe-webhook-online-latest.json')){
  const last=JSON.parse(readFileSync('docs/launch-stripe-webhook-online-latest.json','utf8'))
  if(last.passed&&last.sandboxOnly&&last.alias===prior.alias){
   const previousUrl=new URL(last.url);assert.ok(previousUrl.hostname.startsWith('shop78it-')&&previousUrl.hostname.endsWith('.vercel.app'))
   const previous=await api('/v13/deployments/'+previousUrl.hostname)
   assert.equal(previous.projectId,project.projectId);assert.notEqual(previous.target,'production')
   allowedPrevious.push(previous.id)
  }
 }
 assert.ok(allowedPrevious.includes(alias.deploymentId||alias.deployment?.id))
 step='publishing the sandbox alias'
 if((alias.deploymentId||alias.deployment?.id)!==ready.id){
  const child=spawn(process.execPath,[join(process.env.APPDATA!,'npm/node_modules/vercel/dist/index.js'),'alias','set',new URL(deployment.url).hostname,prior.alias,'--scope','netnaruto0035s1-5199s-projects','--no-color'],{windowsHide:true,stdio:['ignore','pipe','pipe']})
  child.stdout.resume();child.stderr.resume()
  assert.equal(await new Promise((accept,reject)=>{child.on('error',reject);child.on('exit',accept)}),0)
 }
 const current=await api('/v4/aliases/'+prior.alias);assert.equal(current.deploymentId||current.deployment?.id,ready.id)
 const after=await api('/v4/aliases/shop78it.vercel.app');assert.equal(after.deploymentId||after.deployment?.id,primary.deploymentId||primary.deployment?.id)
 const base='https://'+prior.alias
 step='online sandbox and signature checks'
 const config=await fetch(base+'/api/payment/stripe',{headers:{'x-vercel-protection-bypass':bypass}})
 assert.equal(config.status,200);assert.equal((await config.json()).data.enabled,true)
 const unsigned=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})
 assert.equal(unsigned.status,400)
 step='Stripe sandbox event delivery'
 const started=Math.floor(Date.now()/1000),marker=randomUUID()
 let session:Stripe.Checkout.Session|undefined
 const report={checkedAt:new Date().toISOString(),sandboxOnly:true,realPayments:false,primaryDomainUnchanged:true,url:deployment.url,alias:prior.alias,stripeEnabled:true,unsignedWebhookRejected:true,actualStripeWebhookAcknowledged:false,paidCheckoutTested:false,promptPayPaidTested:false,sessionExpired:false,originalBusinessDataWritten:false,passed:false}
 try {
  session=await stripe.checkout.sessions.create({mode:'payment',allowed_payment_method_types:['card'],line_items:[{price_data:{currency:'thb',unit_amount:3000,product_data:{name:'MOCK webhook receipt verification'}},quantity:1}],success_url:deployment.url,cancel_url:deployment.url,metadata:{sandbox_webhook_probe:marker}})
  assert.equal(session.livemode,false)
  await stripe.checkout.sessions.expire(session.id);report.sessionExpired=true
  for(let attempt=0;attempt<20;attempt++){
   const events=await stripe.events.list({types:['checkout.session.expired'],created:{gte:started},limit:100})
   const event=events.data.find(e=>(e.data.object as Stripe.Checkout.Session).id===session!.id)
   if(event&&event.pending_webhooks===0){report.actualStripeWebhookAcknowledged=true;break}
   await new Promise(resolve=>setTimeout(resolve,3000))
  }
  assert.ok(report.actualStripeWebhookAcknowledged,'Stripe delivery is not yet acknowledged')
  report.passed=true
 } finally {
  if(session&&!report.sessionExpired){try{await stripe.checkout.sessions.expire(session.id);report.sessionExpired=true}catch{}}
  writeFileSync('docs/launch-stripe-webhook-online-latest.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report))
 }
}
main().catch(()=>{console.error('Sandbox webhook verification stopped at '+step+'; private details withheld.');process.exitCode=1})
