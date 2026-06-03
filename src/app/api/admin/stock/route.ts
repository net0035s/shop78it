import { NextResponse } from 'next/server'
import prisma, { syncProductStock } from '@/lib/db'
import { decryptText, encryptText } from '@/lib/encryption'

/**
 * POST /api/admin/stock
 * เติมสต็อกสินค้าดิจิทัลแบบหลายรายการ
 * หลังเพิ่มแล้วจะ sync จำนวนสต็อกจาก DigitalStock ที่ยังไม่ขายจริง
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { productId, type, bulkData, instructions } = body

    if (!productId || !type || !bulkData) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ครบถ้วน (productId, type, bulkData)' },
        { status: 400 }
      )
    }

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบสินค้าที่จะเติมสต็อก' },
        { status: 404 }
      )
    }

    const lines = String(bulkData)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    if (lines.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลคีย์หรือรหัสที่กรอก กรุณาป้อนอย่างน้อย 1 บรรทัด' },
        { status: 400 }
      )
    }

    const dataToInsert = lines.map((line) => {
      let contentObj: Record<string, string> = {}

      if (type === 'license-key') {
        contentObj = {
          licenseKey: line,
          instructions: instructions || 'เปิดใช้งานคีย์ตามคำแนะนำของทางร้าน',
          expiresAt: 'ไม่มีวันหมดอายุ',
        }
      } else if (type === 'login-info') {
        const parts = line.split(/[|:]/)
        contentObj = {
          email: parts[0]?.trim() || line,
          password: parts[1]?.trim() || 'Password123!',
          loginUrl: parts[2]?.trim() || 'https://www.google.com',
          expiresAt: 'รับประกัน 30 วันนับจากวันที่ซื้อ',
          instructions: instructions || 'ล็อกอินใช้งานส่วนตัว ห้ามแชร์บัญชีหรือเปลี่ยนรหัสผ่าน',
        }
      } else if (type === 'login-link') {
        contentObj = {
          loginUrl: line,
          expiresAt: 'ใช้งานได้ภายใน 7 วันนับจากวันที่ซื้อ',
          instructions: instructions || 'คลิกลิงก์เพื่อเข้าใช้งานระบบสมาชิกพรีเมียม',
        }
      } else if (type === 'ai-credit') {
        const productName = product.name || ''
        contentObj = {
          creditCode: line,
          creditAmount: '$10 Credits',
          platform: productName.includes('ChatGPT') ? 'ChatGPT'
            : productName.includes('Claude') ? 'Claude'
            : 'AI Services',
          expiresAt: 'หมดอายุใน 90 วันหลังกรอกโค้ด',
          instructions: instructions || 'นำโค้ดไปเคลมที่หน้าตั้งค่าการชำระเงินของบริการ AI',
        }
      } else {
        contentObj = {
          value: line,
          instructions: instructions || '',
        }
      }

      return {
        productId,
        type,
        content: encryptText(JSON.stringify(contentObj)),
        isSold: false,
      }
    })

    await prisma.digitalStock.createMany({
      data: dataToInsert,
    })

    await syncProductStock(productId)

    const newStock = await prisma.digitalStock.count({
      where: { productId, isSold: false },
    })

    return NextResponse.json({
      success: true,
      message: `เติมคลังสินค้าสำเร็จ ${lines.length} รายการ`,
      countAdded: lines.length,
      newStock,
    })
  } catch (error) {
    console.error('Error adding admin stock:', error)
    return NextResponse.json(
      { success: false, error: 'เกิดข้อผิดพลาดในการเติมสต็อก' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/stock?productId=xxx
 * ดึงรายการสต็อกทั้งหมดของสินค้านั้น
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ productId' }, { status: 400 })
    }

    const stocks = await prisma.digitalStock.findMany({
      where: { productId },
      orderBy: [
        { isSold: 'asc' },
        { id: 'desc' },
      ],
    })

    const decryptedStocks = stocks.map((stock) => ({
      ...stock,
      content: decryptText(stock.content),
    }))

    return NextResponse.json({ success: true, data: decryptedStocks })
  } catch (error) {
    console.error('Error fetching stocks:', error)
    return NextResponse.json(
      { success: false, error: 'ดึงข้อมูลสต็อกล้มเหลว' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/stock?id=xxx
 * แก้ไขข้อมูล content ของสต็อก
 */
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const body = await request.json()
    const { content } = body

    if (!id || !content) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      )
    }

    const existing = await prisma.digitalStock.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรายการสต็อก' },
        { status: 404 }
      )
    }

    const updated = await prisma.digitalStock.update({
      where: { id },
      data: { content: encryptText(JSON.stringify(content)) },
    })

    return NextResponse.json({
      success: true,
      message: 'แก้ไขสต็อกสำเร็จ',
      data: { ...updated, content: decryptText(updated.content) },
    })
  } catch (error) {
    console.error('Error updating stock:', error)
    return NextResponse.json(
      { success: false, error: 'แก้ไขสต็อกล้มเหลว' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/stock?id=xxx
 * ลบสต็อก เฉพาะรายการที่ยังไม่ขาย
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ ID ของสต็อก' },
        { status: 400 }
      )
    }

    const existing = await prisma.digitalStock.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรายการสต็อก' },
        { status: 404 }
      )
    }

    if (existing.isSold) {
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถลบสต็อกที่ขายไปแล้วได้' },
        { status: 400 }
      )
    }

    await prisma.digitalStock.delete({ where: { id } })
    await syncProductStock(existing.productId)

    return NextResponse.json({ success: true, message: 'ลบสต็อกสำเร็จ' })
  } catch (error) {
    console.error('Error deleting stock:', error)
    return NextResponse.json(
      { success: false, error: 'ลบสต็อกล้มเหลว' },
      { status: 500 }
    )
  }
}
