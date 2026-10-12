import { Store, Zap, Shield, Clock, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { supportContact } from '@/lib/support'

const LINE_URL = supportContact().href

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border/50 bg-surface/50 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-gradient flex items-center justify-center shadow-lg shadow-primary/25">
                <Store className="w-4 h-4 text-white" />
              </div>
              <span className="font-black text-lg text-textPrimary">
                Shop<span className="text-primary">78</span><span className="text-accent">it</span>
              </span>
            </div>
            <p className="text-textMuted text-sm leading-relaxed">
              เลือกซื้อสินค้าดิจิทัลและติดตามออเดอร์บนเว็บไซต์
              ตรวจชนิดและเวลาจัดส่งของสินค้าก่อนสั่งซื้อ
            </p>
            <div className="flex gap-3">
              {[
                { icon: Shield, label: 'ยืนยันก่อนรับสินค้า' },
                { icon: Clock, label: 'ติดตามออเดอร์' },
                { icon: Zap, label: 'อัตโนมัติ / ร้านจัดส่ง' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 text-xs text-textMuted bg-surfaceLight rounded-full px-2.5 py-1"
                >
                  <Icon className="w-3 h-3 text-primary" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-textPrimary font-semibold mb-4 text-sm">
              ลิงก์ด่วน
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: '/', label: 'หน้าแรก' },
                { href: '/#products', label: 'สินค้าทั้งหมด' },
                { href: '/cart', label: 'ตะกร้าสินค้า' },
                { href: '/checkout', label: 'ชำระเงิน' },
                { href: '/track', label: 'ติดตามออเดอร์' },
                { href: '/help', label: 'วิธีซื้อและรับสินค้า' },
                { href: '/slip-verify', label: 'ตรวจสอบสลิป' },
              ].filter((item) => item.href !== '/slip-verify').map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-textMuted hover:text-primary transition-colors text-sm"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-textPrimary font-semibold mb-4 text-sm">
              ช่วยเหลือ
            </h3>
            <div className="space-y-3">
              <a
                href={LINE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-textMuted hover:text-primary transition-colors group"
              >
                <MessageCircle className="w-4 h-4 text-green-400 group-hover:scale-110 transition-transform" />
                ติดต่อร้าน / วิธีรับสินค้า
              </a>
              <p className="text-xs text-textMuted bg-surfaceLight rounded-lg p-3 border border-border/50">
                เก็บเลขออเดอร์ไว้สำหรับติดต่อร้าน ตรวจเวลาตอบและจัดส่งจากรายละเอียดสินค้า
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-border/50 flex flex-col gap-4 text-xs text-textMuted">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2">
            <Link href="/terms" className="hover:text-primary transition-colors">
              ข้อตกลงและเงื่อนไข
            </Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">
              นโยบายความเป็นส่วนตัว
            </Link>
            <Link href="/refund" className="hover:text-primary transition-colors">
              นโยบายการคืนเงิน
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <p>© {currentYear} Shop78it. All rights reserved.</p>
          <p>Made with ❤️ for automated commerce</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
