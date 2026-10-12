import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { vercelGet } from './vercel-readonly'
import { loadTransitionState } from './execute-source-transition'
async function main() {
  assert(process.argv.includes('--promote-closed'))
  const report=JSON.parse(readFileSync('docs/launch-closed-production-deployment-latest.json','utf8'))
  const smoke=JSON.parse(readFileSync('docs/launch-closed-production-smoke-latest.json','utf8'))
  const {state}=loadTransitionState();assert.equal(state.phase,'verified');assert(state.closedEnvironment)
  assert.equal(state.closedEnvironment.ORDERS_ENABLED,'false');assert.equal(state.closedEnvironment.PAYMENTS_ENABLED,'false');assert.equal(state.closedEnvironment.LAUNCH_APPROVED,'false')
  assert.equal(report.state,'READY');assert.equal(report.target,'production');assert(report.closed&&smoke.passed&&smoke.businessRowsUnchanged)
  assert.equal(smoke.url,report.url)
  const team=JSON.parse(readFileSync('.vercel/project.json','utf8')).orgId
  const target=await vercelGet('/v13/deployments/'+report.deploymentId+'?teamId='+team)
  const primary=await vercelGet('/v13/deployments/shop78it.vercel.app?teamId='+team)
  const sandbox=await vercelGet('/v13/deployments/shop78it-stripe-sandbox.vercel.app?teamId='+team)
  assert.equal(sandbox.projectId,target.projectId);assert.notEqual(sandbox.target,'production');assert.equal(sandbox.readyState,'READY')
  assert.equal(sandbox.id,'dpl_CdnAbkQHB9h4BFtmo8CFRZYMy85C','Unexpected Sandbox alias change')
  assert.equal(target.projectId,'prj_7klbKPGuzckoZ5liEDP9UXQRxvcV');assert.equal(target.target,'production');assert.equal(target.readyState,'READY')
  assert.equal(primary.id,state.originalProductionId,'Primary changed independently; stop')
  const child=spawn(process.execPath,[resolve(process.env.APPDATA!,'npm/node_modules/vercel/dist/index.js'),'promote',target.id,'--scope','netnaruto0035s1-5199s-projects','--yes','--no-color'],{windowsHide:true,stdio:['ignore','pipe','pipe']})
  let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output+=chunk.toString()})
  child.on('close',()=>{for(const secret of [state.newKey,state.runtimePassword,state.token,state.adminUrl,...Object.values(state.closedEnvironment||{})].filter(value=>value.length>=16))output=output.replaceAll(secret,'[private]');writeFileSync('.cache/closed-production-promotion.log',output)})
  assert.equal(await new Promise<number|null>((ok,fail)=>{child.on('error',fail);child.on('close',ok)}),0,'Promotion failed')
  const after=await vercelGet('/v13/deployments/shop78it.vercel.app?teamId='+team)
  assert.equal(after.id,target.id)
  let sandboxAfter=await vercelGet('/v13/deployments/shop78it-stripe-sandbox.vercel.app?teamId='+team)
  if(sandboxAfter.id!==sandbox.id) {
    const restore=spawn(process.execPath,[resolve(process.env.APPDATA!,'npm/node_modules/vercel/dist/index.js'),'alias','set',sandbox.id,'shop78it-stripe-sandbox.vercel.app','--scope','netnaruto0035s1-5199s-projects','--no-color'],{windowsHide:true,stdio:'ignore'})
    assert.equal(await new Promise<number|null>((ok,fail)=>{restore.on('error',fail);restore.on('close',ok)}),0)
    sandboxAfter=await vercelGet('/v13/deployments/shop78it-stripe-sandbox.vercel.app?teamId='+team)
  }
  assert.equal(sandboxAfter.id,sandbox.id);assert.notEqual(sandboxAfter.target,'production')
  Object.assign(report,{checkedAt:new Date().toISOString(),promoted:true,primaryDomainDeploymentId:target.id,primaryDomainPromoted:true,primaryUrl:'https://shop78it.vercel.app',realPaymentsEnabled:false,ordersEnabled:false,sandboxWebhookAliasPreserved:true,sandboxWebhookDeploymentId:sandbox.id})
  writeFileSync('docs/launch-closed-production-deployment-latest.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({promoted:true,deploymentId:target.id,primaryUrl:report.primaryUrl,closed:true,realPaymentsEnabled:false}))
}
main().catch(error=>{const frame=String(error.stack||'').split('\n').find(line=>/promote-closed-production\.ts:\d+:\d+/.test(line));console.error(JSON.stringify({promotionNotConfirmed:true,category:error.name,location:frame?.match(/promote-closed-production\.ts:\d+:\d+/)?.[0],privateDetailsWithheld:true}));process.exitCode=1})
