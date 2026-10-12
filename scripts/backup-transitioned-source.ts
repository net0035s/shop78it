import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, rmSync, realpathSync } from 'node:fs'
import { join, relative, isAbsolute } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { createBackup, restoreBackup } from './backup-archive'
import { loadTransitionState } from './execute-source-transition'
async function protect(directory:string) {
  const identity=(process.env.USERDOMAIN?process.env.USERDOMAIN+'\\':'')+process.env.USERNAME
  const child=spawn('icacls.exe',[directory,'/inheritance:r','/grant:r',identity+':(OI)(CI)F'],{stdio:'ignore',windowsHide:true})
  assert.equal(await new Promise<number|null>(ok=>child.on('close',ok)),0)
}
async function main() {
  const {state}=loadTransitionState();assert.equal(state.phase,'verified')
  assert(process.env.PG_DUMP_PATH&&process.env.PG_RESTORE_PATH&&process.env.LOCAL_EMBEDDED_POSTGRES_PATH)
  const vault=mkdtempSync(join(process.env.LOCALAPPDATA!,'Shop78itRecovery','post-transition-'));await protect(vault)
  const key=randomBytes(32).toString('hex'),keyFile=join(vault,'backup.recovery-key');writeFileSync(keyFile,key+'\n',{flag:'wx',mode:0o600})
  const {archive,manifest}=await createBackup(state.adminUrl,process.env.PG_DUMP_PATH,key)
  const archiveFile=join(process.cwd(),'backups','shop78it-post-transition-'+manifest.createdAt.replaceAll(':','-')+'.enc')
  writeFileSync(archiveFile,archive,{flag:'wx',mode:0o600})
  const directory=mkdtempSync(join(tmpdir(),'shop78it-post-transition-'));await protect(directory)
  const socket=createServer();await new Promise<void>(ok=>socket.listen(0,'127.0.0.1',ok));const port=(socket.address() as {port:number}).port;await new Promise<void>(ok=>socket.close(()=>ok()))
  const {default:EmbeddedPostgres}=await import(pathToFileURL(process.env.LOCAL_EMBEDDED_POSTGRES_PATH).href)
  const password=randomBytes(32).toString('hex')
  const cluster=new EmbeddedPostgres({databaseDir:join(directory,'cluster'),port,user:'postgres',password,persistent:true,createPostgresUser:false,initdbFlags:['--encoding=UTF8'],postgresFlags:['-h','127.0.0.1'],onLog(){},onError(){}})
  const report:any={checkedAt:manifest.createdAt,sourceReadOnly:true,scope:'public business tables, migration history, private write guard schema; excludes Auth/Storage and global role passwords',encryptedArchive:archiveFile,recoveryKeyFile:keyFile,businessTables:Object.keys(manifest.tables).length,orders:manifest.tables.Order.count,privateSchemas:manifest.privateSchemas,requiredRoles:manifest.requiredRoles,restoreVerified:false,temporaryCopyRemoved:false}
  try {
    await cluster.initialise();await cluster.start();await cluster.createDatabase('shop_restore_sandbox')
    await restoreBackup(readFileSync(archiveFile),readFileSync(keyFile,'utf8').trim(),'postgresql://postgres:'+password+'@127.0.0.1:'+port+'/shop_restore_sandbox',process.env.PG_RESTORE_PATH)
    report.restoreVerified=true
  } finally {
    await cluster.stop();const checked=realpathSync(directory),inside=relative(realpathSync(tmpdir()),checked)
    assert(!isAbsolute(inside)&&!inside.startsWith('..')&&inside.startsWith('shop78it-post-transition-'));rmSync(checked,{recursive:true})
    report.temporaryCopyRemoved=true;writeFileSync('docs/launch-post-transition-backup-latest.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))
  }
}
main().catch(()=>{console.error('Post-transition backup verification stopped; encrypted archive retained; private details withheld');process.exitCode=1})
