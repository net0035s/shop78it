import { type ClassValue, clsx } from 'clsx'

/**
 * ผสม class names ด้วย clsx
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/**
 * หน่วงเวลา (async delay)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * ตัดข้อความให้สั้นลง
 */
export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.slice(0, length)}...` : str
}

/**
 * สร้าง Order Number แบบสุ่ม
 */
export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `SA-${timestamp}-${random}`
}

/**
 * ฟอร์แมตวันที่พร้อมเวลา
 */
export function formatDateWithTime(dateStr: string | Date): string {
  const d = new Date(dateStr)
  const datePart = d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timePart = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} เวลา ${timePart} น.`
}
