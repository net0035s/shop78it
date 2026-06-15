// ============================================
// PRODUCT TYPES
// ============================================

export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock'

// รองรับ slug ที่สร้างจาก Admin ได้ทุกค่า (Dynamic Categories)
export type ProductCategory = string


export interface Product {
  id: string
  name: string
  description: string
  price: number
  originalPrice?: number // ราคาก่อนลด
  image: string
  category: ProductCategory
  stock?: number
  stockStatus: StockStatus
  tags?: string | string[]
  isNew?: boolean
  isFeatured?: boolean
  showFeatures?: boolean
  showInstruction?: boolean
  instruction?: string
  deliveryInfo?: string // เช่น "ส่งทันที", "1-3 วัน"
  deliveryType?: 'auto' | 'manual'
}

// ============================================
// CART TYPES
// ============================================

export interface CartItem {
  product: Product
  quantity: number
}

export interface Cart {
  items: CartItem[]
  total: number
  itemCount: number
}

// ============================================
// ORDER TYPES (สำหรับขั้นตอนถัดไป)
// ============================================

export type OrderStatus =
  | 'pending'        // รอชำระเงิน
  | 'verifying'      // กำลังตรวจสลิป
  | 'confirmed'      // ยืนยันแล้ว
  | 'processing'     // กำลังดำเนินการ
  | 'completed'      // เสร็จสิ้น
  | 'cancelled'      // ยกเลิก

export interface Order {
  id: string
  orderNumber: string
  customer: CustomerInfo
  items: CartItem[]
  total: number
  status: OrderStatus
  paymentMethod?: string
  slipUrl?: string
  createdAt: Date
  updatedAt: Date
}

export interface CustomerInfo {
  name: string
  email: string
  phone?: string
  address?: string
}

// ============================================
// PAYMENT TYPES (สำหรับขั้นตอนถัดไป)
// ============================================

export type PaymentMethod = 'promptpay' | 'bank-transfer' | 'credit-card'

export interface PaymentIntent {
  orderId: string
  amount: number
  method: PaymentMethod
  qrCodeUrl?: string       // สำหรับ PromptPay QR
  bankAccountNumber?: string
  expiresAt?: Date
}

// ============================================
// SLIP VERIFICATION TYPES (สำหรับขั้นตอนถัดไป)
// ============================================

export interface SlipVerificationRequest {
  orderId: string
  slipImage: File | string // File object หรือ base64
}

export interface SlipVerificationResult {
  isValid: boolean
  amount?: number
  transferTime?: Date
  sender?: string
  receiver?: string
  referenceCode?: string
  errorMessage?: string
}

// ============================================
// CHECKOUT TYPES (Phase 2)
// ============================================

export type CheckoutStep = 'info' | 'payment'

export interface CheckoutFormData {
  name: string
  email: string
  phone?: string
}

// ============================================
// DELIVERY / PRODUCT KEY TYPES (Phase 2)
// ============================================

export type DeliveryType =
  | 'ai-credit'      // โค้ดเครดิต AI เช่น ChatGPT, Claude, Midjourney
  | 'login-info'     // Email + Password สำหรับ Login
  | 'login-link'     // ลิงก์ Login พร้อม Token
  | 'license-key'    // License Key ทั่วไป

export interface DeliveryItem {
  type: DeliveryType
  productName: string
  // สำหรับ AI Credit
  creditCode?: string
  creditAmount?: string      // เช่น "$10 Credits"
  platform?: string          // เช่น "ChatGPT", "Claude", "Midjourney"
  // สำหรับ Login Info
  email?: string
  password?: string
  loginUrl?: string
  // สำหรับ License Key
  licenseKey?: string
  // ข้อมูลทั่วไป
  expiresAt?: string         // วันหมดอายุ
  showInstruction?: boolean
  instructions?: string      // วิธีใช้งาน
  supportUrl?: string
}

export interface OrderSummary {
  orderNumber: string
  items: CartItem[]
  customer: CheckoutFormData
  total: number
  status: OrderStatus
  deliveryItems?: DeliveryItem[]
  createdAt: string
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}
