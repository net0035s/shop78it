const { chromium } = require(process.env.LAUNCH_PLAYWRIGHT_PATH || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
async function main() {
  require('@next/env').loadEnvConfig(process.cwd(),true,{info(){},error(){}})
  const publicKey=process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ''
  assert.ok(publicKey.startsWith('pk_test_'),'Browser tests only permit Clerk test credentials')
  const clerkHost=Buffer.from(publicKey.slice(8),'base64').toString().replace(/\$$/,'')
  assert.ok(clerkHost.endsWith('.clerk.accounts.dev'))
  const browser = await chromium.launch({channel:'msedge',headless:true})
  const checks=[]
  try {
    for (const viewport of [{width:390,height:844},{width:1280,height:900}]) {
      const page=await browser.newPage({viewport})
      await page.route('**/*',route=>{
        const url=new URL(route.request().url())
        if(['localhost','127.0.0.1',clerkHost].includes(url.hostname)) return route.continue()
        return route.abort()
      })
      await page.goto('http://localhost:3000/help',{waitUntil:'commit'})
      await page.getByRole('heading',{name:'วิธีสั่งซื้อ รับสินค้า และติดต่อร้าน',exact:true}).waitFor()
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth + 1)
      assert.equal(overflow,false)
      fs.mkdirSync('.cache/launch-ui',{recursive:true})
      await page.screenshot({path:'.cache/launch-ui/help-'+viewport.width+'.png',fullPage:true})
      checks.push({page:'/help',width:viewport.width,heading:true,horizontalOverflow:false})
      await page.goto('http://localhost:3000/track',{waitUntil:'commit'})
      await page.getByRole('heading',{name:'ติดตามและรับสินค้า'}).waitFor()
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth + 1),false)
      await page.screenshot({path:'.cache/launch-ui/track-'+viewport.width+'.png',fullPage:true})
      checks.push({page:'/track',width:viewport.width,heading:true,horizontalOverflow:false})
      await page.close()
    }
    fs.writeFileSync('docs/launch-ui-sandbox-latest.json',JSON.stringify({checkedAt:new Date().toISOString(),sandboxOnly:true,externalRequestsRestrictedToClerkTestInstance:true,adminLoginVerified:false,checks},null,2)+'\n')
    console.log(JSON.stringify(checks))
  } finally { await browser.close() }
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
