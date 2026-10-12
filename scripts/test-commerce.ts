import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { sandboxDatabase } from './sandbox-db'
import { calculateDiscount, normalizeCart, parseStockLine, cents, bangkokDay, expiry } from '../src/lib/commerce-rules'

async function main() {
 // This runner never loads .env. Database and credentials are replaced before application imports.
 const sandbox=await sandboxDatabase()
 Object.assign(process.env,{NODE_ENV:'test',APP_MODE:'sandbox',ORDERS_ENABLED:'true',VERCEL_ENV:'development'})
 process.env.DATABASE_URL=sandbox.url;process.env.DIRECT_URL=sandbox.url
 process.env.ENCRYPTION_KEY=randomBytes(32).toString('hex');process.env.PAYMENTS_ENABLED='true'
 for(const key of ['EMAIL_USER','EMAIL_PASS','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','TMN_RECEIVE_PHONE','SLIPOK_API_KEY','SLIPOK_BRANCH_ID']) process.env[key]=''
 const realFetch=globalThis.fetch
 globalThis.fetch=async()=>{throw Error('External network prohibited by test runner')}
 const {default:db}=await import('../src/lib/db')
 const {encryptText,decryptText}=await import('../src/lib/encryption')
 const {transaction}=await import('../src/lib/transactions')
 const {reserveInventory,cancelPendingOrder}=await import('../src/lib/inventory')
 const {startPayment,recordPayment,reviewPayment}=await import('../src/lib/payments')
 const {fulfillPaidOrder}=await import('../src/lib/order-fulfillment')
 const {orderSummary,orderInclude}=await import('../src/lib/order-summary')
 const {requireOrderAccess,createOrderSession,setOrderCookie}=await import('../src/lib/order-access')
 const {updateAdminOrder}=await import('../src/lib/admin-orders')
 const {POST:createOrder,GET:readOrder}=await import('../src/app/api/orders/route')
 const {jsonUtf8}=await import('../src/lib/json-response')
 let passed=0
 async function test(name:string,fn:()=>unknown){await fn();passed++;console.log('PASS '+name)}
 const req=(body:any)=>new Request('http://localhost/api/orders',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify(body)})
 try {
  await test('money, category coupon, invalid quantities, stock parser and Bangkok boundaries',()=>{
   assert.equal(cents(10.25),1025)
   for(const value of [null,undefined,'',true])assert.throws(()=>cents(value))
   assert.deepEqual(normalizeCart([{productId:'a',quantity:2},{productId:'a',quantity:3}]),[{productId:'a',quantity:5}])
   for(const quantity of [-1,0,0.5,101])assert.throws(()=>normalizeCart([{productId:'a',quantity}]))
   const d={discountType:'PERCENT',discountValue:50,isActive:true,maxUses:1,usedCount:0,minPurchaseAmount:0,applicableCategoryId:'cat'}
   assert.deepEqual(calculateDiscount([{product:{price:100,categoryId:'cat'},quantity:1},{product:{price:900,categoryId:'other'},quantity:1}],d),{subtotal:100000,discountAmount:5000,total:95000})
   assert.throws(()=>calculateDiscount([{product:{price:100},quantity:1}],{...d,usedCount:1}))
   assert.deepEqual(parseStockLine('login-info','test@example.com|p:a:ss|https://example.com:8443/path'),{email:'test@example.com',password:'p:a:ss',loginUrl:'https://example.com:8443/path'})
   assert.throws(()=>parseStockLine('login-info','test@example.com:password'))
   assert.throws(()=>parseStockLine('login-link','javascript:alert(1)'))
   assert.equal(bangkokDay(new Date('2026-09-04T18:00:00Z')).toISOString(),'2026-09-04T17:00:00.000Z')
   assert.equal(expiry({createdAt:'2026-09-05T00:00:00Z'}).toISOString(),'2026-09-05T01:00:00.000Z')
  })
  const category=await db.category.create({data:{name:'Sandbox',slug:'sandbox'}})
  async function product(type='auto',stock=3,price=10.25){
   const p=await db.product.create({data:{name:'Sandbox '+randomUUID(),description:'mock only',price,image:'/images/products/placeholder.png',category:category.slug,categoryId:category.id,stock,stockStatus:'in-stock',tags:'',deliveryType:type}})
   if(type==='auto')for(let i=0;i<stock;i++)await db.digitalStock.create({data:{productId:p.id,type:'license-key',content:encryptText(JSON.stringify({licenseKey:'MOCK-'+randomUUID(),instructions:'hidden'})),showInstruction:false}})
   return p
  }
  async function order(p:any,qty=1){
   return transaction(async tx=>{
    const o=await tx.order.create({data:{orderNumber:'TEST-'+randomUUID(),customerName:'Sandbox',customerEmail:'sandbox@example.invalid',total:Number(p.price)*qty,expiresAt:new Date(Date.now()+3600000),orderItems:{create:{productId:p.id,quantity:qty,price:p.price,productName:p.name,productImage:p.image,deliveryType:p.deliveryType}}}})
    await reserveInventory(tx,o.id);return o
   })
  }
  const p=await product(),o=await order(p)
  await test('reservation excludes keys from available count without marking sold',async()=>{
   assert.equal(await db.digitalStock.count({where:{productId:p.id,isSold:false,orderId:null}}),2)
   assert.equal(await db.digitalStock.count({where:{orderId:o.id,isSold:false}}),1)
  })
  await test('order number alone cannot access credentials; scoped cookie can',async()=>{
   await assert.rejects(()=>requireOrderAccess(new Request('http://localhost'),o.orderNumber))
   const token=await transaction(tx=>createOrderSession(tx,o.id))
   const response=setOrderCookie(jsonUtf8({}),o.orderNumber,token)
   const request=new Request('http://localhost',{headers:{cookie:response.headers.get('set-cookie')!.split(';')[0]}})
   assert.equal((await requireOrderAccess(request,o.orderNumber)).id,o.id)
  })
  let attemptId=''
  await test('concurrent payment requests claim an order once',async()=>{
   const results=await Promise.allSettled([startPayment(o.id,'slipok','mock-a'),startPayment(o.id,'truemoney','mock-b')])
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
   attemptId=(results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>).value.attempt.id
   assert.equal(await db.paymentAttempt.count({where:{orderId:o.id}}),1)
  })
  await test('unknown result stays locked and expiry cannot release stock',async()=>{
   await reviewPayment(attemptId,'mock timeout')
   assert.equal((await db.order.findUniqueOrThrow({where:{id:o.id}})).status,'payment_review')
   assert.equal(await transaction(tx=>cancelPendingOrder(tx,o.id)),false)
   await assert.rejects(()=>startPayment(o.id,'slipok','mock-retry'))
   assert.equal(await db.digitalStock.count({where:{orderId:o.id}}),1)
  })
  await test('verified payment is durable before delivery and rejects wrong amount',async()=>{
   await assert.rejects(()=>recordPayment(attemptId,'slipok:mock-ref',99))
   await recordPayment(attemptId,'slipok:mock-ref',10.25)
   assert.equal((await db.order.findUniqueOrThrow({where:{id:o.id}})).status,'paid')
   assert.equal((await db.paymentAttempt.findUniqueOrThrow({where:{id:attemptId}})).status,'verified')
  })
  await test('concurrent fulfillment creates one delivery and notification; hidden instructions stay hidden',async()=>{
   await Promise.all([fulfillPaidOrder(o.id),fulfillPaidOrder(o.id)])
   assert.equal(await db.deliveryItem.count({where:{orderId:o.id}}),1)
   assert.equal(await db.notificationJob.count({where:{orderId:o.id,kind:'receipt'}}),1)
   const summary=orderSummary(await db.order.findUniqueOrThrow({where:{id:o.id},include:orderInclude}))
   assert.equal(summary.deliveryItems.length,1);assert.equal(summary.deliveryItems[0].showInstruction,false)
   assert.equal(summary.deliveryItems[0].instructions,undefined)
   await db.product.update({where:{id:p.id},data:{price:200,name:'Changed'}})
   const updated=orderSummary(await db.order.findUniqueOrThrow({where:{id:o.id},include:orderInclude}))
   assert.equal(updated.items[0].product.price,10.25);assert.equal(updated.items[0].product.name,p.name)
  })
  await test('paid orders cannot be reset or cancelled by admin',async()=>{
   await assert.rejects(()=>updateAdminOrder(o.id,{status:'pending'},'sandbox-admin'))
   await assert.rejects(()=>updateAdminOrder(o.id,{status:'cancelled'},'sandbox-admin'))
  })
  await test('manual stock is decremented once and cancelled holds restored once',async()=>{
   const p=await product('manual',2),o=await order(p)
   await transaction(tx=>reserveInventory(tx,o.id))
   assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,1)
   assert.equal(await transaction(tx=>cancelPendingOrder(tx,o.id)),true)
   assert.equal(await transaction(tx=>cancelPendingOrder(tx,o.id)),false)
   assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,2)
  })
  await test('manual order remains deliverable and complete content is visible',async()=>{
   const p=await product('manual',1),o=await order(p),a=await startPayment(o.id,'slipok','manual-key')
   await recordPayment(a.attempt.id,'slipok:manual-ref',10.25);await fulfillPaidOrder(o.id)
   assert.equal((await db.order.findUniqueOrThrow({where:{id:o.id}})).status,'needs_manual_delivery')
   await assert.rejects(()=>updateAdminOrder(o.id,{status:'completed'},'sandbox-admin'))
   await updateAdminOrder(o.id,{status:'completed',deliveredContent:'MOCK MANUAL CONTENT',sendEmailNotification:true},'sandbox-admin')
   const saved=await db.order.findUniqueOrThrow({where:{id:o.id},include:orderInclude})
   assert.notEqual(saved.deliveredContent,'MOCK MANUAL CONTENT')
   assert.equal(orderSummary(saved).deliveredContent,'MOCK MANUAL CONTENT')
  })
  await test('duplicate product rows cannot bypass stock limits; transaction rolls back',async()=>{
   const p=await product('auto',1)
   const response=await createOrder(req({items:[{productId:p.id,quantity:1},{productId:p.id,quantity:1}],customer:{name:'Sandbox',email:'sandbox@example.invalid'}}))
   assert.equal(response.status,409)
   assert.equal(await db.digitalStock.count({where:{productId:p.id,orderId:null}}),1)
  })
  await test('coupon maximum includes pending reservations and cancellation returns its slot',async()=>{
   const p=await product('manual',5,100),coupon=await db.discountCode.create({data:{code:'LIMIT',discountType:'FIXED',discountValue:10,maxUses:1}})
   const body={items:[{productId:p.id,quantity:1}],customer:{name:'Sandbox',email:'sandbox@example.invalid'},discountCode:coupon.code}
   const responses=await Promise.all([createOrder(req(body)),createOrder(req(body))])
   assert.equal(responses.filter(r=>r.status===200).length,1)
   assert.equal((await db.discountCode.findUniqueOrThrow({where:{id:coupon.id}})).usedCount,1)
   const held=await db.order.findFirstOrThrow({where:{discountCode:'LIMIT'}})
   await transaction(tx=>cancelPendingOrder(tx,held.id))
   assert.equal((await db.discountCode.findUniqueOrThrow({where:{id:coupon.id}})).usedCount,0)
  })
  await test('zero-total order completes without payment provider and has an access cookie',async()=>{
   const p=await product('auto',1,0)
   const response=await createOrder(req({items:[{productId:p.id,quantity:1}],customer:{name:'Sandbox',email:'sandbox@example.invalid'}}))
   assert.equal(response.status,200);assert.ok(response.headers.get('set-cookie'))
   const b=await response.json();assert.equal(b.data.status,'completed');assert.equal(b.data.total,0)
   const publicResponse=await readOrder(new Request('http://localhost/api/orders?orderNumber='+b.data.orderNumber))
   assert.equal(publicResponse.status,403)
  })
  await test('payment reference cannot pay two orders',async()=>{
   const p=await product(),o=await order(p),a=await startPayment(o.id,'slipok','duplicate-reference')
   await assert.rejects(()=>recordPayment(a.attempt.id,'slipok:mock-ref',10.25))
   assert.equal((await db.order.findUniqueOrThrow({where:{id:o.id}})).status,'payment_processing')
  })
  await test('encryption round trip uses temporary key only',()=>assert.equal(decryptText(encryptText('sandbox only')),'sandbox only'))
  await test('provider timeout after redeem stays locked, blocks a second redemption',async()=>{
   const {handleTrueMoney}=await import('../src/lib/payment-handlers')
   process.env.TMN_RECEIVE_PHONE='0800000000'
   const p=await product(),o=await order(p)
   const token=await transaction(tx=>createOrderSession(tx,o.id))
   const cookie=setOrderCookie(jsonUtf8({}),o.orderNumber,token).headers.get('set-cookie')!.split(';')[0]
   let redemptions=0
   globalThis.fetch=async(input)=>{if(String(input).endsWith('/verify'))return Response.json({status:{code:'SUCCESS'},data:{voucher:{member:1,amount_baht:'10.25'}}});redemptions++;throw Error('MOCK timeout after redeem')}
   const request=()=>new Request('http://localhost/api/payment/truemoney',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json',cookie},body:JSON.stringify({orderId:o.orderNumber,voucherLink:'mockvoucher123456789'})})
   assert.equal((await handleTrueMoney(request())).status,202)
   assert.equal((await db.order.findUniqueOrThrow({where:{id:o.id}})).status,'payment_review')
   assert.equal((await handleTrueMoney(request())).status,409);assert.equal(redemptions,1)
   globalThis.fetch=async()=>{throw Error('External network prohibited by test runner')}
  })
  await test('provider success records payment before fulfillment and returns one delivery',async()=>{
   const {handleTrueMoney}=await import('../src/lib/payment-handlers')
   const p=await product(),o=await order(p),token=await transaction(tx=>createOrderSession(tx,o.id))
   const cookie=setOrderCookie(jsonUtf8({}),o.orderNumber,token).headers.get('set-cookie')!.split(';')[0]
   globalThis.fetch=async(input)=>Response.json(String(input).endsWith('/verify')?{status:{code:'SUCCESS'},data:{voucher:{member:1,amount_baht:'10.25'}}}:{status:{code:'SUCCESS'},data:{my_ticket:{amount_baht:'10.25'}}})
   const r=await handleTrueMoney(new Request('http://localhost/api/payment/truemoney',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json',cookie},body:JSON.stringify({orderId:o.orderNumber,voucherLink:'mocksucceeded123456'})}))
   assert.equal(r.status,200);assert.equal((await r.json()).data.deliveryItems.length,1)
   assert.equal(await db.paymentAttempt.count({where:{orderId:o.id,status:'verified'}}),1)
   globalThis.fetch=async()=>{throw Error('External network prohibited by test runner')}
  })
  await test('private access link is single use; changing customer email revokes access',async()=>{
   const {POST:access}=await import('../src/app/api/orders/access/route')
   const {newToken,tokenHash}=await import('../src/lib/order-access')
   const token=newToken()
   await db.orderAccessChallenge.create({data:{orderId:o.id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+60000)}})
   const response=await access(req({token}));assert.equal(response.status,200)
   assert.equal((await access(req({token}))).status,403)
   const cookie=response.headers.get('set-cookie')!.split(';')[0]
   await updateAdminOrder(o.id,{customerEmail:'changed@example.invalid'},'sandbox-admin')
   await assert.rejects(()=>requireOrderAccess(new Request('http://localhost',{headers:{cookie}}),o.orderNumber))
  })
  await test('malformed JSON, oversized input and foreign origins are rejected',async()=>{
   const {readJson,sameOrigin}=await import('../src/lib/server-guards')
   assert.throws(()=>sameOrigin(new Request('http://localhost',{headers:{origin:'https://evil.example'}})))
   await assert.rejects(()=>readJson(new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:'{' })))
   await assert.rejects(()=>readJson(req({payload:'x'.repeat(33000)})))
  })
  await test('expiry requires cron authentication and never releases paid stock',async()=>{
   const {maintenance}=await import('../src/lib/maintenance')
   process.env.CRON_SECRET='mock-cron'
   assert.equal((await maintenance(new Request('http://localhost'))).status,401)
   const p=await product('manual',2),old=await order(p)
   await db.order.update({where:{id:old.id},data:{expiresAt:new Date(Date.now()-1000)}})
   assert.equal((await maintenance(new Request('http://localhost',{headers:{authorization:'Bearer mock-cron'}}))).status,200)
   assert.equal((await db.order.findUniqueOrThrow({where:{id:old.id}})).status,'cancelled')
   assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,2)
   assert.equal(await db.digitalStock.count({where:{orderId:o.id,isSold:true}}),1)
  })
  await test('failed notifications remain queued for retry and never report sent',async()=>{
   const jobs=await db.notificationJob.findMany({where:{status:'failed'}})
   assert.ok(jobs.length>0);assert.ok(jobs.every(j=>!j.sentAt&&j.attempts>0))
  })
  await test('admin pagination searches beyond the first fifty orders',async()=>{
   const {listAdminOrders}=await import('../src/lib/admin-order-list')
   await db.order.createMany({data:Array.from({length:55},(_,i)=>({orderNumber:'PAGINATION-'+String(i).padStart(3,'0'),customerName:'Sandbox',customerEmail:'pagination@example.invalid',total:1}))})
   const page=await listAdminOrders(new URLSearchParams({page:'6',limit:'10',search:'PAGINATION-'}))
   assert.equal(page.total,55);assert.equal(page.data.length,5);assert.equal(page.totalPages,6)
   const searched=await listAdminOrders(new URLSearchParams({search:'pagination@example.invalid'}))
   assert.equal(searched.total,55)
   const full=await listAdminOrders(new URLSearchParams({search:o.orderNumber}))
   assert.equal(full.data[0].orderItems.length,1)
   await assert.rejects(()=>listAdminOrders(new URLSearchParams({page:'-1'})))
  })
  await test('category rename updates both legacy slug and category relation',async()=>{
   const {updateCategory}=await import('../src/lib/admin-category')
   await updateCategory(category.id,{name:'Renamed',slug:'renamed'})
   const all=await db.product.findMany({where:{categoryId:category.id}})
   assert.ok(all.length>0);assert.ok(all.every(p=>p.category==='renamed'))
  })
  await test('admin product validation rejects invalid money, stock and unsupported images',async()=>{
   const {productData}=await import('../src/lib/admin-product')
   const body={name:'Sandbox',description:'Sandbox',category:'renamed',price:0,deliveryType:'manual',stock:2}
   assert.equal(productData(body).price,0)
   assert.equal(productData({...body,image:'https://test.supabase.co/storage/p.png'}).image,'https://test.supabase.co/storage/p.png')
   for(const change of [{price:-1},{price:'bad'},{stock:1.5},{image:'https://unsupported.example/p.png'}])assert.throws(()=>productData({...body,...change}))
  })
  await test('SlipOK validates receiver logging and exact amount in a sandbox response',async()=>{
   const {handleSlip}=await import('../src/lib/payment-handlers')
   const {readFileSync}=await import('node:fs')
   process.env.SLIPOK_BRANCH_ID='sandbox';process.env.SLIPOK_API_KEY='sandbox-only'
   const p=await product(),o=await order(p),token=await transaction(tx=>createOrderSession(tx,o.id))
   const cookie=setOrderCookie(jsonUtf8({}),o.orderNumber,token).headers.get('set-cookie')!.split(';')[0]
   globalThis.fetch=async(_input,init)=>{
    const body=init?.body as FormData
    assert.equal(body.get('log'),'true');assert.equal(body.get('amount'),'10.25')
    return Response.json({success:true,data:{amount:10.25,sendingBank:'MOCK',transRef:'slip-sandbox',transTimestamp:new Date().toISOString()}})
   }
   const form=new FormData();form.set('orderId',o.orderNumber);form.set('files',new File([readFileSync('public/images/products/placeholder.png')],'mock.png',{type:'image/png'}))
   const r=await handleSlip(new Request('http://localhost/api/payment/slipok',{method:'POST',headers:{origin:'http://localhost',cookie},body:form}))
   assert.equal(r.status,200);assert.equal((await r.json()).data.deliveryItems.length,1)
   globalThis.fetch=async()=>{throw Error('External network prohibited by test runner')}
  })
  await test('duplicate slip locks the order for reconciliation; oversized files are rejected',async()=>{
   const {handleSlip}=await import('../src/lib/payment-handlers')
   const {readFileSync}=await import('node:fs')
   const p=await product(),o=await order(p),token=await transaction(tx=>createOrderSession(tx,o.id))
   const cookie=setOrderCookie(jsonUtf8({}),o.orderNumber,token).headers.get('set-cookie')!.split(';')[0]
   globalThis.fetch=async()=>Response.json({success:false,code:1012},{status:400})
   const form=new FormData();form.set('orderId',o.orderNumber);form.set('files',new File([readFileSync('public/images/og-banner.jpg')],'mock.jpg',{type:'image/jpeg'}))
   const response=await handleSlip(new Request('http://localhost/api/payment/slipok',{method:'POST',headers:{origin:'http://localhost',cookie},body:form}))
   assert.equal(response.status,202);assert.equal((await db.order.findUniqueOrThrow({where:{id:o.id}})).status,'payment_review')
   const oversized=await handleSlip(new Request('http://localhost/api/payment/slipok',{method:'POST',headers:{origin:'http://localhost','content-length':String(7*1024*1024)},body:'mock'}))
   assert.equal(oversized.status,413)
   globalThis.fetch=async()=>{throw Error('External network prohibited by test runner')}
  })
  await test('unreadable delivery stock preserves the verified payment and stays quarantined',async()=>{
   const p=await product('auto',1),o=await order(p)
   await db.digitalStock.updateMany({where:{orderId:o.id},data:{content:encryptText('not-json')}})
   const a=await startPayment(o.id,'slipok','corrupt-stock')
   await recordPayment(a.attempt.id,'slipok:corrupt-stock',10.25)
   await fulfillPaidOrder(o.id)
   assert.equal((await db.order.findUniqueOrThrow({where:{id:o.id}})).status,'needs_manual_delivery')
   assert.equal((await db.paymentAttempt.findUniqueOrThrow({where:{id:a.attempt.id}})).status,'verified')
   assert.equal(await db.digitalStock.count({where:{orderId:o.id,isSold:false}}),1)
  })
  await test('legacy deliveries without line IDs are preserved without issuing duplicate keys',async()=>{
   const p=await product('auto',1),o=await order(p)
   await db.deliveryItem.create({data:{orderId:o.id,productName:p.name,type:'license-key',licenseKey:encryptText('OLD MOCK KEY')}})
   const a=await startPayment(o.id,'slipok','legacy-partial')
   await recordPayment(a.attempt.id,'slipok:legacy-partial',10.25)
   await fulfillPaidOrder(o.id)
   assert.equal(await db.deliveryItem.count({where:{orderId:o.id}}),1)
   assert.equal((await db.order.findUniqueOrThrow({where:{id:o.id}})).status,'needs_manual_delivery')
  })
  console.log('PASS TOTAL '+passed)
 } finally {globalThis.fetch=realFetch;await db.$disconnect();await sandbox.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
