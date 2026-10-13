import assert from 'node:assert/strict'
import {createServer} from 'node:net'
import {randomBytes} from 'node:crypto'
import {mkdtempSync,readFileSync,writeFileSync,realpathSync,rmSync,cpSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve,relative,isAbsolute} from 'node:path'
import {pathToFileURL} from 'node:url'
import {Client} from 'pg'
import {restoreBackup} from './backup-archive'
import {decryptTextWithKey,isEncryptedText} from '../src/lib/encryption'

async function main(){
 const report=JSON.parse(readFileSync('docs/netlify-recovery-latest.json','utf8'))
 assert.equal(report.sandboxOnly,true);assert.equal(report.databaseBackupCreated,true)
 report.databaseRestoreVerified=false;report.temporaryRestoreRemoved=false
 delete report.restoredEncryptedValuesReadable;delete report.restoreCheckedAt
 const directory=mkdtempSync(join(tmpdir(),'shop78it-netlify-restore-'))
 const listener=createServer();await new Promise<void>(done=>listener.listen(0,'127.0.0.1',done));const port=(listener.address() as {port:number}).port;await new Promise<void>(done=>listener.close(()=>done()))
 // Windows initdb re-exec cannot handle this checkout's Thai path. Run the
 // installed package and native binaries from the owned ASCII temp directory.
 cpSync(resolve('.cache/launch-postgres/node_modules'),join(directory,'node_modules'),{recursive:true})
 const {default:EmbeddedPostgres}=await import(pathToFileURL(join(directory,'node_modules/embedded-postgres/dist/index.js')).href)
 const password=randomBytes(32).toString('hex')
 const cluster=new EmbeddedPostgres({databaseDir:join(directory,'cluster'),port,user:'postgres',password,persistent:true,createPostgresUser:false,initdbFlags:['--encoding=UTF8'],postgresFlags:['-h','127.0.0.1'],onLog(){},onError(){}})
 try{
  await cluster.initialise();await cluster.start();await cluster.createDatabase('shop_restore_sandbox')
  const target='postgresql://postgres:'+password+'@127.0.0.1:'+port+'/shop_restore_sandbox'
  await restoreBackup(readFileSync(report.databaseBackup),readFileSync(report.recoveryKeyFile,'utf8').trim(),target,resolve('.cache/launch-postgres-tools/pgsql/bin/pg_restore.exe'))
  const env:Record<string,string>={};for(const l of readFileSync('.env.netlify.local','utf8').split(/\r?\n/)){const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=JSON.parse(m[2])}
  const client=new Client({connectionString:target});let encryptedValues=0
  try{
   await client.connect()
   for(const table of ['DigitalStock','DigitalKey','DeliveryItem','Order','NotificationJob']) {
    const fields=table==='DigitalStock'?['content']:table==='DigitalKey'?['keyData']:table==='Order'?['deliveredContent']:table==='NotificationJob'?['payload']:['creditCode','email','password','loginUrl','licenseKey','instructions']
    const rows=(await client.query('SELECT '+fields.map(name=>'"'+name+'"').join(',')+' FROM public."'+table+'"')).rows
    for(const row of rows)for(const value of Object.values(row))if(isEncryptedText(value)){decryptTextWithKey(value as string,env.ENCRYPTION_KEY);encryptedValues++}
   }
  }finally{await client.end()}
  report.databaseRestoreVerified=true;report.restoredEncryptedValuesReadable=encryptedValues;report.restoreCheckedAt=new Date().toISOString()
 }finally{
  await cluster.stop().catch(()=>{})
  const checked=realpathSync(directory),inside=relative(realpathSync(tmpdir()),checked)
  assert.ok(!isAbsolute(inside)&&!inside.startsWith('..')&&inside.startsWith('shop78it-netlify-restore-'))
  rmSync(checked,{recursive:true});report.temporaryRestoreRemoved=true
  writeFileSync('docs/netlify-recovery-latest.json',JSON.stringify(report,null,2));console.log(JSON.stringify({databaseRestoreVerified:report.databaseRestoreVerified,tables:report.databaseTables,orders:report.orders,encryptedValuesReadable:report.restoredEncryptedValuesReadable,sourceDataChanged:false,temporaryRestoreRemoved:true}))
 }
}
main().catch(error=>{console.error('Netlify restore rehearsal failed:',error instanceof Error?error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[private database URL]'):'unknown');process.exitCode=1})
