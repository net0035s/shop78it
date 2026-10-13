import assert from 'node:assert/strict'
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto'
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {previewIsIsolated} from '../src/lib/launch-readiness'
import {createBackup} from './backup-archive'

async function main(){
 assert.ok(process.argv.includes('--sandbox-only'))
 const environment:Record<string,string>={};for(const line of readFileSync('.env.netlify.local','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)environment[m[1]]=JSON.parse(m[2])}
 assert.ok(previewIsIsolated(environment));assert.equal(environment.PAYMENTS_ENABLED,'false')
 assert.equal(process.platform,'win32')
 const parent=join(process.env.LOCALAPPDATA!,'Shop78itRecovery');mkdirSync(parent,{recursive:true})
 const keyDirectory=mkdtempSync(join(parent,'netlify-'))
 const identity=(process.env.USERDOMAIN?process.env.USERDOMAIN+'\\':'')+process.env.USERNAME
 execFileSync('icacls.exe',[keyDirectory,'/inheritance:r','/grant:r',identity+':(OI)(CI)F'],{stdio:'ignore',windowsHide:true})
 const key=randomBytes(32),keyFile=join(keyDirectory,'netlify.recovery-key');writeFileSync(keyFile,key.toString('hex')+'\n',{flag:'wx',mode:0o600})
 const directory=resolve('backups/netlify');mkdirSync(directory,{recursive:true})
 execFileSync('icacls.exe',[directory,'/inheritance:r','/grant:r',identity+':(OI)(CI)F'],{stdio:'ignore',windowsHide:true})
 const stamp=new Date().toISOString().replaceAll(':','-')
 const magic=Buffer.from('SHOP78NETLIFY1'),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(magic)
 const plain=Buffer.from(JSON.stringify({version:1,createdAt:new Date().toISOString(),environment,deployment:JSON.parse(readFileSync('docs/netlify-deployment-latest.json','utf8'))}))
 const encrypted=Buffer.concat([cipher.update(plain),cipher.final()])
 const file=join(directory,'runtime-'+stamp+'.enc');writeFileSync(file,Buffer.concat([magic,iv,cipher.getAuthTag(),encrypted]),{flag:'wx',mode:0o600})
 const saved=readFileSync(file),decipher=createDecipheriv('aes-256-gcm',key,saved.subarray(magic.length,magic.length+12));decipher.setAAD(magic);decipher.setAuthTag(saved.subarray(magic.length+12,magic.length+28))
 const restored=JSON.parse(Buffer.concat([decipher.update(saved.subarray(magic.length+28)),decipher.final()]).toString())
 assert.deepEqual(restored.environment,environment)
 const report:any={checkedAt:new Date().toISOString(),sandboxOnly:true,runtimeBackup:file,recoveryKeyFile:keyFile,runtimeDecryptVerified:true,archiveSha256:createHash('sha256').update(saved).digest('hex'),databaseBackupCreated:false,databaseRestoreVerified:false,offDeviceBackupConfirmed:false,sourceDataChanged:false}
 try{
   const result=await createBackup(environment.DIRECT_URL,resolve('.cache/launch-postgres-tools/pgsql/bin/pg_dump.exe'),key.toString('hex'))
   const databaseFile=join(directory,'database-'+stamp+'.enc');writeFileSync(databaseFile,result.archive,{flag:'wx',mode:0o600})
   Object.assign(report,{databaseBackupCreated:true,databaseBackup:databaseFile,databaseTables:Object.keys(result.manifest.tables).length,orders:result.manifest.tables.Order.count})
 }catch{report.databaseBackupNote='Session-pool backup unavailable; runtime archive retained; no database changes made'}
 writeFileSync('docs/netlify-recovery-latest.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}
main().catch(()=>{console.error('Netlify recovery preparation failed; no private values printed');process.exitCode=1})
