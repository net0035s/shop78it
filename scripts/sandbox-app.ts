import { loadEnvConfig } from '@next/env'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { sandboxDatabase } from './sandbox-db'
async function main(){
 const useClerk = process.argv.includes('--clerk-test')
 if (useClerk) {
  loadEnvConfig(process.cwd(),true,{info(){},error(){}})
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') || !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_')) throw new Error('--clerk-test only permits Clerk test-instance credentials')
 }
 const sandbox=await sandboxDatabase()
 const env={...process.env,STRIPE_ENABLED:'false',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:'',DATABASE_URL:sandbox.url,DIRECT_URL:sandbox.url,ENCRYPTION_KEY:randomBytes(32).toString('hex'),PAYMENTS_ENABLED:'false',APP_MODE:'sandbox',ORDERS_ENABLED:'true',VERCEL_ENV:'development',NEXT_PUBLIC_SITE_URL:'http://localhost:3000',NEXT_PUBLIC_BASE_URL:'http://localhost:3000',
  EMAIL_USER:'',EMAIL_PASS:'',TELEGRAM_BOT_TOKEN:'',TELEGRAM_CHAT_ID:'',TMN_RECEIVE_PHONE:'',PROMPTPAY_NUMBER:'',SLIPOK_API_KEY:'',SLIPOK_BRANCH_ID:'',SLIP_VERIFY_API_KEY:'',SLIP_VERIFY_API_URL:'',CRON_SECRET:'sandbox-only',ADMIN_EMAILS:useClerk ? process.env.ADMIN_EMAILS || '' : '',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:useClerk ? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY! : 'pk_test_'+Buffer.from('sandbox.clerk.accounts.dev'+String.fromCharCode(36)).toString('base64'),CLERK_SECRET_KEY:useClerk ? process.env.CLERK_SECRET_KEY! : 'sk_test_sandbox_only',NEXT_PUBLIC_GA_ID:'',NEXT_PUBLIC_FB_PIXEL_ID:''}
 const {PrismaClient}=await import('@prisma/client')
 const db=new PrismaClient({datasources:{db:{url:sandbox.url}}})
 const category=await db.category.create({data:{name:'สินค้าทดสอบ',slug:'sandbox'}})
 await db.product.createMany({data:[{id:'sandbox-manual',name:'สินค้าจัดส่งเอง (จำลอง)',description:'ใช้ตรวจหน้าเว็บเท่านั้น ไม่มีการรับเงินจริง',price:10.25,image:'/images/products/placeholder.png',category:category.slug,categoryId:category.id,stock:5,stockStatus:'low-stock',tags:'',deliveryType:'manual'},{id:'sandbox-empty',name:'สินค้าหมดชั่วคราว (จำลอง)',description:'รายการจำลองสำหรับตรวจสถานะหมดสต็อก',price:99.50,image:'/images/products/placeholder.png',category:category.slug,categoryId:category.id,stock:0,stockStatus:'out-of-stock',tags:'',deliveryType:'auto'}]})
 const pending=await db.order.create({data:{orderNumber:'SANDBOX-RESUME',customerName:'ลูกค้าจำลอง',customerEmail:'sandbox@example.invalid',total:10.25,subTotal:10.25,expiresAt:new Date(Date.now()+3600000),reservationActive:true,orderItems:{create:{productId:'sandbox-manual',quantity:1,price:10.25,productName:'สินค้าจัดส่งเอง (จำลอง)',productImage:'/images/products/placeholder.png',deliveryType:'manual'}}}})
 await db.product.update({where:{id:'sandbox-manual'},data:{stock:{decrement:1}}})
 const {createHash}=await import('node:crypto')
 const accessToken=randomBytes(32).toString('base64url')
 await db.orderAccessChallenge.create({data:{orderId:pending.id,tokenHash:createHash('sha256').update(accessToken).digest('hex'),expiresAt:new Date(Date.now()+900000)}})
 if (!process.argv.includes('--build')) console.log('Synthetic access link: http://localhost:3000/track#access='+accessToken)
 await db.$disconnect()
 const build=process.argv.includes('--build'), start=process.argv.includes('--start')
 console.log(build?'Building with sandbox database and disabled payments':'Sandbox app: http://localhost:3000 — payments disabled')
 const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),build?'build':start?'start':'dev',...(!build?['--hostname','localhost']:[])],{env,stdio:'inherit'})
 process.on('SIGINT',()=>child.kill('SIGTERM'))
 const code=await new Promise<number|null>(r=>child.on('exit',(code,signal)=>{console.log('Next process exit:',code,signal);r(code)}))
 await sandbox.close();process.exitCode=code??1
}
main().catch(e=>{console.error(e);process.exitCode=1})
