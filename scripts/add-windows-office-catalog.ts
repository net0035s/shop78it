import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {PrismaClient} from '@prisma/client'
import {previewIsIsolated,databaseFingerprint} from '../src/lib/launch-readiness'
import {productData} from '../src/lib/admin-product'

async function main(){
 assert.ok(process.argv.includes('--apply-sandbox'),'Explicit sandbox apply required')
 const env=Object.fromEntries(readFileSync('.env.netlify.local','utf8').split(/\r?\n/).flatMap(line=>{const m=line.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],JSON.parse(m[2])]]:[]}))
 assert.ok(previewIsIsolated(env));assert.equal(env.PAYMENTS_ENABLED,'false')
 assert.equal(databaseFingerprint(env.DATABASE_URL),databaseFingerprint('postgresql://postgres.acocmsdnkpjfggycsxro@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'))
 const catalog=JSON.parse(readFileSync('docs/windows-office-catalog.json','utf8'))
 assert.equal(catalog.target,'shop78it.netlify.app');assert.equal(catalog.products.length,9)
 const db=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}})
 try{
  const before=await db.product.findMany({orderBy:{id:'asc'}})
  const ordersBefore=await db.order.count(),stocksBefore=await db.digitalStock.count()
  writeFileSync('.cache/windows-office-catalog-before.json',JSON.stringify({capturedAt:new Date().toISOString(),products:before,orders:ordersBefore,stockRecords:stocksBefore}))
  let created=0
  await db.$transaction(async tx=>{
   const categories=new Map<string,string>()
   for(const c of catalog.categories){const existing=await tx.category.findUnique({where:{slug:c.slug}});const category=existing??await tx.category.create({data:c});categories.set(c.slug,category.id)}
   for(const p of catalog.products){
    const existing=await tx.product.findFirst({where:{OR:[{id:p.id},{name:p.name}]}})
    if(existing){assert.equal(existing.id,p.id,'Unexpected existing product; no overwrite');assert.equal(existing.name,p.name);assert.equal(Number(existing.price),p.price);assert.equal(existing.deliveryType,'auto');continue}
    const data=productData({name:p.name,description:p.description,price:p.price,category:p.category,deliveryType:'auto',image:'/images/products/placeholder.png',tags:p.stockType==='login-info'?'Office 365,บัญชี,1 ปี':'License Key,1 เครื่อง',deliveryInfo:p.stockType==='login-info'?'ส่งอีเมลและรหัสผ่านอัตโนมัติหลังยืนยันการชำระเงิน':'ส่งคีย์อัตโนมัติหลังยืนยันการชำระเงิน'})
    await tx.product.create({data:{id:p.id,...data,categoryId:categories.get(p.category),stock:0,stockStatus:'out-of-stock'}});created++
   }
  },{isolationLevel:'Serializable',timeout:60000,maxWait:15000})
  const old=await db.product.findMany({where:{id:{in:before.map(p=>p.id)}},orderBy:{id:'asc'}})
  assert.deepEqual(old,before);assert.equal(await db.order.count(),ordersBefore);assert.equal(await db.digitalStock.count(),stocksBefore)
  const added=await db.product.findMany({where:{id:{in:catalog.products.map((p:{id:string})=>p.id)}},orderBy:{id:'asc'}})
  assert.equal(added.length,9)
  for(const p of added){const expected=catalog.products.find((e:{id:string})=>e.id===p.id);assert.equal(Number(p.price),expected.price);assert.equal(p.deliveryType,'auto');assert.equal(p.stock,0);assert.equal(p.stockStatus,'out-of-stock');assert.equal(p.description,expected.description)}
  const report={checkedAt:new Date().toISOString(),url:'https://shop78it.netlify.app',sandboxOnly:true,created,products:added.map(p=>({id:p.id,name:p.name,price:Number(p.price),deliveryType:p.deliveryType,stock:p.stock,stockStatus:p.stockStatus})),existingProductsPreserved:true,ordersPreserved:true,stockRecordsPreserved:true,realPaymentsEnabled:false,credentialsAdded:0,messagesSent:0}
  writeFileSync('docs/windows-office-catalog-added.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
 }finally{await db.$disconnect()}
}
main().catch(()=>{console.error('Catalog import stopped safely; no private values printed');process.exitCode=1})
