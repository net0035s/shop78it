import { vercelGet } from './vercel-readonly'
import { readFileSync } from 'node:fs'
async function main(){
  const team=JSON.parse(readFileSync('.vercel/project.json','utf8')).orgId
  for(const host of ['shop78it.vercel.app','shop78it-stripe-sandbox.vercel.app']){
    const d=await vercelGet('/v13/deployments/'+host+'?teamId='+team)
    console.log(JSON.stringify({host,deploymentId:d.id,target:d.target??null,state:d.readyState,projectId:d.projectId}))
  }
}
main().catch(()=>{console.error('Read-only domain inspection failed');process.exitCode=1})
