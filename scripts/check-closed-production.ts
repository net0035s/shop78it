import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { vercelGet } from './vercel-readonly'
async function main() {
  const report=JSON.parse(readFileSync('docs/launch-closed-production-deployment-latest.json','utf8'))
  assert(report.closed&&report.target==='production'&&report.submitted)
  const team=JSON.parse(readFileSync('.vercel/project.json','utf8')).orgId
  const [deployment,primary]=await Promise.all([
    vercelGet('/v13/deployments/'+new URL(report.url).hostname+'?teamId='+team),
    vercelGet('/v13/deployments/shop78it.vercel.app?teamId='+team),
  ])
  assert.equal(deployment.projectId,'prj_7klbKPGuzckoZ5liEDP9UXQRxvcV');assert.equal(deployment.target,'production')
  assert.equal(primary.id,report.promoted?deployment.id:report.originalProductionId)
  Object.assign(report,{checkedAt:new Date().toISOString(),deploymentId:deployment.id,state:deployment.readyState||deployment.status,errorCode:deployment.errorCode||null,primaryDomainDeploymentId:primary.id,primaryDomainPromoted:primary.id===deployment.id})
  writeFileSync('docs/launch-closed-production-deployment-latest.json',JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({state:report.state,errorCode:report.errorCode,deploymentId:deployment.id,closed:true,primaryDomainPromoted:report.primaryDomainPromoted,url:report.url}))
}
main().catch(()=>{console.error('Deployment state check failed; private details withheld');process.exitCode=1})
