import { Product } from '@/types'
import { getStockStatus } from '@/lib/stock'


/**
 * ข้อมูลสินค้าตัวอย่างประเภทบริการ AI พรีเมียม (Fallback Mock Data)
 * → ใช้เมื่อยังไม่ได้รันการ Migrate ฐานข้อมูลจริง
 */
export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'ai-chatgpt-pro',
    name: 'ChatGPT Pro (สิทธิ์ส่วนตัว)',
    description: 'สิทธิ์ใช้งาน ChatGPT Pro ล่าสุด โมเดล GPT-4o และ GPT-4 เต็มกำลัง ปลดล็อกขีดจำกัดการเขียนโปรแกรม วิเคราะห์ข้อมูลขั้นสูง เจเนอเรตรูปภาพแบบไม่จำกัด ปราศจากโฆษณาตลอด 1 เดือนเต็ม รับบัญชีส่วนตัวใช้งานคนเดียวไม่ต้องหารใคร',
    price: 690,
    originalPrice: 850,
    image: '/images/products/chatgpt-pro.png',
    category: 'subscription',
    stock: 2,
    stockStatus: getStockStatus(2),
    tags: ['AI', 'ChatGPT', 'OpenAI', 'Pro', 'ส่งออโต้'],
    isNew: true,
    isFeatured: true,
    deliveryInfo: 'ส่งไอดีทันที ⚡',
  },
  {
    id: 'ai-claude-pro',
    name: 'Claude 3.5 Pro (สิทธิ์ส่วนตัว)',
    description: 'สิทธิ์เข้าใช้งาน Claude 3.5 Sonnet / Opus ระดับสูงสุด มีความโดดเด่นสูงสุดด้านภาษาและการเขียนโปรแกรมเชิงลึก รองรับการอัปโหลดไฟล์ขนาดใหญ่และปริมาณการคุยมากกว่าแผนทั่วไปถึง 5 เท่า ใช้งานแบบส่วนตัวไม่ต้องแชร์รหัส 1 เดือน',
    price: 720,
    originalPrice: 890,
    image: '/images/products/claude-pro.png',
    category: 'subscription',
    stock: 2,
    stockStatus: getStockStatus(2),
    tags: ['AI', 'Claude', 'Sonnet', 'Coding', 'ส่งออโต้'],
    isNew: false,
    isFeatured: true,
    deliveryInfo: 'ส่งไอดีทันที ⚡',
  },
  {
    id: 'ai-veo-pro',
    name: 'Google Veo 3 Pro (วิดีโอเจเนอเรเตอร์)',
    description: 'รหัสเปิดใช้งานคีย์สมาชิก Google Veo 3 Pro สัมผัสพลังสร้างสรรค์วิดีโอระดับภาพยนตร์ (Cinematic AI Video) ด้วยความละเอียดสูง 1080p ความยาวสูงสุด 10 วินาที ตอบสนองคำสั่งสมจริงและมีความคงเส้นคงวาดีเยี่ยม 1 เดือน',
    price: 1250,
    originalPrice: 1590,
    image: '/images/products/veo-pro.png',
    category: 'digital',
    stock: 2,
    stockStatus: getStockStatus(2),
    tags: ['AI', 'Video', 'Google', 'Veo3', 'ส่งคีย์'],
    isNew: true,
    isFeatured: true,
    deliveryInfo: 'ส่งคีย์ทันที ⚡',
  },
  {
    id: 'ai-midjourney-pro',
    name: 'Midjourney Pro (เจเนอเรตภาพ AI)',
    description: 'บัญชีใช้งาน Midjourney Pro ประสิทธิภาพระดับสูงสุดสำหรับสายอาร์ตและดีไซเนอร์ ปลดล็อกโหมดเจเนอเรตภาพรวดเร็วไม่จำกัด (GPU Fast Hours) และโหมดผ่อนปรน (Relax Mode) เจนภาพคุณภาพสูง ไร้ปัญหาลิขสิทธิ์ตลอด 1 เดือน',
    price: 990,
    originalPrice: 1390,
    image: '/images/products/midjourney.png',
    category: 'subscription',
    stock: 1,
    stockStatus: getStockStatus(1),
    tags: ['AI', 'Art', 'Design', 'Midjourney', 'ส่งออโต้'],
    isNew: false,
    isFeatured: false,
    deliveryInfo: 'ส่งไอดีทันที ⚡',
  },
]

/**
 * ดึงสินค้าทั้งหมด (ใช้ข้อมูล MOCK_PRODUCTS สำหรับหน้า client)
 * หน้า server-side และ admin จะดึงผ่าน /api/admin/products โดยตรง
 */
export async function getAllProducts(): Promise<Product[]> {
  return MOCK_PRODUCTS
}

/**
 * ดึงสินค้าตาม ID
 */
export async function getProductById(id: string): Promise<Product | undefined> {
  return MOCK_PRODUCTS.find((p) => p.id === id)
}

/**
 * ดึงสินค้าตามหมวดหมู่
 */
export async function getProductsByCategory(
  category: Product['category']
): Promise<Product[]> {
  const products = await getAllProducts()
  if (category === 'all') return products
  return products.filter((p) => p.category === category)
}

/**
 * ดึงสินค้า Featured
 */
export async function getFeaturedProducts(): Promise<Product[]> {
  const products = await getAllProducts()
  return products.filter((p) => p.isFeatured)
}

/**
 * ฟอร์แมตราคาเป็น Thai Baht
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

/**
 * คำนวณ % ส่วนลด
 */
export function getDiscountPercent(price: number, originalPrice: number): number {
  return Math.round(((originalPrice - price) / originalPrice) * 100)
}
