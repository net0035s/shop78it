import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdtempSync,rmSync,realpathSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,relative,isAbsolute} from 'node:path'
import {randomBytes,createHash} from 'node:crypto'
import {createServer} from 'node:net'
import {pathToFileURL} from 'node:url'
import {spawn} from 'node:child_process'
import {Client} from 'pg'
import {restoreBackup,snapshotTables} from './backup-archive'
import {decryptTextWithKey,encryptTextWithKey,isEncryptedText,DELIVERY_SECRET_FIELDS} from '../src/lib/encryption'
const secretFields:Record<string,readonly string[]>={DigitalStock:['content'],DigitalKey:['keyData'],Order:['deliveredContent'],DeliveryItem:DELIVERY_SECRET_FIELDS}
const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"'
async function protect(directory:string){if(process.platform!=='win32')return;await new Promise<void>((ok,fail)=>{const identity=(process.env.USERDOMAIN?process.env.USERDOMAIN+'\\':'')+process.env.USERNAME;const p=spawn('icacls.exe',[directory,'/inheritance:r','/grant:r',identity+':(OI)(CI)F'],{windowsHide:true,stdio:'ignore'});p.on('error',fail);p.on('close',c=>c===0?ok():fail(new Error('Temporary protection failed')))})}
async function invariant(client:Client){const names=(await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows;const result:Record<string,string>={};for(const {table_name:table}of names){const rows=(await client.query('SELECT * FROM public.'+quote(table)+' ORDER BY id')).rows;for(const row of rows)for(const field of secretFields[table]??[])delete row[field];result[table]=createHash('sha256').update(JSON.stringify(rows)).digest('hex')}return result}
async function main(){
 assert.ok(process.argv.includes('--confirm-all-data-is-test'),'Explicit test-data confirmation required')
 const backup=JSON.parse(readFileSync('docs/launch-backup-rehearsal-latest.json','utf8'));assert.equal(backup.restoreVerified,true)
 const m=readFileSync('.env','utf8').match(/^\s*ENCRYPTION_KEY\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))/m);const oldKey=m?.[1]??m?.[2]??m?.[3];assert.ok(oldKey)
 const newKey=randomBytes(32).toString('hex') // Rehearsal only. Never persisted or used on Vercel.
 const directory=mkdtempSync(join(tmpdir(),'shop78it-rekey-rehearsal-'));await protect(directory)
 const server=createServer();await new Promise<void>(ok=>server.listen(0,'127.0.0.1',ok));const port=(server.address() as {port:number}).port;await new Promise<void>(ok=>server.close(()=>ok()))
 const {default:EmbeddedPostgres}=await import(pathToFileURL(process.env.LOCAL_EMBEDDED_POSTGRES_PATH||join(tmpdir(),'shop78it-pg-node-20261011/node_modules/embedded-postgres/dist/index.js')).href)
 const password=randomBytes(24).toString('hex');const cluster=new EmbeddedPostgres({databaseDir:join(directory,'cluster'),port,user:'postgres',password,persistent:true,createPostgresUser:false,initdbFlags:['--encoding=UTF8'],postgresFlags:['-h','127.0.0.1'],onLog(){},onError(){}})
 const report:any={checkedAt:new Date().toISOString(),backupCreatedAt:backup.checkedAt,scope:'local restored copy only; all source commerce data confirmed test by owner',productionConnected:false,productionKeyChanged:false,productionDataChanged:false,newKeyPersisted:false,temporaryCopyRemoved:false,passed:false}
 try{
 await cluster.initialise();await cluster.start();await cluster.createDatabase('shop_restore_sandbox')
 const url='postgresql://postgres:'+password+'@127.0.0.1:'+port+'/shop_restore_sandbox';assert.equal(new URL(url).hostname,'127.0.0.1')
 const restoreTool=process.env.PG_RESTORE_PATH;assert.ok(restoreTool,'Explicit restore tool required')
 await restoreBackup(readFileSync(backup.encryptedBackup),readFileSync(backup.recoveryKeyFile,'utf8').trim(),url,restoreTool);report.restoreVerified=true
 const client=new Client({connectionString:url});await client.connect()
 try{
 const before=await snapshotTables(client);const preserved=await invariant(client)
 const changes:Array<{table:string,id:string,field:string,previous:string,next:string,plaintext:string,replaced:boolean}>=[];let readable=0,unreadable=0
 for(const [table,fields]of Object.entries(secretFields)){const rows=(await client.query('SELECT id,'+fields.map(quote).join(',')+' FROM public.'+quote(table)+' ORDER BY id')).rows;for(const row of rows)for(const field of fields){const value=row[field];if(!isEncryptedText(value))continue;let plaintext:string,replaced=false;try{plaintext=decryptTextWithKey(value,oldKey,{allowUnsafeDefault:true});readable++}catch{unreadable++;replaced=true;const marker='MOCK-REKEY-'+row.id;plaintext=table==='DigitalStock'?JSON.stringify({licenseKey:marker,expiresAt:'2099-12-31',instructions:'Sandbox replacement; no original data recovered'}):field==='licenseKey'?marker:field==='expiresAt'?'2099-12-31':'Sandbox replacement; no original data recovered'}changes.push({table,id:row.id,field,previous:value,next:encryptTextWithKey(plaintext,newKey),plaintext,replaced})}}
 assert.equal(readable,14);assert.equal(unreadable,24);assert.equal(changes.length,38);report.plan={originalValuesPreserved:readable,unreadableTestValuesReplaced:unreadable,totalEncryptedValues:changes.length,tableCounts:Object.fromEntries(Object.entries(before).map(([t,s])=>[t,s.count]))}
 const apply=async()=>{for(const c of changes){const r=await client.query('UPDATE public.'+quote(c.table)+' SET '+quote(c.field)+'=$1 WHERE id=$2 AND '+quote(c.field)+'=$3',[c.next,c.id,c.previous]);assert.equal(r.rowCount,1)}}
 await client.query('BEGIN');await apply();await client.query('ROLLBACK');assert.deepEqual(await snapshotTables(client),before);report.rollbackVerified=true
 await client.query('BEGIN');await apply();assert.deepEqual(await invariant(client),preserved);for(const c of changes){const row=(await client.query('SELECT '+quote(c.field)+' AS value FROM public.'+quote(c.table)+' WHERE id=$1',[c.id])).rows[0];assert.equal(decryptTextWithKey(row.value,newKey),c.plaintext);assert.throws(()=>decryptTextWithKey(row.value,oldKey,{allowUnsafeDefault:true}))}await client.query('COMMIT')
 report.newKeyReadable=changes.length;report.originalReadablePlaintextPreserved=true;report.allNonSecretColumnsAndRowsUnchanged=true;report.soldFlagsOrderLinksMoneyStatusesPreserved=true
 const after=await snapshotTables(client);assert.deepEqual(Object.fromEntries(Object.entries(after).map(([t,s])=>[t,s.count])),report.plan.tableCounts)
 const fk=(await client.query('SELECT count(*)::int AS invalid FROM public."DigitalStock" s LEFT JOIN public."Order" o ON o.id=s."orderId" WHERE s."orderId" IS NOT NULL AND o.id IS NULL')).rows[0].invalid;assert.equal(fk,0);report.stockOrderRelationsValid=true
 report.passed=true
 }finally{await client.end()}
 }finally{await cluster.stop();const inside=relative(realpathSync(tmpdir()),realpathSync(directory));assert.ok(!isAbsolute(inside)&&!inside.startsWith('..')&&inside.startsWith('shop78it-rekey-rehearsal-'));rmSync(realpathSync(directory),{recursive:true});report.temporaryCopyRemoved=true;writeFileSync('docs/launch-test-data-rekey-rehearsal-latest.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))}
}
main().catch(()=>{console.error('Test-data rekey rehearsal failed; private details withheld; production untouched');process.exitCode=1})
