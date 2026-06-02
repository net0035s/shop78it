import { StockStatus } from '@/types'

/**
 * คำนวณสถานะสต็อกจากจำนวนสินค้า
 * - > 5   → 'in-stock'   (พร้อมส่ง)
 * - 1–5   → 'low-stock'  (ใกล้หมด)
 * - 0     → 'out-of-stock' (หมด)
 */
export function getStockStatus(stock: number): StockStatus {
  if (stock <= 0) return 'out-of-stock'
  if (stock <= 5) return 'low-stock'
  return 'in-stock'
}

/**
 * ข้อมูลแสดงผลของแต่ละสถานะสต็อก
 */
export const STOCK_STATUS_CONFIG: Record<
  StockStatus,
  {
    label: string
    color: string
    bgColor: string
    borderColor: string
    dotColor: string
    canOrder: boolean
  }
> = {
  'in-stock': {
    label: 'พร้อมส่ง',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    dotColor: 'bg-green-400',
    canOrder: true,
  },
  'low-stock': {
    label: 'ใกล้หมด',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    dotColor: 'bg-amber-400',
    canOrder: true,
  },
  'out-of-stock': {
    label: 'หมด',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    dotColor: 'bg-red-500',
    canOrder: false,
  },
}

/**
 * แปลงสถานะที่อาจเป็นตัวพิมพ์ใหญ่ (เช่น 'IN_STOCK') ให้เป็นรูปแบบที่ระบบรู้จัก
 */
function normalizeStatus(status: string): StockStatus {
  if (status === 'IN_STOCK' || status === 'IN_STOCK') return 'in-stock';
  if (status === 'OUT_OF_STOCK' || status === 'OUT_OF_STOCK') return 'out-of-stock';
  if (status === 'LOW_STOCK' || status === 'LOW_STOCK') return 'low-stock';
  // Fallback to lowercase conversion if needed
  const normalized = (status || '').toLowerCase().replace(/_/g, '-') as StockStatus;
  return STOCK_STATUS_CONFIG[normalized] ? normalized : 'out-of-stock';
}

/**
 * แสดงข้อความ label ของสถานะ
 */
export function getStockLabel(status: StockStatus | string): string {
  const normalized = normalizeStatus(status as string)
  return STOCK_STATUS_CONFIG[normalized]?.label || 'Unknown'
}

/**
 * ตรวจสอบว่าสั่งซื้อได้หรือไม่
 */
export function canOrder(status: StockStatus | string): boolean {
  const normalized = normalizeStatus(status as string)
  return STOCK_STATUS_CONFIG[normalized]?.canOrder || false
}
