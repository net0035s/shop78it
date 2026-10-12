import { NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { decryptText, encryptText } from '@/lib/encryption'
import { transaction } from '@/lib/transactions'
import { syncAvailableStock } from '@/lib/inventory'
import { CommerceError, parseStockLine, textField } from '@/lib/commerce-rules'
import { sameOrigin, readJson, apiError } from '@/lib/server-guards'

export async function GET(request: Request) {
 const auth=await requireAdmin(); if(!auth.authorized) return auth.response
 try {
  const productId=textField(new URL(request.url).searchParams.get('productId'),'สินค้า',100)
  const stocks=await prisma.digitalStock.findMany({where:{productId},orderBy:[{isSold:'asc'},{id:'desc'}]})
  return NextResponse.json({success:true,data:stocks.map(s=>({...s,content:decryptText(s.content)}))},{headers:{'Cache-Control':'no-store'}})
 } catch(e){return apiError(e)}
}
export async function POST(request: Request) {
 const auth=await requireAdmin(); if(!auth.authorized) return auth.response
 try {
  sameOrigin(request); const b=await readJson(request)
  const productId=textField(b.productId,'สินค้า',100), type=textField(b.type,'ประเภท',30)
  const lines=textField(b.bulkData,'ข้อมูลสต็อก',28000).split('\n').map(s=>s.trim()).filter(Boolean)
  if(lines.length>500) throw new CommerceError('เติมได้ไม่เกิน 500 รายการต่อครั้ง')
  const contents=lines.map(line=>parseStockLine(type,line))
  const newStock=await transaction(async tx=>{
   const p=await tx.product.findUniqueOrThrow({where:{id:productId}})
   if(p.deliveryType==='manual') throw new CommerceError('สินค้าจัดส่งเองให้แก้จำนวนสต็อกในหน้าสินค้า')
   const instruction=textField(b.instructions??p.instruction,'คำแนะนำ',10000,true)
   await tx.digitalStock.createMany({data:contents.map(content=>({productId,type,content:encryptText(JSON.stringify({...content,instructions:instruction})),showInstruction:b.showInstruction!==false,instruction:instruction||null,isSold:false}))})
   await syncAvailableStock(tx,productId)
   return tx.digitalStock.count({where:{productId,isSold:false,orderId:null}})
  })
  return NextResponse.json({success:true,countAdded:lines.length,newStock,message:'เติมสต็อกสำเร็จ'})
 }catch(e){return apiError(e)}
}
export async function PUT(request: Request) {
 const auth=await requireAdmin(); if(!auth.authorized) return auth.response
 try {
  sameOrigin(request);const b=await readJson(request)
  const id=textField(new URL(request.url).searchParams.get('id'),'รหัสสต็อก',100)
  const updated=await transaction(async tx=>{
   const old=await tx.digitalStock.findUniqueOrThrow({where:{id}})
   if(old.isSold||old.orderId) throw new CommerceError('ไม่สามารถแก้สต็อกที่ขายหรือจองอยู่',409)
   let input=b.content
   if(typeof input==='string'){try{input=JSON.parse(input)}catch{input={}}}
   const line=old.type==='login-info'?JSON.stringify(input):old.type==='license-key'?input?.licenseKey:old.type==='login-link'?input?.loginUrl:input?.creditCode
   const content=parseStockLine(old.type,textField(line,'ข้อมูลสต็อก',10000))
   const instruction=textField(b.instruction??input?.instructions,'คำแนะนำ',10000,true)
   const changed=await tx.digitalStock.updateMany({where:{id,isSold:false,orderId:null},data:{content:encryptText(JSON.stringify({...content,instructions:instruction})),showInstruction:b.showInstruction!==false,instruction:instruction||null}})
   if(!changed.count) throw new CommerceError('สต็อกถูกจองแล้ว',409)
   return tx.digitalStock.findUniqueOrThrow({where:{id}})
  })
  return NextResponse.json({success:true,data:{...updated,content:decryptText(updated.content)}})
 }catch(e){return apiError(e)}
}
export async function DELETE(request: Request) {
 const auth=await requireAdmin(); if(!auth.authorized) return auth.response
 try{
  sameOrigin(request);const id=textField(new URL(request.url).searchParams.get('id'),'รหัสสต็อก',100)
  await transaction(async tx=>{
   const old=await tx.digitalStock.findUniqueOrThrow({where:{id}})
   const changed=await tx.digitalStock.deleteMany({where:{id,isSold:false,orderId:null}})
   if(!changed.count)throw new CommerceError('ไม่สามารถลบสต็อกที่ขายหรือจองอยู่',409)
   await syncAvailableStock(tx,old.productId)
  })
  return NextResponse.json({success:true})
 }catch(e){return apiError(e)}
}
