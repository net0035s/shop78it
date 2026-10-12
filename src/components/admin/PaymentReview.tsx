'use client'
import { useState } from 'react'
export function PaymentReview({order,onUpdated}:{order:any;onUpdated:()=>void}) {
 const [note,setNote]=useState(''),[reference,setReference]=useState(''),[amount,setAmount]=useState(String(order.total)),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function resolve(id:string,resolution:string) {
  setBusy(true);setError('')
  try{
   const r=await fetch('/api/admin/payments/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resolution,note,reference,receivedAmount:amount})})
   const b=await r.json();if(!b.success)throw Error(b.error);onUpdated()
  }catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ')}finally{setBusy(false)}
 }
 const pending=order.paymentAttempts?.filter((p:any)=>['started','review'].includes(p.status)) || []
 if(!pending.length)return null
 return <div className="p-3 border border-amber-500/40 rounded-xl space-y-3">
  <p className="font-bold text-amber-400">ตรวจผลรับเงินก่อนเปิดให้ชำระซ้ำ</p>
  <p>ตรวจยอดและเลขอ้างอิงจากบัญชีรับเงินหรือผู้ให้บริการก่อนบันทึกผล</p>
  <label className="block">บันทึกหลักฐานการตรวจ<input required value={note} onChange={e=>setNote(e.target.value)} className="block w-full bg-surface p-2 rounded" /></label>
  <label className="block">เลขอ้างอิงพร้อมชื่อช่องทาง (เช่น slipok:ธนาคาร:รายการ)<input value={reference} onChange={e=>setReference(e.target.value)} className="block w-full bg-surface p-2 rounded" /></label>
  <label className="block">ยอดรับจริง<input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className="block w-full bg-surface p-2 rounded" /></label>
  {pending.map((p:any)=><div key={p.id} className="space-y-2"><p>{p.method} — {p.status} — {p.note}</p><div className="flex gap-2 flex-wrap">
   <button type="button" disabled={busy||!note||!reference} onClick={()=>resolve(p.id,'paid')} className="p-2 rounded bg-primary disabled:opacity-40">ยืนยันรับครบแล้ว</button>
   <button type="button" disabled={busy||!note} onClick={()=>resolve(p.id,'not_paid')} className="p-2 rounded bg-surfaceLight disabled:opacity-40">ตรวจแล้วไม่พบการรับเงิน</button>
  </div></div>)}
  {error&&<p role="alert" className="text-red-400">{error}</p>}
 </div>
}
