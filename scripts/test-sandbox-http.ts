import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
async function main() {
  const base = new URL(process.argv[2] || 'http://localhost:3000')
  if (base.protocol !== 'http:' || !['localhost','127.0.0.1'].includes(base.hostname)) throw new Error('HTTP tests only permit a local sandbox')
  const fixture = await fetch(new URL('/',base))
  const html = await fixture.text()
  assert.ok(html.includes('sandbox-manual') && html.includes('สินค้าจัดส่งเอง (จำลอง)'), 'Only the seeded sandbox storefront may be tested')
  const report: Array<{check:string;status:string}>= []
  async function check(name:string, fn:()=>Promise<void>){await fn();report.push({check:name,status:'pass'});console.log('PASS '+name)}
  for(const [path,text] of [['/help','วิธีสั่งซื้อ รับสินค้า และติดต่อร้าน'],['/refund','คืนเงิน'],['/terms','เงื่อนไข']] as const) await check('public '+path,async()=>{
    const response=await fetch(new URL(path,base));assert.equal(response.status,200);assert.ok((await response.text()).includes(text))
  })
  await check('unauthenticated admin API',async()=>{
    const response=await fetch(new URL('/api/admin/readiness',base));assert.equal(response.status,401)
  })
  await check('order number alone cannot read an order',async()=>{
    const response=await fetch(new URL('/api/orders?orderNumber=SANDBOX-RESUME',base));assert.equal(response.status,403)
  })
  await check('sandbox order creation and scoped cookie access',async()=>{
    const response=await fetch(new URL('/api/orders',base),{method:'POST',headers:{origin:base.origin,'content-type':'application/json'},body:JSON.stringify({items:[{productId:'sandbox-manual',quantity:1}],customer:{name:'HTTP Sandbox',email:'http@example.invalid'}})})
    const body=await response.json();assert.equal(response.status,200);assert.equal(body.success,true);assert.equal(body.data.total,10.25)
    const cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')
    assert.ok(cookie)
    const url=new URL('/api/orders?orderNumber='+body.data.orderNumber,base)
    const denied=await fetch(url);assert.equal(denied.status,403)
    const allowed=await fetch(url,{headers:{cookie}});assert.equal(allowed.status,200);assert.equal((await allowed.json()).data.orderNumber,body.data.orderNumber)
    assert.equal(allowed.headers.get('cache-control'),'private, no-store')
    const payment=await fetch(new URL('/api/payment/promptpay',base),{method:'POST',headers:{cookie,origin:base.origin,'content-type':'application/json'},body:JSON.stringify({orderNumber:body.data.orderNumber})})
    assert.equal(payment.status,503)
  })
  writeFileSync('docs/launch-http-sandbox-latest.json',JSON.stringify({checkedAt:new Date().toISOString(),sandboxOnly:true,realPayments:false,checks:report},null,2)+'\n')
}
main().catch(error=>{console.error(error);process.exitCode=1})
