import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {Client} from 'pg'
import {cloudSandboxEnvironment} from './cloud-sandbox-config'
import {snapshotTables} from './backup-archive'
async function main(){
 Object.assign(process.env,cloudSandboxEnvironment());const previousFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('External calls disabled in sandbox test')}
 const {default:db}=await import('../src/lib/db');const {reserveInventory,cancelPendingOrder}=await import('../src/lib/inventory');const {assertPaymentsReady}=await import('../src/lib/payments');const {assertSafeDatabaseWrite}=await import('../src/lib/launch-readiness')
 const pg=new Client({connectionString:process.env.DIRECT_URL,connectionTimeoutMillis:15000});await pg.connect()
 const report={checkedAt:new Date().toISOString(),projectId:'acocmsdnkpjfggycsxro',productionConnected:false,realPayments:false,messagesSent:0,tests:[] as string[],originalRowsRestored:false,passed:false}
 try{
 const before=await snapshotTables(pg);assert.throws(()=>assertPaymentsReady());report.tests.push('Real payment blocked')
 assert.throws(()=>assertSafeDatabaseWrite({...process.env,DATABASE_URL:'postgresql://postgres@db.hddnabbhdjphjwjohvcg.supabase.co/postgres'}));report.tests.push('Shop database fingerprint rejected')
 const products=await db.product.findMany({orderBy:{name:'asc'}});assert.equal(products.length,3)
 for(const product of products){const sentinel=new Error('EXPECTED_ROLLBACK');try{await db.$transaction(async tx=>{
 const order=await tx.order.create({data:{orderNumber:'MOCK-ROLLBACK-'+randomUUID(),customerName:'Sandbox test',customerEmail:'sandbox@example.invalid',total:product.price,subTotal:product.price,expiresAt:new Date(Date.now()+3600000),orderItems:{create:{productId:product.id,quantity:1,price:product.price,productName:product.name,deliveryType:product.deliveryType}}}})
 await reserveInventory(tx,order.id);assert.equal((await tx.product.findUniqueOrThrow({where:{id:product.id}})).stock,product.stock-1);assert.equal((await tx.order.findUniqueOrThrow({where:{id:order.id}})).reservationActive,true)
 if(product.deliveryType==='auto')assert.equal(await tx.digitalStock.count({where:{orderId:order.id,isSold:false}}),1)
 assert.equal(await cancelPendingOrder(tx,order.id,'sandbox-test'),true);assert.equal((await tx.product.findUniqueOrThrow({where:{id:product.id}})).stock,product.stock);assert.equal(await tx.digitalStock.count({where:{orderId:order.id}}),0);assert.equal(await cancelPendingOrder(tx,order.id,'sandbox-test'),false);throw sentinel
 },{timeout:30000,maxWait:15000});throw new Error('Rollback missing')}catch(error){if(error!==sentinel)throw error};report.tests.push('Reserve/cancel/idempotency and rollback: '+product.name)}
 assert.deepEqual(await snapshotTables(pg),before);report.originalRowsRestored=true;report.passed=true
 }finally{globalThis.fetch=previousFetch;await db.$disconnect();await pg.end();writeFileSync('docs/launch-cloud-sandbox-commerce-latest.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))}
}
main().catch(()=>{console.error('Cloud sandbox test failed; private details withheld');process.exitCode=1})