import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding data...')

  // 1. Create Category
  const subCategory = await prisma.category.upsert({
    where: { slug: 'subscription' },
    update: {},
    create: {
      name: 'Subscription',
      slug: 'subscription',
      icon: '🔄',
      color: '#6366f1',
      sortOrder: 1,
      isActive: true,
    },
  })

  // 2. Create Products
  const products = [
    {
      name: 'ChatGPT Plus Subscription',
      description: 'ใช้งาน ChatGPT Plus ฟีเจอร์ล่าสุด (GPT-4, Plugins, Data Analysis) ส่งมอบในรูปแบบการอัปเกรดบัญชีเดิมหรือบัญชีใหม่',
      price: 590,
      originalPrice: 750,
      image: 'https://images.unsplash.com/photo-1675802271842-8356a6db99e8?q=80&w=2938&auto=format&fit=crop', // Stock image representing AI/tech
      category: 'subscription',
      categoryId: subCategory.id,
      stock: 50,
      stockStatus: 'in-stock',
      tags: 'AI,OpenAI,GPT-4,ออโต้',
      isNew: true,
      isFeatured: true,
      deliveryType: 'auto',
      deliveryInfo: 'ส่งข้อมูลอัตโนมัติทางอีเมล',
    },
    {
      name: 'Claude Pro (สิทธิ์ส่วนตัว)',
      description: 'ใช้งาน Claude Pro ตัวเต็ม (Claude 3 Opus / Sonnet / Haiku) ลื่นไหล ไม่ติดลิมิตบ่อย ส่งมอบเป็นข้อมูลล็อกอิน',
      price: 690,
      originalPrice: 850,
      image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=2865&auto=format&fit=crop',
      category: 'subscription',
      categoryId: subCategory.id,
      stock: 30,
      stockStatus: 'in-stock',
      tags: 'AI,Anthropic,Claude 3,ออโต้',
      isNew: true,
      isFeatured: true,
      deliveryType: 'auto',
      deliveryInfo: 'ระบบอัตโนมัติ (Login Info)',
    },
    {
      name: 'Google Gemini Advanced',
      description: 'อัปเกรดบัญชี Google เป็น Gemini Advanced + พื้นที่ Google One 2TB ใช้งานโมเดล Gemini 1.5 Pro ล่าสุด',
      price: 650,
      originalPrice: null,
      image: 'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?q=80&w=2836&auto=format&fit=crop',
      category: 'subscription',
      categoryId: subCategory.id,
      stock: 10,
      stockStatus: 'low-stock',
      tags: 'AI,Google,Gemini,ออโต้',
      isNew: false,
      isFeatured: true,
      deliveryType: 'auto',
      deliveryInfo: 'ส่งลิงก์คำเชิญอัตโนมัติ',
    }
  ]

  for (const p of products) {
    const createdProduct = await prisma.product.create({
      data: p
    })

    // สร้างข้อมูล Mock DigitalKey 3-5 คีย์ ผูกกับสินค้านี้
    const numKeys = Math.floor(Math.random() * 3) + 3 // สุ่ม 3-5 คีย์
    const keys = Array.from({ length: numKeys }).map((_, i) => ({
      productId: createdProduct.id,
      keyData: JSON.stringify({
        email: `guest${i + 1}_${Math.floor(Math.random() * 1000)}@shopauto.com`,
        password: `PASS_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      }),
      status: 'AVAILABLE'
    }))

    await prisma.digitalKey.createMany({
      data: keys
    })
  }

  console.log('Seed completed successfully! 🌱')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
