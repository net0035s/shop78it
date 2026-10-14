import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {PrismaClient} from '@prisma/client'
import {previewIsIsolated,databaseFingerprint} from '../src/lib/launch-readiness'
import {verifyNetlifyAssets} from './netlify-asset-check'

async function main(){
 assert.ok(process.argv.includes('--apply-sandbox'))
 const env=Object.fromEntries(readFileSync('.env.netlify.local','utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],JSON.parse(m[2])]]:[]}))
 assert.ok(previewIsIsolated(env));assert.equal(env.PAYMENTS_ENABLED,'false')
 assert.equal(databaseFingerprint(env.DATABASE_URL),databaseFingerprint('postgresql://postgres.acocmsdnkpjfggycsxro@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'))
 const catalog=JSON.parse(readFileSync('docs/windows-office-catalog.json','utf8')),base='https://shop78it.netlify.app'
 assert.equal(catalog.target,'shop78it.netlify.app');assert.equal(catalog.products.length,9)
 await Promise.all(catalog.products.map(async(p:{id:string,image:string})=>{
  assert.equal(p.image,'/images/products/software/'+p.id+'.webp')
  const r=await fetch(base+p.image,{signal:AbortSignal.timeout(45000)});assert.equal(r.status,200);assert.ok(r.headers.get('content-type')?.includes('image/webp'));assert.ok((await r.arrayBuffer()).byteLength>1000)
 }))
 const db=new PrismaClient({datasources:{db:{url:env.DATABASE_URL}}})
 try{
  const unchanged=(p:Record<string,unknown>)=>Object.fromEntries(Object.entries(p).filter(([k])=>k!=='image'))
  await db.$transaction(async tx=>{
   for(const p of catalog.products){const before=await tx.product.findUniqueOrThrow({where:{id:p.id}});assert.equal(before.name,p.name);const after=await tx.product.update({where:{id:p.id},data:{image:p.image}});assert.deepEqual(unchanged(after),unchanged(before))}
  },{isolationLevel:'Serializable',timeout:60000,maxWait:15000})
  const products=await db.product.findMany({where:{id:{in:catalog.products.map((p:{id:string})=>p.id)}},select:{id:true,name:true,image:true,price:true,stock:true,deliveryType:true}})
  assert.equal(products.length,9)
  for(const p of products)assert.equal(p.image,catalog.products.find((c:{id:string})=>c.id===p.id).image)
  const htmlResponse=await fetch(base,{signal:AbortSignal.timeout(45000)});assert.equal(htmlResponse.status,200);const html=await htmlResponse.text()
  for(const p of products){assert.ok(html.includes('product-card-'+p.id));assert.ok(html.includes(encodeURIComponent(p.image))||html.includes(p.image))}
  const assets=await verifyNetlifyAssets(base)
  const report={checkedAt:new Date().toISOString(),url:base,sandboxOnly:true,imagesAdded:products.length,allImagesReachable:true,storefrontImageReferencesVerified:true,...assets,pricesStockAndDeliveryPreserved:true,ordersChanged:0,messagesSent:0,products:products.map(p=>({...p,price:Number(p.price)}))}
  writeFileSync('docs/software-cover-images-latest.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
 }finally{await db.$disconnect()}
}
main().catch(()=>{console.error('Software image update or verification stopped; private values withheld');process.exitCode=1})
