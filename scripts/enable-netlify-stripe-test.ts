import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import Stripe from 'stripe'
import { cloudSandboxEnvironment } from './cloud-sandbox-config'
import { previewIsIsolated } from '../src/lib/launch-readiness'

async function main(){
 assert.ok(process.argv.includes('--sandbox-only') || process.argv.includes('--preflight'))
 const source=cloudSandboxEnvironment()
 assert.ok(/^[rs]k_test_[A-Za-z0-9]+$/.test(source.STRIPE_SECRET_KEY||''),'Stripe test key missing')
 const current=JSON.parse(readFileSync('docs/netlify-deployment-latest.json','utf8'))
 assert.equal(current.siteId,'1d1c3222-a3ce-4ad2-a38c-bae6a324f56c');assert.equal(current.url,'https://shop78it.netlify.app')
 const smoke=JSON.parse(readFileSync('docs/netlify-smoke-latest.json','utf8'));assert.equal(smoke.passed,true);assert.equal(smoke.deploymentId,current.deploymentId)
 const env:Record<string,string>={};for(const line of readFileSync('.env.netlify.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=JSON.parse(m[2])}
 assert.ok(previewIsIsolated(env))
 for(const k of ['PAYMENTS_ENABLED','LAUNCH_APPROVED','MAINTENANCE_ENABLED'])assert.equal(env[k],'false')
 for(const k of ['EMAIL_PASS','TELEGRAM_BOT_TOKEN','TMN_RECEIVE_PHONE'])assert.equal(env[k],'')
 const stripe=new Stripe(source.STRIPE_SECRET_KEY!)
 const account=await stripe.accounts.retrieve(null);assert.equal(account.country,'TH');assert.equal(account.charges_enabled,true)
 const url=current.url+'/api/payment/stripe/webhook'
 if(process.argv.includes('--preflight')){
   const hooks=await stripe.webhookEndpoints.list({limit:100})
   console.log(JSON.stringify({preflightPassed:true,target:current.url,databaseIsolated:true,stripeKeyMode:'test',stripeCountry:account.country,chargesEnabled:account.charges_enabled,existingWebhookForTarget:hooks.data.some(h=>h.url===url),changesApplied:false,secretsTransferredToNetlify:false}))
   return
 }
 let hookId:string
 if(existsSync('.cache/netlify-stripe-webhook.json')){
   const checkpoint=JSON.parse(readFileSync('.cache/netlify-stripe-webhook.json','utf8'));hookId=checkpoint.id
   const hook=await stripe.webhookEndpoints.retrieve(hookId);assert.equal(hook.url,url);assert.equal(hook.livemode,false);assert.ok(env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'))
 }else{
   const listed=await stripe.webhookEndpoints.list({limit:100});assert.ok(!listed.data.some(h=>h.url===url),'Existing webhook secret must be recovered, not duplicated')
   const hook=await stripe.webhookEndpoints.create({url,enabled_events:['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'],description:'Shop78it Netlify isolated sandbox — test payments only'}, {idempotencyKey:'shop78it-netlify-sandbox-hook-20261012'})
   assert.equal(hook.livemode,false);assert.ok(hook.secret?.startsWith('whsec_'));hookId=hook.id;env.STRIPE_WEBHOOK_SECRET=hook.secret!
 }
 Object.assign(env,{ORDERS_ENABLED:'true',STRIPE_ENABLED:'true',STRIPE_SECRET_KEY:source.STRIPE_SECRET_KEY})
 writeFileSync('.env.netlify.local',Object.entries(env).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n')
 writeFileSync('.cache/netlify-stripe-webhook.json',JSON.stringify({id:hookId,url,livemode:false},null,2))
 const stage=current.stage;assert.ok(stage.startsWith(join(process.env.TEMP!,'shop78it-netlify-')));assert.ok(existsSync(join(stage,'.netlify/functions/manifest.json')))
 const cli=resolve(process.env.LOCALAPPDATA!,'npm-cache/_npx/b3ca12a867cd0704/node_modules/netlify-cli/bin/run.js')
 const run=(args:string[])=>execFileSync(process.execPath,[cli,...args],{cwd:stage,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}})
 const site=JSON.parse(run(['api','getSite','--data',JSON.stringify({site_id:current.siteId})]));assert.equal(site.name,'shop78it');assert.equal(site.account_slug,'november-3-cr7mw')
 run(['env:import',resolve('.env.netlify.local'),'--site',current.siteId])
 console.log('Imported isolated Stripe test configuration; redeploying existing verified artifacts')
 run(['deploy','--site',current.siteId,'--no-build','--prod','--json'])
 const final=JSON.parse(run(['api','getSite','--data',JSON.stringify({site_id:current.siteId})]));assert.equal(final.published_deploy.state,'ready')
 const deployment=JSON.parse(run(['api','getDeploy','--data',JSON.stringify({deploy_id:final.published_deploy.id})]));assert.ok(deployment.available_functions.some((f:{n:string})=>f.n==='___netlify-server-handler'))
 const configuration=await fetch(current.url+'/api/payment/stripe',{signal:AbortSignal.timeout(30000)}).then(r=>r.json());assert.equal(configuration.data.enabled,true);assert.equal(configuration.data.testMode,true)
 Object.assign(current,{deploymentId:final.published_deploy.id,ordersEnabled:true,stripeTestEnabled:true,realPaymentsEnabled:false,webhookId:hookId,updatedAt:new Date().toISOString()})
 writeFileSync('docs/netlify-deployment-latest.json',JSON.stringify(current,null,2))
 console.log(JSON.stringify({url:current.url,deploymentId:current.deploymentId,ordersEnabled:true,stripeMode:'test',realPaymentsEnabled:false,webhookConfigured:true,messagesEnabled:false}))
}
main().catch(()=>{console.error('Stripe sandbox setup stopped safely. No credentials printed and no live payments enabled.');process.exitCode=1})

