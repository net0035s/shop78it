import { cents, textField, CommerceError, httpUrl } from './commerce-rules'
export function productData(b: any) {
  const deliveryType = b.deliveryType ?? 'auto'
  if (!['auto','manual'].includes(deliveryType)) throw new CommerceError('รูปแบบจัดส่งไม่ถูกต้อง')
  const stock = Number(b.stock ?? 0), manualSoldCount = Number(b.manualSoldCount ?? 0)
  if (![stock,manualSoldCount].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000)) throw new CommerceError('จำนวนสต็อกและยอดขายต้องเป็นจำนวนเต็ม 0–1,000,000')
  const image = b.image || '/images/products/placeholder.png'
  if (typeof image !== 'string' || image.length > 4000) throw new CommerceError('รูปภาพไม่ถูกต้อง')
  if (!image.startsWith('/images/')) {
    const url = new URL(httpUrl(image))
    if (url.protocol !== 'https:' || url.port !== '' || !(['images.unsplash.com','res.cloudinary.com','i.postimg.cc'].includes(url.hostname) || (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')))) throw new CommerceError('ใช้รูปจาก Unsplash, Cloudinary, Postimg หรือ Supabase ที่ระบบรองรับ')
  }
  return { name:textField(b.name,'ชื่อสินค้า',300), description:textField(b.description,'รายละเอียด',10000),
    price:cents(b.price)/100, originalPrice:b.originalPrice === '' || b.originalPrice == null ? null : cents(b.originalPrice)/100,
    category:textField(b.category,'หมวดหมู่',100), image, deliveryType,
    tags:textField(b.tags,'แท็ก',1000,true), isNew:b.isNew===true, isFeatured:b.isFeatured===true,
    showFeatures:b.showFeatures===true, features:textField(b.features,'คุณสมบัติ',10000,true)||null,
    manualSoldCount, showInstruction:b.showInstruction===true, instruction:textField(b.instruction,'คำแนะนำ',10000,true)||null,
    deliveryInfo:textField(b.deliveryInfo,'ข้อมูลจัดส่ง',1000,true), ...(deliveryType==='manual'&&{stock,stockStatus:stock===0?'out-of-stock':stock<=5?'low-stock':'in-stock'}) }
}
