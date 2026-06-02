import { NextResponse } from 'next/server'
import { delay } from '@/lib/utils'
import prisma, { syncProductStock } from '@/lib/db'
import { CartItem } from '@/types'
import { sendTelegramNotify } from '@/lib/telegram'
import { sendOrderReceiptEmail } from '@/lib/mailer'

/**
 * POST /api/slip
 * ตรวจสอบสลิป + ตัดสต็อก DigitalStock จริง
 * Fallback: หาก stock หมด → status = 'needs_manual_delivery' (ไม่แสดง error)
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const orderNumber = formData.get('orderId') as string
    const slipFile = formData.get('slip') as File

    if (!orderNumber || !slipFile) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุรหัสออเดอร์และรูปภาพสลิป' },
        { status: 400 }
      )
    }

    // 1. ค้นหาออเดอร์
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        deliveryItems: true,
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json(
        { success: false, error: `ไม่พบออเดอร์เลขที่ ${orderNumber} ในระบบ` },
        { status: 404 }
      )
    }

    // หากออเดอร์สำเร็จหรือรอดำเนินการอยู่แล้ว ให้ห้ามอัปโหลดสลิปซ้ำ
    if (['completed', 'needs_manual_delivery'].includes((order as any).status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'ออเดอร์นี้ได้รับการยืนยันหรืออยู่ระหว่างจัดส่งแล้ว ไม่สามารถอัปโหลดสลิปซ้ำได้',
        },
        { status: 400 }
      )
    }

    // 2. จำลอง AI OCR สแกนสลิป 2 วินาที
    await delay(2000)

    // 3. อ่านรายการสินค้าจาก OrderItem ในฐานข้อมูลเท่านั้น
    // ห้ามเชื่อ cartItems จาก client เพราะลูกค้าสามารถแก้ข้อมูลฝั่งตัวเองได้
    const cartItems: CartItem[] = (order as any).orderItems.map((orderItem: any) => ({
      product: {
        ...orderItem.product,
        stockStatus: orderItem.product.stockStatus as any,
        category: orderItem.product.category as any,
        deliveryType: orderItem.product.deliveryType === 'manual' ? 'manual' : 'auto',
      },
      quantity: orderItem.quantity,
    }))

    if (cartItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรายการสินค้าในออเดอร์นี้' },
        { status: 400 }
      )
    }

    // =============================================
    // 4. ตรวจสอบ Stock ก่อนตัด (Single Source of Truth) & แยก Auto / Manual
    // =============================================
    const autoItems: CartItem[] = []
    const manualItems: CartItem[] = []
    const deliveryItemsToSave: any[] = []
    const stockIdsToUpdate: string[] = []

    for (const item of cartItems) {
      if (item.product.deliveryType === 'manual') {
        manualItems.push(item)
        continue
      }

      // ดึงและจองคีย์ใน transaction เพื่อกันการหยิบคีย์ซ้ำตอนมีหลายออเดอร์พร้อมกัน
      const unusedKeys = await prisma.$transaction(async (tx) => {
        const availableKeys = await tx.digitalStock.findMany({
          where: { productId: item.product.id, isSold: false },
          take: item.quantity,
        })

        if (availableKeys.length !== item.quantity) {
          return []
        }

        const keyIds = availableKeys.map((k: any) => k.id)
        const updateResult = await tx.digitalStock.updateMany({
          where: { id: { in: keyIds }, isSold: false },
          data: { isSold: true, orderId: (order as any).id },
        })

        if (updateResult.count !== keyIds.length) {
          throw new Error('STOCK_RACE_CONDITION')
        }

        return availableKeys
      }).catch((error) => {
        if (error instanceof Error && error.message === 'STOCK_RACE_CONDITION') {
          return []
        }
        throw error
      })

      // Stock Verification: เช็คว่าจำนวนคีย์ที่ดึงมาได้ length เท่ากับ item.quantity หรือไม่
      if (unusedKeys.length === item.quantity) {
        // สต๊อกครบ: เตรียมส่งคีย์ทั้งหมดให้ลูกค้า
        autoItems.push(item)
        stockIdsToUpdate.push(...unusedKeys.map((k: any) => k.id))

        unusedKeys.forEach((stockItem: any) => {
          try {
            const content = JSON.parse(stockItem.content)
            deliveryItemsToSave.push({
              productName: item.product.name,
              type: stockItem.type,
              creditCode: content.creditCode || null,
              creditAmount: content.creditAmount || null,
              platform: content.platform || null,
              email: content.email || null,
              password: content.password || null,
              loginUrl: content.loginUrl || null,
              licenseKey: content.licenseKey || null,
              expiresAt: content.expiresAt || null,
              instructions: content.instructions || null,
            })
          } catch (e) { console.error('Error parsing stock content:', e) }
        })
      } else {
        // ไม่ครบ (สต๊อกขาด): Fallback กลับไปเป็น 'รอดำเนินการโดยแอดมิน'
        manualItems.push(item)
      }
    }

    const needsManualDelivery = manualItems.length > 0
    const finalStatus = needsManualDelivery ? 'needs_manual_delivery' : 'completed'

    // =============================================
    // 5. อัปเดตตาราง DigitalStock สำหรับสินค้า Auto ทั้งหมด
    // =============================================
    if (stockIdsToUpdate.length > 0) {
      // คีย์ถูกจองใน transaction แล้ว ตรงนี้ sync stock count กลับ Product เท่านั้น
      const autoProductIds = Array.from(new Set(autoItems.map(i => i.product.id)))
      for (const pid of autoProductIds) {
        await syncProductStock(pid)
      }
    }

    // =============================================
    // 6. อัปเดตออเดอร์, ส่งมอบ DeliveryItems, และแจ้ง Line
    // =============================================
    await prisma.order.update({
      where: { id: (order as any).id },
      data: {
        status: finalStatus,
        slipUrl: slipFile.name || 'slip_paid.png',
        deliveryItems: {
          create: deliveryItemsToSave,
        },
      },
    })

    // =============================================
    // 6.5 อัปเดต usedCount ของคูปองส่วนลด (ถ้ามี)
    // =============================================
    if ((order as any).discountCode) {
      await prisma.discountCode.update({
        where: { code: (order as any).discountCode },
        data: { usedCount: { increment: 1 } },
      }).catch(err => console.error('Failed to increment discount code usage:', err))
    }

    const completedOrder = await prisma.order.findUnique({
      where: { id: (order as any).id },
      include: { deliveryItems: true },
    })

    if (completedOrder) {
      const emailItems = (completedOrder as any).deliveryItems.length > 0
        ? (completedOrder as any).deliveryItems
        : cartItems.map((item) => ({
            productName: item.product.name,
            type: item.product.deliveryType === 'manual' ? 'manual' : 'order-item',
            quantity: item.quantity,
          }))

      void sendOrderReceiptEmail(
        (completedOrder as any).orderNumber,
        (completedOrder as any).customerEmail,
        emailItems
      ).catch((emailErr) => console.error('Order receipt email failed:', emailErr))
    }

    // =============================================
    // 7. แจ้งเตือน Telegram — เฉพาะออเดอร์ที่แอดมินต้องดำเนินการ
    // (ออเดอร์ Auto 100% ไม่ส่ง เพื่อลด Noise)
    // =============================================
    if (needsManualDelivery) {
      try {
        const orderNo = (completedOrder as any).orderNumber
        const customerName = (completedOrder as any).customerName
        const customerEmail = (completedOrder as any).customerEmail
        const total = (completedOrder as any).total
        const timeTh = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })

        const manualList = manualItems.map(i => `  • ${i.product.name} x${i.quantity}`).join('\n')

        const message = [
          `🔔 มีคำสั่งซื้อใหม่! ⏳`,
          `📬 เลขออเดอร์: ${orderNo}`,
          `🕒 เวลา: ${timeTh}`,
          `👤 ลูกค้า: ${customerName}`,
          `📧 อีเมล: ${customerEmail}`,
          `💰 ยอดชำระ: ฿${total.toLocaleString('th-TH')}`,
          `📦 สถานะ: มีรายการรอแอดมินจัดส่ง`,
          `\n⏳ สินค้าที่รอแอดมินจัดส่ง:\n${manualList}`
        ].join('\n')

        await sendTelegramNotify(message)
      } catch (notifyErr) {
        // Telegram Notify ล้มไม่กระทบการสร้างออเดอร์
        console.error('⚠️ Telegram Notify failed (non-critical):', notifyErr)
      }
    }

    const orderSummary = {
      orderNumber: (completedOrder as any).orderNumber,
      items: cartItems,
      customer: {
        name: (completedOrder as any).customerName,
        email: (completedOrder as any).customerEmail,
        phone: (completedOrder as any).customerPhone ?? undefined,
      },
      total: (completedOrder as any).total,
      status: finalStatus,
      deliveryItems: (completedOrder as any).deliveryItems,
      createdAt: (completedOrder as any).createdAt.toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: {
        isValid: true,
        needsManualDelivery,
        order: orderSummary,
        slipDetails: {
          senderName: 'นาย สมเกียรติ ยิ่งยืน',
          amount: (completedOrder as any).total,
          transTime: new Date().toISOString(),
          refCode: `REF-${Math.floor(100000000 + Math.random() * 900000000)}`,
        },
        message: 'ชำระเงินเสร็จสมบูรณ์! ระบบส่งมอบสินค้าดิจิทัลให้คุณเรียบร้อยแล้ว 🎉',
      },
    })
  } catch (error) {
    console.error('Error verifying slip:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดทางเทคนิคในการตรวจสลิป' },
      { status: 500 }
    )
  }
}
