import assert from 'node:assert/strict'
async function main(){
 const {siteUrl}=await import('../src/lib/site-url')
 assert.equal(siteUrl({VERCEL_ENV:'preview',VERCEL_URL:'shop78it-test.vercel.app',NEXT_PUBLIC_SITE_URL:'https://shop78it.vercel.app'}),'https://shop78it-test.vercel.app')
 assert.throws(()=>siteUrl({VERCEL_ENV:'preview',VERCEL_URL:'evil.example/path'}))
 assert.equal(siteUrl({VERCEL_ENV:'production',VERCEL_URL:'shop78it-test.vercel.app',NEXT_PUBLIC_SITE_URL:'https://shop78it.vercel.app'}),'https://shop78it.vercel.app')
 console.log('PASS Preview URLs use their own deployment host and production keeps its configured URL')
 const {clientAddress}=await import('../src/lib/hosting')
 const {assertSafeDatabaseWrite,databaseFingerprint}=await import('../src/lib/launch-readiness')
 const {stripeAvailable}=await import('../src/lib/stripe-config')
 const sandbox='postgresql://postgres@db.testproject.supabase.co/postgres'
 const shop='postgresql://postgres@db.shopproject.supabase.co/postgres'
 const netlify={SHOP_HOSTING_PROVIDER:'netlify',SHOP_DEPLOYMENT_ENV:'preview',SHOP_DEPLOYMENT_URL:'https://test--shop78it.netlify.app',NEXT_PUBLIC_SITE_URL:'https://shop78it.vercel.app',APP_MODE:'sandbox',DATABASE_URL:sandbox,DIRECT_URL:sandbox,SANDBOX_DATABASE_FINGERPRINT:databaseFingerprint(sandbox),PRODUCTION_DATABASE_FINGERPRINT:databaseFingerprint(shop)}
 assert.equal(siteUrl(netlify),'https://test--shop78it.netlify.app')
 assert.throws(()=>siteUrl({...netlify,SHOP_DEPLOYMENT_URL:'https://shop.netlify.app/path'}))
 assert.throws(()=>siteUrl({...netlify,SHOP_DEPLOYMENT_URL:'http://shop.netlify.app'}))
 assert.doesNotThrow(()=>assertSafeDatabaseWrite(netlify))
 assert.throws(()=>assertSafeDatabaseWrite({...netlify,DATABASE_URL:shop}))
 assert.throws(()=>assertSafeDatabaseWrite({...netlify,APP_MODE:'live'}))
 assert.equal(stripeAvailable({...netlify,STRIPE_ENABLED:'true',STRIPE_SECRET_KEY:'sk_live_testvalue',APP_MODE:'live',PAYMENTS_ENABLED:'true',LAUNCH_APPROVED:'true',STRIPE_WEBHOOK_SECRET:'whsec_testvalue'}),false)
 const request=new Request('https://shop.netlify.app/api/orders',{headers:{'x-nf-client-connection-ip':'203.0.113.1','x-forwarded-for':'198.51.100.1'}})
 assert.equal(clientAddress(request,netlify),'203.0.113.1')
 assert.equal(clientAddress(request,{}),'local')
 assert.equal(clientAddress(request,{VERCEL:'1'}),'unknown')
 console.log('PASS Netlify own-origin redirects, isolated writes, live-payment rejection and trusted-proxy rate limits')
 process.env.ENCRYPTION_KEY=''
 const {assertEncryptionReady}=await import('../src/lib/encryption')
 assert.throws(assertEncryptionReady)
 console.log('PASS imports succeed without an encryption key, while sensitive operations fail closed')
}
main().catch(e=>{console.error(e);process.exitCode=1})
