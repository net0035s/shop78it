import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import {PrismaClient} from '@prisma/client'
import {previewIsIsolated,databaseFingerprint} from '../src/lib/launch-readiness'
import {encryptText,decryptTextWithKey,isEncryptedText} from '../src/lib/encryption'
import {parseStockLine} from '../src/lib/commerce-rules'
import {syncAvailableStock} from '../src/lib/inventory'

async function main(){
 assert.ok(process.argv.includes('--mock-sandbox-only'),'Explicit mock sandbox apply required')
 const env=Object.fromEntries(readFileSync('.env.netlify.local','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],JSON.parse(m[2])]]:[]}))
 assert.ok(previewIsIsolated(env));assert.equal(env.PAYMENTS_ENABLED,'false');assert.equal(env.LAUNCH_APPROVED,'false')
 assert.equal(databaseFingerprint(env.DATABASE_URL),databaseFingerprint('postgresql://postgres.acocmsdnkpjfggycsxro@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'))
 Object.assign(process.env,env)
 const catalog=JSON.parse(readFileSync('docs/windows-office-catalog.json','utf8'));assert.equal(catalog.products.length,9)
 const db=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}})
 let created=0
 try{
  await db.$transaction(async tx=>{
   for(const p of catalog.products){
    const product=await tx.product.findUniqueOrThrow({where:{id:p.id}});assert.equal(product.name,p.name);assert.equal(product.deliveryType,'auto')
    const id='mock-stock-20261014-'+p.id
    const old=await tx.digitalStock.findUnique({where:{id}})
    if(old){assert.equal(old.productId,p.id);assert.ok(!old.isSold&&!old.orderId,'Existing mock stock already used or reserved; do not reuse')}
    else{
     const line=p.stockType==='license-key'?'MOCK-NOT-REAL-'+p.id.toUpperCase():JSON.stringify({email:'office365-sandbox@example.invalid',password:'MOCK-NOT-REAL-'+randomBytes(8).toString('hex'),loginUrl:'https://example.invalid/office365-sandbox'})
     const details=parseStockLine(p.stockType,line),content=encryptText(JSON.stringify(details))
     assert.ok(isEncryptedText(content));assert.deepEqual(JSON.parse(decryptTextWithKey(content,env.ENCRYPTION_KEY)),details)
     await tx.digitalStock.create({data:{id,productId:p.id,type:p.stockType,content,instruction:'ข้อมูลจำลองสำหรับทดสอบระบบร้านเท่านั้น คีย์หรือบัญชีนี้ใช้งานจริงไม่ได้',showInstruction:true,isSold:false,orderId:null}});created++
    }
    await syncAvailableStock(tx,p.id)
   }
  },{isolationLevel:'Serializable',timeout:90000,maxWait:15000})
  const rows=await db.digitalStock.findMany({where:{id:{in:catalog.products.map((p:{id:string})=>'mock-stock-20261014-'+p.id)}},include:{product:{select:{name:true,price:true,stock:true,stockStatus:true,deliveryType:true}}}})
  assert.equal(rows.length,9)
  for(const row of rows){assert.ok(!row.isSold&&!row.orderId&&isEncryptedText(row.content));const details=JSON.parse(decryptTextWithKey(row.content,env.ENCRYPTION_KEY));assert.ok(row.type==='license-key'?details.licenseKey.startsWith('MOCK-NOT-REAL-'):details.email.endsWith('@example.invalid')&&details.password.startsWith('MOCK-NOT-REAL-'));assert.ok(row.product.stock>=1);assert.equal(row.product.deliveryType,'auto')}
  const report={checkedAt:new Date().toISOString(),url:'https://shop78it.netlify.app',sandboxOnly:true,mockOnly:true,created,stockRecordsChecked:rows.length,encryptedAndReadable:true,ordersCreated:0,messagesSent:0,realPaymentsEnabled:false,products:rows.map(r=>({id:r.productId,name:r.product.name,price:Number(r.product.price),stock:r.product.stock,stockStatus:r.product.stockStatus,stockType:r.type,deliveryType:r.product.deliveryType}))}
  writeFileSync('docs/software-sandbox-stock-latest.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
 }finally{await db.$disconnect()}
}
main().catch(()=>{console.error('Mock stock fill stopped safely; no product credentials printed');process.exitCode=1})
