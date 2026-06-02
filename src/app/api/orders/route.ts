import { NextResponse } from 'next/server'
import { generateOrderNumber } from '@/lib/utils'
import prisma from '@/lib/db'
import { CartItem, DeliveryItem } from '@/types'
import { decryptDeliveryItemFields, decryptText } from '@/lib/encryption'
import { moneyToNumber } from '@/lib/money'

/**
 * Fallback Mock Delivery Item Generator
 * ใช้เมื่อสต็อกดิจิทัลในฐานข้อมูลมีน้อยกว่าจำนวนที่ลูกค้าสั่ง
 * เพื่อไม่ให้ระบบล่ม สร้างข้อมูลจำลองออกมาแทน
 */
function generateMockDeliveryItems(cartItems: CartItem[]): DeliveryItem[] {
  const items: DeliveryItem[] = []
  for (const cartItem of cartItems) {
    const product = cartItem.product
    const name = product.name.toLowerCase()
    for (let i = 0; i < cartItem.quantity; i++) {
      if (name.includes('veo') || name.includes('gemini')) {
        items.push({
          type: 'license-key',
          productName: product.name,
          licenseKey: `VEO3-FALLBACK-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          expiresAt: 'เปิดใช้งานภายใน 15 วัน',
          instructions: '💡 นำคีย์ไปรีดีมที่ Google AI Studio หรือ deepmind.google/veo-redeem',
        })
      } else if (name.includes('chatgpt') || name.includes('openai')) {
        items.push({
          type: 'login-info',
          productName: product.name,
          email: `gpt.fallback.${Date.now()}@shopauto247.com`,
          password: `GPT_Auto_${Math.random().toString(36).substring(2, 8).toUpperCase()}!`,
          loginUrl: 'https://chatgpt.com/auth/login',
          expiresAt: 'หมดประกัน 30 วัน',
          instructions: '⚠️ บัญชีสำรองฉุกเฉิน ใช้งานส่วนตัวเท่านั้น ห้ามแก้ไขรหัสผ่าน',
        })
      } else if (name.includes('claude') || name.includes('anthropic')) {
        items.push({
          type: 'login-info',
          productName: product.name,
          email: `claude.fallback.${Date.now()}@shopauto247.com`,
          password: `Claude_Auto_${Math.random().toString(36).substring(2, 8).toUpperCase()}#`,
          loginUrl: 'https://claude.ai/login',
          expiresAt: 'หมดประกัน 30 วัน',
          instructions: '⚠️ บัญชีสำรองฉุกเฉิน ใช้งานส่วนตัวเท่านั้น ห้ามแก้ไขรหัสผ่าน',
        })
      } else {
        items.push({
          type: 'ai-credit',
          productName: product.name,
          creditCode: `AI-CREDIT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          creditAmount: '$10 Credits',
          platform: product.name,
          expiresAt: 'หมดอายุใน 90 วันหลังกรอกโค้ด',
          instructions: '💡 นำโค้ดไปเคลมที่หน้าตั้งค่าการชำระเงินของแพลตฟอร์มนั้นๆ',
        })
      }
    }
  }
  return items
}

/**
 * POST /api/orders
 * สร้าง Order ใหม่ในฐานข้อมูล SQLite (สถานะ 'pending')
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { items, customer, discountCode } = body

    if (!Array.isArray(items) || items.length === 0 || !customer) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน (items, customer)' },
        { status: 400 }
      )
    }

    if (!customer.name || !customer.email) {
      return NextResponse.json(
        { success: false, error: 'กรุณากรอกชื่อและอีเมลให้ครบถ้วน' },
        { status: 400 }
      )
    }

    const normalizedItems = items.map((item: any) => {
      const productId = typeof item?.productId === 'string' ? item.productId : ''
      const quantity = Number(item?.quantity)

      return { productId, quantity }
    })

    if (
      normalizedItems.some(
        (item) => !item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0
      )
    ) {
      return NextResponse.json(
        { success: false, error: 'รายการสินค้าไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const orderNumber = generateOrderNumber()

    // 1. ตรวจสอบสถานะสต็อกจาก DigitalStock ก่อนอนุญาตให้สร้างออเดอร์
    const stocksToAssign: string[] = []
    let verifiedSubTotal = 0
    const verifiedProducts: any[] = []
    const verifiedOrderItems: { productId: string; quantity: number; price: number }[] = []
    for (const item of normalizedItems) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      })

      if (!product) {
        return NextResponse.json(
          {
            success: false,
            error: `ไม่พบสินค้า ID ${item.productId} ในระบบ`,
          },
          { status: 404 }
        )
      }

      const productPrice = moneyToNumber(product.price)
      verifiedSubTotal += productPrice * item.quantity
      verifiedProducts.push(product)
      verifiedOrderItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: productPrice,
      })

      if (product.deliveryType === 'manual') {
        if (product.stockStatus === 'out-of-stock' || product.stock < item.quantity) {
          return NextResponse.json(
            {
              success: false,
              error: `ขออภัย สินค้า "${product.name}" หมดชั่วคราว`,
            },
            { status: 400 }
          )
        }
        continue
      }

      const availableStocks = await prisma.digitalStock.findMany({
        where: { productId: product.id, isSold: false },
        take: item.quantity
      })
      if (availableStocks.length < item.quantity) {
        return NextResponse.json(
          {
            success: false,
            error: `ขออภัย สินค้า "${product.name}" หมดชั่วคราว`,
          },
          { status: 400 }
        )
      }
      stocksToAssign.push(...availableStocks.map((s: any) => s.id))
    }

    let verifiedDiscountAmount = 0
    let verifiedDiscountCode: string | null = null

    if (discountCode) {
      const normalizedCode = String(discountCode).trim().toUpperCase()
      const discount = await prisma.discountCode.findUnique({
        where: { code: normalizedCode },
      })

      if (!discount || !discount.isActive) {
        return NextResponse.json(
          { success: false, error: 'โค้ดส่วนลดใช้ไม่ได้ กรุณาตรวจสอบอีกครั้ง' },
          { status: 400 }
        )
      }

      if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
        return NextResponse.json(
          { success: false, error: 'โค้ดส่วนลดนี้ถูกใช้ครบจำนวนแล้ว' },
          { status: 400 }
        )
      }

      if (discount.expiresAt && discount.expiresAt.getTime() < Date.now()) {
        return NextResponse.json(
          { success: false, error: 'โค้ดส่วนลดนี้หมดอายุแล้ว' },
          { status: 400 }
        )
      }

      const minPurchaseAmount = moneyToNumber(discount.minPurchaseAmount)
      if (verifiedSubTotal < minPurchaseAmount) {
        return NextResponse.json(
          { success: false, error: `ต้องมียอดสั่งซื้อขั้นต่ำ ${minPurchaseAmount.toLocaleString('th-TH')} บาท` },
          { status: 400 }
        )
      }

      const category = discount.applicableCategoryId
        ? await prisma.category.findUnique({ where: { id: discount.applicableCategoryId } })
        : null

      const hasMatchingProduct = verifiedProducts.some((product) => {
        const typeMatches = !discount.applicableType || product.deliveryType === discount.applicableType
        const categoryMatches =
          !discount.applicableCategoryId ||
          product.categoryId === discount.applicableCategoryId ||
          product.category === discount.applicableCategoryId ||
          product.category === category?.slug
        return typeMatches && categoryMatches
      })

      if (!hasMatchingProduct) {
        return NextResponse.json(
          { success: false, error: 'คูปองนี้ใช้ไม่ได้กับสินค้าในตะกร้า' },
          { status: 400 }
        )
      }

      if (discount.discountType === 'PERCENT') {
        const percent = Math.min(Math.max(moneyToNumber(discount.discountValue), 0), 100)
        verifiedDiscountAmount = Math.round(verifiedSubTotal * (percent / 100))
      } else if (discount.discountType === 'FIXED') {
        verifiedDiscountAmount = Math.min(Math.max(moneyToNumber(discount.discountValue), 0), verifiedSubTotal)
      } else {
        return NextResponse.json(
          { success: false, error: 'รูปแบบโค้ดส่วนลดไม่ถูกต้อง' },
          { status: 400 }
        )
      }

      verifiedDiscountCode = discount.code
    }

    const verifiedTotal = Math.max(0, verifiedSubTotal - verifiedDiscountAmount)

    // 2. สร้างบิลออเดอร์ใหม่ใน SQLite
    const newOrder = await prisma.order.create({
      data: {
        orderNumber,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone || null,
        total: verifiedTotal,
        subTotal: verifiedSubTotal,
        discountCode: verifiedDiscountCode,
        discountAmount: verifiedDiscountAmount,
        status: 'pending',
        orderItems: {
          create: verifiedOrderItems,
        },
      },
    })

    // 3. ผูก DigitalStock และตัดสต๊อก (isSold = true)
    // - ถูกย้ายไปทำในขั้นตอนตรวจสอบสลิป (api/slip/route.ts) เพื่อไม่ให้ตัดสต๊อกถ้ายังไม่จ่ายเงิน

    // บันทึกรายการสินค้าที่สั่งลงในออเดอร์ (ในที่นี้เราใช้ claimedStock / DeliveryItem ในภายหลังตอนโอนเงินสำเร็จ)
    // แต่เพื่อความปลอดภัยในการเก็บข้อมูลฝั่งผู้ดูแลระบบ เราจะบันทึกคีย์ชั่วคราวหรือรหัสรายการสินค้าลงออเดอร์
    // โดยในขั้นนี้เราจะสืบค้นหรือเก็บเซสชันสินค้าไว้ในฝั่ง Client (Zustand) และประมวลผลตอนส่ง Slip

    return NextResponse.json({
      success: true,
      data: {
        orderNumber,
        status: newOrder.status,
        total: moneyToNumber(newOrder.total),
        createdAt: newOrder.createdAt.toISOString(),
        message: 'ออเดอร์ถูกสร้างในระบบฐานข้อมูลเรียบร้อย กรุณาชำระเงิน',
      },
    })
  } catch (error) {
    console.error('Error creating order in DB:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการสร้างออเดอร์ลงฐานข้อมูล' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/orders?orderNumber=SA-...
 * ตรวจสอบและดึงข้อมูลออเดอร์จาก SQLite พร้อมรายการสินค้าจัดส่ง
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderNumber = searchParams.get('orderNumber')

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ Order Number' },
        { status: 400 }
      )
    }

    // ดึงข้อมูลออเดอร์พร้อมรายการ Digital Delivery
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        deliveryItems: true,
        orderItems: {
          include: {
            product: true
          }
        },
        claimedStocks: {
          include: {
            product: true
          }
        }
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบออเดอร์ที่ระบุในระบบหลังบ้าน' },
        { status: 404 }
      )
    }

    // แปลงข้อมูลออเดอร์ให้อยู่ในฟอร์แมต OrderSummary ที่มี types สอดคล้องกัน
    const orderSummary = {
      orderNumber: order.orderNumber,
      items: order.orderItems.map((item: any) => ({
        product: {
          id: item.product.id,
          name: item.product.name,
          description: item.product.description,
          price: moneyToNumber(item.product.price),
          originalPrice: item.product.originalPrice ? moneyToNumber(item.product.originalPrice) : undefined,
          image: item.product.image,
          category: item.product.category,
          stock: item.product.stock,
          stockStatus: item.product.stockStatus,
          tags: item.product.tags,
          isNew: item.product.isNew,
          isFeatured: item.product.isFeatured,
          deliveryInfo: item.product.deliveryInfo ?? undefined,
          deliveryType: item.product.deliveryType === 'manual' ? 'manual' : 'auto',
        },
        quantity: item.quantity,
      })),
      customer: {
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone ?? undefined,
      },
      total: moneyToNumber(order.total),
      status: order.status as any,
      deliveredContent: order.deliveredContent ? decryptText(order.deliveredContent) : undefined,
      deliveryItems: [
        ...order.deliveryItems.map((item: any) => decryptDeliveryItemFields({
          type: item.type as any,
          productName: item.productName,
          creditCode: item.creditCode ?? undefined,
          creditAmount: item.creditAmount ?? undefined,
          platform: item.platform ?? undefined,
          email: item.email ?? undefined,
          password: item.password ?? undefined,
          loginUrl: item.loginUrl ?? undefined,
          licenseKey: item.licenseKey ?? undefined,
          expiresAt: item.expiresAt ?? undefined,
          instructions: item.instructions ?? undefined,
        })),
        ...order.claimedStocks.map((stock: any) => {
          let parsed: any = {}
          try { parsed = JSON.parse(decryptText(stock.content)) } catch(e) {}
          return {
            type: stock.type || 'login-info',
            productName: stock.product?.name || 'Unknown Product',
            email: parsed.email || undefined,
            password: parsed.password || undefined,
            creditCode: parsed.creditCode || undefined,
            creditAmount: parsed.creditAmount || undefined,
            platform: parsed.platform || undefined,
            loginUrl: parsed.loginUrl || undefined,
            licenseKey: parsed.licenseKey || undefined,
            instructions: parsed.instructions || undefined,
          }
        })
      ],
      createdAt: order.createdAt.toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: orderSummary,
    })
  } catch (error) {
    console.error('Error fetching order from DB:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูลออเดอร์' },
      { status: 500 }
    )
  }
}
