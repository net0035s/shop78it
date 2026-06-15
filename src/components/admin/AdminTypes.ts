export type AdminOrderStatus = 'pending' | 'completed' | 'needs_manual_delivery' | 'cancelled'

export type AdminStockContent = Record<string, unknown> | string

export interface AdminCategory {
  id: string
  name: string
  slug: string
  icon: string
  color: string
  sortOrder: number
  isActive: boolean
}

export interface AdminProduct {
  id: string
  name: string
  description?: string
  price: number
  originalPrice?: number | null
  image?: string
  category: string
  categoryId?: string | null
  stock: number
  stockStatus: string
  tags?: string | string[] | null
  isNew?: boolean
  isFeatured?: boolean
  showFeatures?: boolean
  showInstruction?: boolean
  instruction?: string | null
  deliveryInfo?: string | null
  deliveryType?: 'auto' | 'manual' | string
}

export interface AdminDeliveryItem {
  productName: string
  type: string
  licenseKey?: string | null
  email?: string | null
  password?: string | null
  showInstruction?: boolean
  instructions?: string | null
}

export interface AdminOrder {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  total: number
  status: AdminOrderStatus | string
  createdAt: string | Date
  deliveredContent?: string | null
  deliveryItems?: AdminDeliveryItem[]
  slipUrl?: string | null
}

export interface AdminDigitalStock {
  id: string
  productId?: string
  type: string
  content: string
  showInstruction?: boolean
  instruction?: string | null
  orderId?: string | null
  createdAt?: string | Date
  product?: Pick<AdminProduct, 'id' | 'name'>
  order?: Pick<AdminOrder, 'id' | 'orderNumber'>
}

export interface AdminStats {
  todayRevenue: number
  monthRevenue: number
  pendingOrders: number
  lowStockProducts: Array<AdminProduct & { unsoldCount: number }>
  last7Days: { label: string; orders: number; revenue: number }[]
  recentOrders: AdminOrder[]
}
