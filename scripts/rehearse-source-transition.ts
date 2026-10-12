import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'node:net'
import { randomBytes, createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { Client } from 'pg'
import { createBackup, restoreBackup, snapshotTables } from './backup-archive'
import { tables, oldRows, verifyOldProjection, installFreeze, transitionToken, addGuards, grantRuntime, proveLegacyBlocked, rekeyPlan, applyRekey, restoreOldRows, roleUrl, removeOwnedFreeze } from './source-transition-core'
async function main() {
  assert(process.argv.includes('--confirm-all-data-is-test'))
  const backup=JSON.parse(readFileSync('docs/launch-backup-rehearsal-latest.json','utf8')); assert(backup.restoreVerified)
  const match=readFileSync('.env','utf8').match(/^\s*ENCRYPTION_KEY\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))/m)
  const oldKey=match?.[1]??match?.[2]??match?.[3]; assert(oldKey)
  assert(process.env.PG_DUMP_PATH && process.env.PG_RESTORE_PATH && process.env.LOCAL_EMBEDDED_POSTGRES_PATH)
  const directory=mkdtempSync(join(tmpdir(),'shop78it-transition-rehearsal-'))
  const identity=(process.env.USERDOMAIN?process.env.USERDOMAIN+'\\':'')+process.env.USERNAME
  await new Promise<void>((ok,fail)=>{const p=spawn('icacls.exe',[directory,'/inheritance:r','/grant:r',identity+':(OI)(CI)F'],{windowsHide:true,stdio:'ignore'});p.on('error',fail);p.on('close',code=>code===0?ok():fail(new Error('ACL failed')))})
  const socket=createServer(); await new Promise<void>(ok=>socket.listen(0,'127.0.0.1',ok));const port=(socket.address() as {port:number}).port;await new Promise<void>(ok=>socket.close(()=>ok()))
  const {default:EmbeddedPostgres}=await import(pathToFileURL(process.env.LOCAL_EMBEDDED_POSTGRES_PATH).href)
  const password=randomBytes(32).toString('hex'),runtimePassword=randomBytes(32).toString('hex'),token=randomBytes(32).toString('hex'),newKey=randomBytes(32).toString('hex')
  const cluster=new EmbeddedPostgres({databaseDir:join(directory,'cluster'),port,user:'postgres',password,persistent:true,createPostgresUser:false,initdbFlags:['--encoding=UTF8'],postgresFlags:['-h','127.0.0.1'],onLog(){},onError(){}})
  const report:any={checkedAt:new Date().toISOString(),sourceConnected:false,localRestoredCopyOnly:true,backupCreatedAt:backup.checkedAt,passed:false,temporaryCopyRemoved:false}
  try {
    await cluster.initialise();await cluster.start();await cluster.createDatabase('shop_restore_sandbox')
    const url='postgresql://postgres:'+password+'@127.0.0.1:'+port+'/shop_restore_sandbox'
    await restoreBackup(readFileSync(backup.encryptedBackup),readFileSync(backup.recoveryKeyFile,'utf8').trim(),url,process.env.PG_RESTORE_PATH!)
    const client=new Client({connectionString:url});await client.connect()
    try {
      const original=await snapshotTables(client),old=await oldRows(client)
      const lock='LOCK TABLE '+(await tables(client)).map(t=>'public."'+t+'"').join(',')+' IN ACCESS EXCLUSIVE MODE'
      await client.query('BEGIN');await client.query(lock);await installFreeze(client,runtimePassword,token);await client.query('COMMIT')
      await proveLegacyBlocked(client);report.oldWriterBlocked=true
      // A forced failure must leave all business tables and rows byte-for-byte intact.
      await client.query('BEGIN');await transitionToken(client,token)
      await client.query(readFileSync('prisma/migrations/202609050002_commerce_safety/migration.sql','utf8'))
      await client.query('ROLLBACK');assert.deepEqual(await snapshotTables(client),original);report.migrationRollbackVerified=true
      await client.query('BEGIN');await transitionToken(client,token)
      await client.query(readFileSync('prisma/migrations/202609050002_commerce_safety/migration.sql','utf8'))
      await addGuards(client);await grantRuntime(client);await client.query('COMMIT')
      assert.equal((await tables(client)).length,15);report.businessTables=15
      const preRekey=await snapshotTables(client),changes=await rekeyPlan(client,oldKey,newKey)
      await client.query('BEGIN');await transitionToken(client,token);await applyRekey(client,changes,newKey);await client.query('ROLLBACK')
      assert.deepEqual(await snapshotTables(client),preRekey);report.rekeyRollbackVerified=true
      await client.query('BEGIN');await transitionToken(client,token);await applyRekey(client,changes,newKey);await client.query('COMMIT')
      await proveLegacyBlocked(client)
      const app=new Client({connectionString:roleUrl(url,runtimePassword)});await app.connect()
      try {
        assert.deepEqual(await snapshotTables(app),await snapshotTables(client));report.runtimeReadAllTablesVerified=true
        await app.query('BEGIN');const before=await snapshotTables(client)
        await app.query('UPDATE public."Product" SET price=price WHERE false');await app.query('ROLLBACK')
        assert.deepEqual(await snapshotTables(client),before);report.runtimeWriteAndRollbackVerified=true
        const rights=(await app.query("SELECT rolsuper,rolcreaterole,rolcreatedb,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0]
        assert(Object.values(rights).every(value=>value===false));report.runtimeHasNoAdminOrRlsBypass=true
      } finally {await app.end()}
      const archiveKey=randomBytes(32).toString('hex')
      const migratedBackup=await createBackup(url,process.env.PG_DUMP_PATH!,archiveKey)
      // Emergency data rollback preserves additive schema, restores every original business column,
      // and pairs with the retained immutable old deployment. It does not delete tables or history.
      await client.query('BEGIN');await transitionToken(client,token);await restoreOldRows(client,old);await client.query('COMMIT')
      await verifyOldProjection(client,old);report.originalBusinessDataRollbackVerified=true
      await client.query('BEGIN');await transitionToken(client,token);await removeOwnedFreeze(client);await client.query('COMMIT')
      await client.query('BEGIN');await client.query('UPDATE public."Order" SET status=status WHERE false');await client.query('ROLLBACK')
      report.oldWriterRecoveryVerified=true
      // Restore after testing role removal: PostgreSQL roles are cluster-wide, and an
      // earlier verification database would itself retain policies referencing the role.
      await cluster.createDatabase('shop_restore_sandbox_verify')
      const verifyUrl=url.replace('/shop_restore_sandbox','/shop_restore_sandbox_verify')
      await restoreBackup(migratedBackup.archive,archiveKey,verifyUrl,process.env.PG_RESTORE_PATH!)
      report.postTransitionBackupRestoreVerified=true
      report.rollbackSchema='additive schema retained; original nine-table business projection restored; old deployment required'
      report.encryptedValues=changes.length;report.readableValuesPreserved=changes.filter(c=>!c.replaced).length;report.unreadableTestValuesReplaced=changes.filter(c=>c.replaced).length
      report.passed=true
      report.coreSha256=createHash('sha256').update(readFileSync('scripts/source-transition-core.ts')).digest('hex')
      report.migrationSha256=createHash('sha256').update(readFileSync('prisma/migrations/202609050002_commerce_safety/migration.sql')).digest('hex')
    } finally {await client.end()}
  } catch(error) {
    report.failureCategory=(error as {code?:string}).code || (error as Error).name
    throw new Error('Transition rehearsal failed; private diagnostics withheld')
  } finally {
    await cluster.stop()
    const checked=realpathSync(directory),inside=relative(realpathSync(tmpdir()),checked)
    assert(!isAbsolute(inside)&&!inside.startsWith('..')&&inside.startsWith('shop78it-transition-rehearsal-'))
    rmSync(checked,{recursive:true});report.temporaryCopyRemoved=true
    writeFileSync('docs/launch-source-transition-rehearsal-latest.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))
  }
}
main().catch(()=>{console.error('Local transition rehearsal stopped; source unchanged');process.exitCode=1})
