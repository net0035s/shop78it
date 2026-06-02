const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding for ShopAuto 24/7 (AI Service Packages)...')

  // 1. Clear existing database entries
  console.log('🧹 Clearing existing products and digital stock...')
  await prisma.digitalStock.deleteMany({})
  await prisma.deliveryItem.deleteMany({})
  await prisma.order.deleteMany({})
  await prisma.product.deleteMany({})

  console.log('📦 Seeding products...')

  // 2. Seeding Product: ChatGPT Pro
  const chatGpt = await prisma.product.create({
    data: {
      name: 'ChatGPT Pro (สิทธิ์ส่วนตัว)',
      description: 'สิทธิ์ใช้งาน ChatGPT Pro ล่าสุด โมเดล GPT-4o และ GPT-4 เต็มกำลัง ปลดล็อกขีดจำกัดการเขียนโปรแกรม วิเคราะห์ข้อมูลขั้นสูง เจเนอเรตรูปภาพแบบไม่จำกัด ปราศจากโฆษณาตลอด 1 เดือนเต็ม รับบัญชีส่วนตัวใช้งานคนเดียวไม่ต้องหารใคร',
      price: 690,
      originalPrice: 850,
      image: '/images/products/chatgpt-pro.png',
      category: 'subscription',
      stock: 2,
      stockStatus: 'in-stock',
      tags: 'AI, ChatGPT, OpenAI, Pro, ส่งออโต้',
      isNew: true,
      isFeatured: true,
      deliveryInfo: 'ส่งไอดีทันที ⚡',
    },
  })

  // 3. Seeding Product: Claude 3.5 Pro
  const claude = await prisma.product.create({
    data: {
      name: 'Claude 3.5 Pro (สิทธิ์ส่วนตัว)',
      description: 'สิทธิ์เข้าใช้งาน Claude 3.5 Sonnet / Opus ระดับสูงสุด มีความโดดเด่นสูงสุดด้านภาษาและการเขียนโปรแกรมเชิงลึก รองรับการอัปโหลดไฟล์ขนาดใหญ่และปริมาณการคุยมากกว่าแผนทั่วไปถึง 5 เท่า ใช้งานแบบส่วนตัวไม่ต้องแชร์รหัส 1 เดือน',
      price: 720,
      originalPrice: 890,
      image: '/images/products/claude-pro.png',
      category: 'subscription',
      stock: 2,
      stockStatus: 'in-stock',
      tags: 'AI, Claude, Sonnet, Coding, ส่งออโต้',
      isNew: false,
      isFeatured: true,
      deliveryInfo: 'ส่งไอดีทันที ⚡',
    },
  })

  // 4. Seeding Product: Google Veo 3 Pro
  const veo = await prisma.product.create({
    data: {
      name: 'Google Veo 3 Pro (วิดีโอเจเนอเรเตอร์)',
      description: 'รหัสเปิดใช้งานคีย์สมาชิก Google Veo 3 Pro สัมผัสพลังสร้างสรรค์วิดีโอระดับภาพยนตร์ (Cinematic AI Video) ด้วยความละเอียดสูง 1080p ความยาวสูงสุด 10 วินาที ตอบสนองคำสั่งสมจริงและมีความคงเส้นคงวาดีเยี่ยม 1 เดือน',
      price: 1250,
      originalPrice: 1590,
      image: '/images/products/veo-pro.png',
      category: 'digital',
      stock: 2,
      stockStatus: 'in-stock',
      tags: 'AI, Video, Google, Veo3, ส่งคีย์',
      isNew: true,
      isFeatured: true,
      deliveryInfo: 'ส่งคีย์ทันที ⚡',
    },
  })

  // 5. Seeding Product: Midjourney Pro
  const midjourney = await prisma.product.create({
    data: {
      name: 'Midjourney Pro (เจเนอเรตภาพ AI)',
      description: 'บัญชีใช้งาน Midjourney Pro ประสิทธิภาพระดับสูงสุดสำหรับสายอาร์ตและดีไซเนอร์ ปลดล็อกโหมดเจเนอเรตภาพรวดเร็วไม่จำกัด (GPU Fast Hours) และโหมดผ่อนปรน (Relax Mode) เจนภาพคุณภาพสูง ไร้ปัญหาลิขสิทธิ์ตลอด 1 เดือน',
      price: 990,
      originalPrice: 1390,
      image: '/images/products/midjourney.png',
      category: 'subscription',
      stock: 1,
      stockStatus: 'low-stock',
      tags: 'AI, Art, Design, Midjourney, ส่งออโต้',
      isNew: false,
      isFeatured: false,
      deliveryInfo: 'ส่งไอดีทันที ⚡',
    },
  })

  console.log('⚡ Seeding initial pre-loaded Digital Stocks...')

  // 6. Preload digital accounts for ChatGPT Pro
  await prisma.digitalStock.create({
    data: {
      productId: chatGpt.id,
      type: 'login-info',
      content: JSON.stringify({
        email: 'gpt.pro.guest1@shopauto247.com',
        password: 'ChatGPT_Pass_Auto99!',
        loginUrl: 'https://chatgpt.com/auth/login',
        expiresAt: 'หมดประกัน 30 วัน',
        instructions: '⚠️ ข้อควรระวังในการใช้งาน:\n1. บัญชีนี้เป็นสิทธิ์ส่วนตัวของคุณคนเดียว ห้ามแก้ไขรหัสผ่านหรืออีเมลเด็ดขาด\n2. เข้าใช้งานผ่านเว็บเบราว์เซอร์ ChatGPT.com หรือแอปพลิเคชันอย่างเป็นทางการเท่านั้น',
      }),
    },
  })
  await prisma.digitalStock.create({
    data: {
      productId: chatGpt.id,
      type: 'login-info',
      content: JSON.stringify({
        email: 'gpt.pro.guest2@shopauto247.com',
        password: 'ChatGPT_Pass_Auto88!',
        loginUrl: 'https://chatgpt.com/auth/login',
        expiresAt: 'หมดประกัน 30 วัน',
        instructions: '⚠️ ข้อควรระวังในการใช้งาน:\n1. บัญชีนี้เป็นสิทธิ์ส่วนตัวของคุณคนเดียว ห้ามแก้ไขรหัสผ่านหรืออีเมลเด็ดขาด\n2. เข้าใช้งานผ่านเว็บเบราว์เซอร์ ChatGPT.com หรือแอปพลิเคชันอย่างเป็นทางการเท่านั้น',
      }),
    },
  })

  // 7. Preload digital accounts for Claude 3.5 Pro
  await prisma.digitalStock.create({
    data: {
      productId: claude.id,
      type: 'login-info',
      content: JSON.stringify({
        email: 'claude.sonnet.guest1@shopauto247.com',
        password: 'Sonnet_Pass_9921#',
        loginUrl: 'https://claude.ai/login',
        expiresAt: 'หมดประกัน 30 วัน',
        instructions: '⚠️ วิธีเข้าใช้งาน:\n1. เข้าสู่ระบบ claude.ai ด้วย Email / Password ด้านบน\n2. โปรดใช้งานด้วยความสุภาพและหลีกเลี่ยงการนำบัญชีไปขายต่อ',
      }),
    },
  })
  await prisma.digitalStock.create({
    data: {
      productId: claude.id,
      type: 'login-info',
      content: JSON.stringify({
        email: 'claude.sonnet.guest2@shopauto247.com',
        password: 'Sonnet_Pass_8812#',
        loginUrl: 'https://claude.ai/login',
        expiresAt: 'หมดประกัน 30 วัน',
        instructions: '⚠️ วิธีเข้าใช้งาน:\n1. เข้าสู่ระบบ claude.ai ด้วย Email / Password ด้านบน\n2. โปรดใช้งานด้วยความสุภาพและหลีกเลี่ยงการนำบัญชีไปขายต่อ',
      }),
    },
  })

  // 8. Preload license keys for Google Veo 3 Pro
  await prisma.digitalStock.create({
    data: {
      productId: veo.id,
      type: 'license-key',
      content: JSON.stringify({
        licenseKey: 'VEO3-PRO-KEY-88192-XKL9-9912',
        expiresAt: 'เปิดใช้งานคีย์ภายใน 15 วัน',
        instructions: '💡 ขั้นตอนการรีดีมคีย์ Google Veo 3 Pro:\n1. ไปที่ deepmind.google/veo-redeem\n2. ล็อกอินด้วย Google Account ของคุณ\n3. นำคีย์ด้านบนไปวางแล้วกดยืนยันเพื่อรับเครดิตทดลองระดับโปรทันที!',
      }),
    },
  })
  await prisma.digitalStock.create({
    data: {
      productId: veo.id,
      type: 'license-key',
      content: JSON.stringify({
        licenseKey: 'VEO3-PRO-KEY-77190-MLP2-8811',
        expiresAt: 'เปิดใช้งานคีย์ภายใน 15 วัน',
        instructions: '💡 ขั้นตอนการรีดีมคีย์ Google Veo 3 Pro:\n1. ไปที่ deepmind.google/veo-redeem\n2. ล็อกอินด้วย Google Account ของคุณ\n3. นำคีย์ด้านบนไปวางแล้วกดยืนยันเพื่อรับเครดิตทดลองระดับโปรทันที!',
      }),
    },
  })

  // 9. Preload digital account for Midjourney Pro
  await prisma.digitalStock.create({
    data: {
      productId: midjourney.id,
      type: 'login-info',
      content: JSON.stringify({
        email: 'midjourney.pro1@shopauto247.com',
        password: 'MjProPass_7721!',
        loginUrl: 'https://www.midjourney.com/login',
        expiresAt: 'หมดประกัน 30 วัน',
        instructions: '⚠️ ขั้นตอนล็อกอิน:\n1. ไปที่เว็บ midjourney.com\n2. เลือก Sign In และผ่านการยืนยัน Discord ด้วยข้อมูลบัญชีด้านบน\n3. ห้ามเปลี่ยนรหัสผ่านเพื่อไม่ให้หลุดสิทธิ์การประกัน',
      }),
    },
  })

  console.log('✅ Database Seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
