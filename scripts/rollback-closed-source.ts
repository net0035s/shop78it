import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { Client } from 'pg'
import { loadTransitionState, saveTransitionState } from './execute-source-transition'
import { snapshotTables } from './backup-archive'
import { tables, quote, transitionToken, restoreOldRows, removeOwnedFreeze } from './source-transition-core'
import { vercelGet } from './vercel-readonly'
async function main(){
  const apply=process.argv.includes('--apply')
  const {state}=loadTransitionState();assert.equal(state.phase,'verified');assert(state.postSnapshot&&state.closedEnvironment)
  assert.equal(state.closedEnvironment.ORDERS_ENABLED,'false');assert.equal(state.closedEnvironment.PAYMENTS_ENABLED,'false');assert.equal(state.closedEnvironment.LAUNCH_APPROVED,'false')
  const release=JSON.parse(readFileSync('docs/launch-closed-production-deployment-latest.json','utf8'))
  const team=JSON.parse(readFileSync('.vercel/project.json','utf8')).orgId
  const [project,current,old]=await Promise.all([vercelGet('/v9/projects/prj_7klbKPGuzckoZ5liEDP9UXQRxvcV?teamId='+team),vercelGet('/v13/deployments/shop78it.vercel.app?teamId='+team),vercelGet('/v13/deployments/'+state.originalProductionId+'?teamId='+team)])
  assert.equal(current.id,release.deploymentId);assert.equal(old.projectId,current.projectId);assert.equal(old.readyState,'READY')
  const db=new Client({connectionString:state.adminUrl,connectionTimeoutMillis:15000});await db.connect()
  const stripRate=(value:Record<string,unknown>)=>Object.fromEntries(Object.entries(value).filter(([name])=>name!=='RateLimitBucket'))
  const report:any={checkedAt:new Date().toISOString(),apply,readOnly:!apply,eligible:false,applied:false,oldDeploymentReady:true,maintenanceActive:project.paused===true,oldDeploymentId:old.id}
  try{
    await db.query(apply?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    if(apply){
      assert(process.argv.includes('--confirm-original-data-and-runtime-pair'),'Explicit paired-recovery confirmation required')
      assert.equal(project.paused,true,'Pause the project and verify maintenance first; no source writes permitted here while public app is running')
      await transitionToken(db,state.token)
      await db.query('LOCK TABLE '+(await tables(db)).map(table=>'public.'+quote(table)).join(',')+' IN ACCESS EXCLUSIVE MODE')
    }
    assert.deepEqual(stripRate(await snapshotTables(db)),stripRate(state.postSnapshot),'Business data changed after transition; reconcile before any rollback')
    report.eligible=true
    if(apply){
      await restoreOldRows(db,state.original);await removeOwnedFreeze(db);await db.query('COMMIT')
      state.phase='rolled-back-original-business-data';saveTransitionState(state);report.applied=true
      report.runtimeRestoreRequired='Keep maintenance active. Restore the retained original deployment before resuming service; do not resume the new deployment with its removed runtime role.'
    }else await db.query('ROLLBACK')
  }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error}
  finally{await db.end();writeFileSync('docs/launch-closed-rollback-check-latest.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({apply,eligible:report.eligible,applied:report.applied,oldDeploymentReady:report.oldDeploymentReady,maintenanceActive:report.maintenanceActive}))}
}
main().catch(()=>{console.error('Recovery guard stopped; inspect release/maintenance/data state. No unguarded recovery will run.');process.exitCode=1})
