import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {createServer} from 'node:http'
import {build} from 'esbuild'
import {chromium,expect} from '@playwright/test'
import {statsQueryBatch} from '../src/lib/stats-query-batch'

async function main(){
  let running=0,maxRunning=0
  const values=await statsQueryBatch(Array.from({length:8},(_,i)=>async()=>{running++;maxRunning=Math.max(maxRunning,running);await new Promise(r=>setTimeout(r,10));running--;return i}))
  assert.deepEqual(values,[0,1,2,3,4,5,6,7]);assert.ok(maxRunning<=2)
  await assert.rejects(()=>statsQueryBatch([async()=>{throw new Error('database unavailable')}]))
  mkdirSync('.cache/ui-regression',{recursive:true})
  writeFileSync('.cache/ui-regression/entry.tsx',`
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {useCartStore} from '../../src/store/cartStore';
    import {OrderNumber} from '../../src/components/OrderNumber';
    import {DashboardOverview} from '../../src/components/admin/DashboardOverview';
    import AdminDashboard from '../../src/app/admin11/page';
    const purchased={id:'paid-product',name:'MOCK paid item',price:30,stock:10};
    const extra={id:'new-product',name:'MOCK next purchase',price:20,stock:10};
    const number='SA-1234567890ABCDEF1234567890ABCDEF';
    function App(){const items=useCartStore(s=>s.items);return <>
      <OrderNumber value={number}/><div data-testid="cart">{items.map(i=>i.product.id+':'+i.quantity).join(',')}</div>
      <button onClick={()=>{useCartStore.getState().addItem(purchased as any,1);useCartStore.getState().addItem(extra as any,2)}}>Prepare cart</button>
      <button onClick={()=>useCartStore.getState().completeOrder(number,[{product:{id:purchased.id},quantity:1}])}>Confirm paid order</button>
      <button onClick={()=>useCartStore.getState().addItem(purchased as any,2)}>Add next purchase</button>
      <div data-testid="overview-fixture"><DashboardOverview stats={{todayRevenue:110,monthRevenue:250,pendingOrders:1,manualDeliveryOrders:3,lowStockProducts:[],last7Days:[],recentOrders:[]}} manualDeliveryCount={3} onShowOrders={()=>{}}/></div>
      <div data-testid="admin-fixture"><AdminDashboard/></div>
    </>}; createRoot(document.getElementById('root')!).render(<App/>);
  `)
  await build({entryPoints:['.cache/ui-regression/entry.tsx'],bundle:true,platform:'browser',jsx:'automatic',outfile:'.cache/ui-regression/bundle.js',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'mock-next-navigation',setup(builder){
    builder.onResolve({filter:/^next\/(navigation|image|link)$/},args=>({path:args.path,namespace:'fixture-next'}))
    builder.onLoad({filter:/.*/,namespace:'fixture-next'},args=>({resolveDir:process.cwd(),contents:args.path==='next/navigation'?'const router={push(){},replace(){}};export const useRouter=()=>router;':'import React from "react";export default function Component({children,fill,...props}){return React.createElement('+JSON.stringify(args.path==='next/link'?'a':'img')+',props,children)}'}))
  }}]})
  let statsFail=true
  const server=createServer((req,res)=>{
    if(req.url?.startsWith('/api/')) {
      res.setHeader('content-type','application/json')
      if(req.url.startsWith('/api/admin/stats')){res.statusCode=statsFail?503:200;res.end(JSON.stringify(statsFail?{success:false,error:'MOCK statistics unavailable'}:{success:true,data:{todayRevenue:110,monthRevenue:250,pendingOrders:1,manualDeliveryOrders:3,lowStockProducts:[],last7Days:[],recentOrders:[]}}))}
      else if(req.url.startsWith('/api/admin/orders'))res.end(JSON.stringify({success:true,data:[],total:0,summary:{manualDeliveryOrders:3,actionableOrders:3}}))
      else if(req.url.startsWith('/api/admin/readiness'))res.end(JSON.stringify({success:false,error:'MOCK readiness'}))
      else res.end(JSON.stringify({success:true,data:[]}))
    }else if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(readFileSync('.cache/ui-regression/bundle.js'))}
    else{res.setHeader('content-type','text/html');res.end('<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>')}
  })
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  const port=(server.address() as {port:number}).port
  const browser=await chromium.launch({headless:true,...(process.env.SHOP_TEST_BROWSER_CHANNEL?{channel:process.env.SHOP_TEST_BROWSER_CHANNEL}:{})}).catch(error=>{server.close();throw error})
  try{
    const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']})
    const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
    await page.goto('http://127.0.0.1:'+port)
    await page.getByRole('button',{name:'Prepare cart',exact:true}).click()
    await page.getByRole('button',{name:'Confirm paid order',exact:true}).click()
    await expect(page.getByTestId('cart')).toHaveText('new-product:2')
    await page.getByRole('button',{name:'Add next purchase',exact:true}).click()
    await page.getByRole('button',{name:'Confirm paid order',exact:true}).click()
    await expect(page.getByTestId('cart')).toHaveText('new-product:2,paid-product:2')
    await page.reload()
    await page.getByRole('button',{name:'Confirm paid order',exact:true}).click()
    await expect(page.getByTestId('cart')).toHaveText('new-product:2,paid-product:2')
    await expect(page.getByText('SA-1234567890ABCDEF1234567890ABCDEF',{exact:true})).toBeVisible()
    await page.getByRole('button',{name:'คัดลอกเลขออเดอร์',exact:true}).click()
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'SA-1234567890ABCDEF1234567890ABCDEF')
    await expect(page.getByRole('status')).toHaveText('คัดลอกแล้ว')
    await expect(page.getByTestId('overview-fixture').getByText('รอแอดมินจัดส่ง',{exact:true})).toBeVisible()
    await expect(page.getByTestId('overview-fixture').getByText('3 รายการ',{exact:true})).toBeVisible()
    const admin=page.getByTestId('admin-fixture')
    await expect(admin.getByRole('alert').filter({hasText:'โหลดสถิติไม่สำเร็จ'})).toBeVisible()
    await expect(admin.getByRole('button',{name:'ออเดอร์ รอดำเนินการ 3 รายการ',exact:true})).toBeVisible()
    await admin.getByRole('button',{name:'ออเดอร์ รอดำเนินการ 3 รายการ',exact:true}).click()
    await admin.getByPlaceholder('ค้นหาเลขออเดอร์').fill('no-match')
    await expect(admin.getByRole('button',{name:'ออเดอร์ รอดำเนินการ 3 รายการ',exact:true})).toBeVisible()
    statsFail=false
    await admin.getByRole('button',{name:'รีเฟรชข้อมูล',exact:true}).click()
    await expect(admin.getByRole('alert').filter({hasText:'โหลดสถิติไม่สำเร็จ'})).toHaveCount(0)
    await admin.getByRole('button',{name:'ภาพรวม',exact:true}).click()
    await expect(admin.getByText('3 รายการ',{exact:true})).toBeVisible()
    assert.deepEqual(errors,[])
    console.log(JSON.stringify({passed:true,checks:['paid cart lines removed; new purchases retained','repeat settlement and reload do not remove new items','full order number copied to clipboard','manual delivery card shows three orders','statistics query concurrency bounded and errors propagate','admin badge remains three when stats fail or orders are filtered','refresh recovers stats and dashboard shows three'],realPayments:false,databaseWrites:0}))
  }finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()))}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'UI regression failed');process.exitCode=1})
