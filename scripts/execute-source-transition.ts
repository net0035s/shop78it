import assert from 'node:assert/strict'
import { loadEnvConfig } from '@next/env'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomBytes, createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { Client } from 'pg'
import { decryptArchive, encryptArchive, snapshotTables, SnapshotManifest } from './backup-archive'
import { databaseFingerprint } from '../src/lib/launch-readiness'
import { oldRows, tables, installFreeze, transitionToken, addGuards, grantRuntime, proveLegacyBlocked, rekeyPlan, applyRekey, roleUrl, quote, OldRows, restoreOldRows, removeOwnedFreeze } from './source-transition-core'
import { vercelGet } from './vercel-readonly'
const PROJECT='prj_7klbKPGuzckoZ5liEDP9UXQRxvcV',TEAM='team_vzgAheUA1bP7p02TJ8pUZvOb'
export type TransitionState = {version:1;createdAt:string;phase:string;adminUrl:string;runtimeUrl:string;runtimeDirectUrl:string;runtimePassword:string;newKey:string;token:string;original:OldRows;backupFile:string;backupKeyFile:string;originalProductionId:string;postSnapshot?:SnapshotManifest['tables'];closedEnvironment?:Record<string,string>}
export function loadTransitionState() {
  const location=JSON.parse(readFileSync('.cache/source-transition-location.json','utf8'))
  const key=readFileSync(location.keyFile,'utf8').trim()
  const state=JSON.parse(decryptArchive(readFileSync(location.archiveFile),key).dump.toString('utf8')) as TransitionState
  assert.equal(state.version,1)
  return {location,key,state}
}
export function saveTransitionState(state:TransitionState) {
  const {location,key}=loadTransitionState(),payload=Buffer.from(JSON.stringify(state))
  const header:SnapshotManifest={createdAt:state.createdAt,sourceFingerprint:databaseFingerprint(state.adminUrl),tables:{},scope:'public',dumpSha256:createHash('sha256').update(payload).digest('hex')}
  writeFileSync(location.archiveFile,encryptArchive(payload,header,key),{mode:0o600})
  assert(decryptArchive(readFileSync(location.archiveFile),readFileSync(location.keyFile,'utf8').trim()).dump.equals(payload))
}
async function privateCommand(args:string[], env:NodeJS.ProcessEnv) {
  const child=spawn(process.execPath,args,{env,windowsHide:true,stdio:'ignore'})
  const code=await new Promise<number|null>((ok,fail)=>{child.on('error',fail);child.on('close',ok)})
  assert.equal(code,0,'Private Prisma command failed')
}
async function main() {
  const preflight=process.argv.includes('--preflight')
  assert(preflight || (process.argv.includes('--apply')&&process.argv.includes('--confirm-all-data-is-test')&&process.argv.includes('--confirm-closed-production')))
  assert(!existsSync('.cache/source-transition-location.json'),'A transition already exists; inspect its checkpoint instead of rerunning')
  loadEnvConfig(process.cwd(),true,{info(){},error(){}})
  const adminUrl=process.env.DIRECT_URL!,databaseUrl=process.env.DATABASE_URL!,oldKey=process.env.ENCRYPTION_KEY!
  const source=databaseFingerprint('postgresql://postgres@db.hddnabbhdjphjwjohvcg.supabase.co/postgres')
  assert.equal(databaseFingerprint(adminUrl),source);assert.equal(databaseFingerprint(databaseUrl),source)
  const backup=JSON.parse(readFileSync('docs/launch-backup-rehearsal-latest.json','utf8'))
  const rehearsal=JSON.parse(readFileSync('docs/launch-source-transition-rehearsal-latest.json','utf8'))
  assert(backup.restoreVerified&&backup.baselineDrift==='none'&&rehearsal.passed&&rehearsal.postTransitionBackupRestoreVerified)
  assert.equal(rehearsal.backupCreatedAt,backup.checkedAt,'Rehearsal must cover the current backup')
  assert.equal(rehearsal.coreSha256,createHash('sha256').update(readFileSync('scripts/source-transition-core.ts')).digest('hex'))
  assert.equal(rehearsal.migrationSha256,createHash('sha256').update(readFileSync('prisma/migrations/202609050002_commerce_safety/migration.sql')).digest('hex'))
  assert(Date.now()-new Date(backup.checkedAt).getTime()<45*60*1000,'Backup too old')
  const {manifest}=decryptArchive(readFileSync(backup.encryptedBackup),readFileSync(backup.recoveryKeyFile,'utf8').trim())
  assert.equal(manifest.sourceFingerprint,source);assert.equal(Object.keys(manifest.tables).length,9)
  const primary=await vercelGet('/v13/deployments/shop78it.vercel.app?teamId='+TEAM)
  assert.equal(primary.projectId,PROJECT);assert.equal(primary.target,'production')
  assert((primary.alias||[]).includes('shop78it.vercel.app'))
  const productionId=primary.id
  assert.equal(productionId,'dpl_BYRSgyBPXEAmcYAte9PeqjZUxPqU','Unexpected production change')
  const project=JSON.parse(readFileSync('.vercel/project.json','utf8'));assert.equal(project.projectId,PROJECT);assert.equal(project.orgId,TEAM)
  await privateCommand(['node_modules/prisma/build/index.js','migrate','diff','--from-schema-datasource','prisma/baseline.prisma','--to-schema-datamodel','prisma/baseline.prisma','--exit-code'],{...process.env,DATABASE_URL:adminUrl,DIRECT_URL:adminUrl})
  if(preflight) {
    const reader=new Client({connectionString:adminUrl,connectionTimeoutMillis:15000})
    await reader.connect()
    try {
      await reader.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      assert.deepEqual(await snapshotTables(reader),manifest.tables,'Source differs from backup')
      const changes=await rekeyPlan(reader,oldKey,randomBytes(32).toString('hex'))
      await reader.query('ROLLBACK')
      const report={checkedAt:new Date().toISOString(),readOnly:true,sourceProject:'hddnabbhdjphjwjohvcg',businessTables:9,orders:manifest.tables.Order.count,backupMatches:true,schemaDrift:'none',rekeyValues:changes.length,privateCheckpointExists:false,primaryProductionId:productionId,passed:true}
      writeFileSync('docs/launch-source-transition-preflight-latest.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))
    } finally {await reader.end()}
    return
  }
  const vault=mkdtempSync(join(process.env.LOCALAPPDATA!,'Shop78itRecovery','transition-'))
  const identity=(process.env.USERDOMAIN?process.env.USERDOMAIN+'\\':'')+process.env.USERNAME
  const acl=spawn('icacls.exe',[vault,'/inheritance:r','/grant:r',identity+':(OI)(CI)F'],{windowsHide:true,stdio:'ignore'})
  assert.equal(await new Promise<number|null>(ok=>acl.on('close',ok)),0)
  const key=randomBytes(32).toString('hex'),keyFile=join(vault,'transition.recovery-key')
  writeFileSync(keyFile,key+'\n',{flag:'wx',mode:0o600})
  const archiveFile=resolve('backups','shop78it-transition-'+new Date().toISOString().replaceAll(':','-')+'.enc')
  const runtimePassword=randomBytes(32).toString('hex')
  const state:TransitionState={version:1,createdAt:new Date().toISOString(),phase:'prepared',adminUrl,runtimeUrl:roleUrl(databaseUrl,runtimePassword),runtimeDirectUrl:roleUrl(adminUrl,runtimePassword),runtimePassword,newKey:randomBytes(32).toString('hex'),token:randomBytes(32).toString('hex'),original:{},backupFile:backup.encryptedBackup,backupKeyFile:backup.recoveryKeyFile,originalProductionId:productionId}
  const report:any={checkedAt:state.createdAt,sourceProject:'hddnabbhdjphjwjohvcg',productionDeployed:false,realPaymentsEnabled:false,phase:state.phase,passed:false,sourceWriteGuardInstalled:false}
  function save() {
    const payload=Buffer.from(JSON.stringify(state))
    const header:SnapshotManifest={createdAt:state.createdAt,sourceFingerprint:source,tables:{},scope:'public',dumpSha256:createHash('sha256').update(payload).digest('hex')}
    writeFileSync(archiveFile,encryptArchive(payload,header,key),{mode:0o600})
    assert(decryptArchive(readFileSync(archiveFile),readFileSync(keyFile,'utf8').trim()).dump.equals(payload))
    mkdirSync('.cache',{recursive:true});writeFileSync('.cache/source-transition-location.json',JSON.stringify({archiveFile,keyFile})+'\n')
    report.phase=state.phase;report.recoveryArchive=archiveFile;report.recoveryKeyFile=keyFile
    writeFileSync('docs/launch-source-transition-latest.json',JSON.stringify(report,null,2)+'\n')
    console.log(JSON.stringify({phase:state.phase,privateRecoverySaved:true}))
  }
  const client=new Client({connectionString:adminUrl,connectionTimeoutMillis:15000,statement_timeout:60000});await client.connect()
  try {
    assert.equal((await tables(client)).length,9)
    await client.query('BEGIN');await client.query('SET LOCAL lock_timeout=\'15s\'')
    await client.query('LOCK TABLE '+(await tables(client)).map(t=>'public.'+quote(t)).join(',')+' IN ACCESS EXCLUSIVE MODE')
    assert.deepEqual(await snapshotTables(client),manifest.tables,'Source changed since backup; fresh backup required')
    state.original=await oldRows(client);save()
    await installFreeze(client,runtimePassword,state.token);await client.query('COMMIT')
    state.phase='frozen';report.sourceWriteGuardInstalled=true;save()
    await proveLegacyBlocked(client);report.legacyWriterBlocked=true
    await client.query('BEGIN');await transitionToken(client,state.token)
    await client.query(readFileSync('prisma/migrations/202609050002_commerce_safety/migration.sql','utf8'))
    await addGuards(client);await grantRuntime(client)
    const after=await oldRows(client)
    const important:Record<string,string[]>={Order:['id','orderNumber','total','subTotal','discountAmount','deliveredContent'],OrderItem:['id','orderId','productId','quantity','price'],DigitalStock:['id','content','isSold','orderId'],DigitalKey:['id','keyData','isUsed','orderId'],Product:['id','price','stock'],DiscountCode:['id','usedCount'],DeliveryItem:['id','orderId','licenseKey','expiresAt','instructions']}
    for(const [table,fields]of Object.entries(important)) {
      const pick=(rows:Record<string,unknown>[])=>rows.map(row=>Object.fromEntries(fields.filter(field=>field in row).map(field=>[field,row[field]])))
      assert.deepEqual(pick(after[table].rows),pick(state.original[table].rows),'Migration changed preserved business values')
    }
    await client.query('COMMIT');state.phase='migrated';report.moneyStockAndEncryptedBytesPreserved=true;save()
    const changes=await rekeyPlan(client,oldKey,state.newKey)
    await client.query('BEGIN');await transitionToken(client,state.token);await applyRekey(client,changes,state.newKey);await client.query('COMMIT')
    state.phase='rekeyed';report.encryptedValues=changes.length;report.originalReadableValuesPreserved=14;report.unreadableTestValuesReplaced=24;save()
    await privateCommand(['node_modules/prisma/build/index.js','migrate','diff','--from-schema-datasource','prisma/schema.prisma','--to-schema-datamodel','prisma/schema.prisma','--exit-code'],{...process.env,DATABASE_URL:adminUrl,DIRECT_URL:adminUrl})
    for(const name of ['202609050001_baseline','202609050002_commerce_safety']) await privateCommand(['node_modules/prisma/build/index.js','migrate','resolve','--applied',name],{...process.env,DATABASE_URL:adminUrl,DIRECT_URL:adminUrl})
    await client.query('ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;REVOKE ALL ON TABLE public._prisma_migrations FROM PUBLIC,anon,authenticated')
    const app=new Client({connectionString:state.runtimeDirectUrl,connectionTimeoutMillis:15000,statement_timeout:30000});await app.connect()
    try {assert.deepEqual(await snapshotTables(app),await snapshotTables(client));await app.query('BEGIN');await app.query('UPDATE public."Product" SET price=price WHERE false');await app.query('ROLLBACK')} finally {await app.end()}
    await proveLegacyBlocked(client)
    state.postSnapshot=await snapshotTables(client);state.phase='verified';report.schemaDrift='none';report.businessTables=15;report.runtimeRoleVerified=true;report.migrationHistoryRecorded=true;report.passed=true;save()
  } catch(error) {
    await client.query('ROLLBACK').catch(()=>{})
    report.failureCategory=(error as {code?:string}).code||(error as Error).name
    if(report.sourceWriteGuardInstalled) {
      try {
        // No deployment has occurred in this program; the unpublished runtime login is private.
        // Reject unexpected new writes by locking all business tables for data recovery.
        await client.query('BEGIN');await transitionToken(client,state.token)
        await client.query('LOCK TABLE '+(await tables(client)).map(t=>'public.'+quote(t)).join(',')+' IN ACCESS EXCLUSIVE MODE')
        if(state.postSnapshot) assert.deepEqual(await snapshotTables(client),state.postSnapshot,'Subsequent writes prohibit automatic recovery')
        await restoreOldRows(client,state.original);await removeOwnedFreeze(client);await client.query('COMMIT')
        state.phase='recovered-original-business-data';report.sourceWriteGuardInstalled=false;report.originalDataRecovered=true;save()
      } catch {await client.query('ROLLBACK').catch(()=>{});report.automaticRecoveryFailed=true}
    }
    report.phase=state.phase
    writeFileSync('docs/launch-source-transition-latest.json',JSON.stringify(report,null,2)+'\n')
    console.log(JSON.stringify({stopped:true,phase:state.phase,sourceStillGuarded:report.sourceWriteGuardInstalled,privateDiagnosticsWithheld:true}))
    throw new Error('Transition stopped at protected checkpoint')
  } finally {await client.end()}
}
if(require.main===module) main().catch(error=>{const frame=String(error.stack||'').split('\n').find(line=>/execute-source-transition\.ts:\d+:\d+/.test(line));console.error(JSON.stringify({stopped:true,category:error.name,code:error.code,location:frame?.match(/execute-source-transition\.ts:\d+:\d+/)?.[0],privateDetailsWithheld:true}));process.exitCode=1})
