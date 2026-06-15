import prisma, { syncProductStock } from '@/lib/db'
import { sendOrderReceiptEmail } from '@/lib/mailer'
import { sendTelegramNotify } from '@/lib/telegram'
import { decryptDeliveryItemFields, decryptText, encryptDeliveryItemFields } from '@/lib/encryption'
import { moneyToNumber, normalizeProductMoney } from '@/lib/money'
import type { CartItem } from '@/types'

type FulfillPaidOrderResult = {
  orderId: string
  orderNumber: string
  status: 'completed' | 'needs_manual_delivery'
  needsManualDelivery: boolean
  deliveryItems: Record<string, unknown>[]
}

export async function fulfillPaidOrder(
  orderIdOrNumber: string,
  paymentMarker = 'truemoney-voucher'
): Promise<FulfillPaidOrderResult> {
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { id: orderIdOrNumber },
        { orderNumber: orderIdOrNumber },
      ],
    },
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
    throw new Error('ORDER_NOT_FOUND')
  }

  if (['completed', 'needs_manual_delivery'].includes(order.status)) {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status as 'completed' | 'needs_manual_delivery',
      needsManualDelivery: order.status === 'needs_manual_delivery',
      deliveryItems: order.deliveryItems.map(decryptDeliveryItemFields),
    }
  }

  const cartItems: CartItem[] = order.orderItems.map((orderItem) => {
    const product = normalizeProductMoney(orderItem.product)

    return {
      product: {
      ...product,
      originalPrice: product.originalPrice ?? undefined,
      features: product.features ?? undefined,
      deliveryInfo: product.deliveryInfo ?? undefined,
      instruction: product.instruction ?? undefined,
      stockStatus: orderItem.product.stockStatus as any,
      category: orderItem.product.category as any,
      deliveryType: orderItem.product.deliveryType === 'manual' ? 'manual' : 'auto',
      },
      quantity: orderItem.quantity,
    }
  })

  if (cartItems.length === 0) {
    throw new Error('ORDER_HAS_NO_ITEMS')
  }

  const autoItems: CartItem[] = []
  const manualItems: CartItem[] = []
  const deliveryItemsToSave: any[] = []

  for (const item of cartItems) {
    if (item.product.deliveryType === 'manual') {
      manualItems.push(item)
      continue
    }

    const claimedKeys = await prisma.$transaction(async (tx) => {
      const availableKeys = await tx.digitalStock.findMany({
        where: { productId: item.product.id, isSold: false },
        take: item.quantity,
      })

      if (availableKeys.length !== item.quantity) {
        return []
      }

      const keyIds = availableKeys.map((key) => key.id)
      const updateResult = await tx.digitalStock.updateMany({
        where: { id: { in: keyIds }, isSold: false },
        data: { isSold: true, orderId: order.id },
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

    if (claimedKeys.length !== item.quantity) {
      void sendTelegramNotify(
        `⚠️ ออเดอร์ ${order.orderNumber} จ่ายเงินแล้ว แต่สต็อกดิจิทัลหมดกระทันหัน (ชนกัน) ต้องจัดส่งคีย์แบบ Manual!`
      ).catch((error) => {
        console.error('Stock race Telegram Notify failed (non-critical):', error)
      })

      manualItems.push(item)
      continue
    }

    autoItems.push(item)

    for (const stockItem of claimedKeys) {
      try {
        const content = JSON.parse(decryptText(stockItem.content))
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
          showInstruction: stockItem.showInstruction !== false,
          instructions: stockItem.showInstruction === false
            ? null
            : stockItem.instruction || content.instructions || 'เปิดใช้งานสินค้าตามคำแนะนำของทางร้าน',
        })
      } catch (error) {
        console.error('Error parsing stock content:', error)
        manualItems.push(item)
      }
    }
  }

  const needsManualDelivery = manualItems.length > 0
  const finalStatus = needsManualDelivery ? 'needs_manual_delivery' : 'completed'

  const autoProductIds = Array.from(new Set(autoItems.map((item) => item.product.id)))
  for (const productId of autoProductIds) {
    await syncProductStock(productId)

    const remainingStock = await prisma.digitalStock.count({
      where: { productId, isSold: false },
    })

    if (remainingStock === 0) {
      const soldOutProduct = autoItems.find((item) => item.product.id === productId)?.product
      const productName = soldOutProduct?.name || productId

      void sendTelegramNotify([
        '🚨 [เตือนด่วน] สต็อกสินค้าหมดเกลี้ยง!',
        `สินค้า: ${productName}`,
        'สถานะ: คงเหลือ 0 ชิ้น',
        'ระบบส่งอัตโนมัติจะหยุดทำงานสำหรับสินค้านี้ จนกว่าจะเติมสต็อก',
      ].join('\n')).catch((error) => {
        console.error('Sold-out Telegram Notify failed (non-critical):', error)
      })
    }
  }

  const completedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: finalStatus,
      slipUrl: paymentMarker,
      deliveryItems: {
        create: deliveryItemsToSave.map(encryptDeliveryItemFields),
      },
    },
    include: {
      deliveryItems: true,
    },
  })

  if (order.discountCode) {
    await prisma.discountCode.update({
      where: { code: order.discountCode },
      data: { usedCount: { increment: 1 } },
    }).catch((error) => console.error('Failed to increment discount code usage:', error))
  }

  const decryptedDeliveryItems = completedOrder.deliveryItems.map(decryptDeliveryItemFields)
  const emailItems = decryptedDeliveryItems.length > 0
    ? decryptedDeliveryItems
    : cartItems.map((item) => ({
        productName: item.product.name,
        type: item.product.deliveryType === 'manual' ? 'manual' : 'order-item',
        quantity: item.quantity,
      }))

  void sendOrderReceiptEmail(
    completedOrder.orderNumber,
    completedOrder.customerEmail,
    emailItems
  ).catch((error) => console.error('Order receipt email failed:', error))

  if (needsManualDelivery) {
    const manualList = manualItems.map((item) => `- ${item.product.name} x${item.quantity}`).join('\n')
    const message = [
      'มีคำสั่งซื้อที่ต้องให้แอดมินจัดส่ง',
      `เลขออเดอร์: ${completedOrder.orderNumber}`,
      `ลูกค้า: ${completedOrder.customerName}`,
      `อีเมล: ${completedOrder.customerEmail}`,
      `ยอดชำระ: ฿${moneyToNumber(completedOrder.total).toLocaleString('th-TH')}`,
      '',
      manualList,
    ].join('\n')

    void sendTelegramNotify(message).catch((error) => {
      console.error('Telegram Notify failed (non-critical):', error)
    })
  }

  return {
    orderId: completedOrder.id,
    orderNumber: completedOrder.orderNumber,
    status: finalStatus,
    needsManualDelivery,
    deliveryItems: decryptedDeliveryItems,
  }
}
