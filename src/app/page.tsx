import prisma from '@/lib/db'
import { ProductGrid } from '@/components/product/ProductGrid'
import { ArrowRight, Zap, ShieldCheck, Clock, Star } from 'lucide-react'
import Link from 'next/link'
import { Translate } from '@/components/Translate'
import type { Product } from '@/types'
import { moneyToNumber } from '@/lib/money'

// Disable SSR for this component — it reads localStorage and uses browser-only APIs
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default async function StorefrontPage() {
  // ดึงสินค้าทุกตัวจากฐานข้อมูล (ห้ามใส่ where กรองสินค้าออก)
  const rawProducts = await prisma.product.findMany({
    include: {
      _count: {
        select: {
          digitalStocks: {
            where: { isSold: false }
          }
        }
      }
    }
  })

  // Debug: ตรวจสอบค่าที่ดึงมาใน Terminal
  // คำนวณสต๊อกจากจำนวน DigitalStock ที่ยังพร้อมส่ง (isSold = false)
  const products: Product[] = rawProducts.map(p => {
    const currentStock = p._count?.digitalStocks || 0
    const stockStatus: Product['stockStatus'] =
      currentStock > 5 ? 'in-stock' : currentStock > 0 ? 'low-stock' : 'out-of-stock'

    return {
      ...p,
      price: moneyToNumber(p.price),
      originalPrice: p.originalPrice ? moneyToNumber(p.originalPrice) : undefined,
      tags: p.tags ?? undefined,
      deliveryInfo: p.deliveryInfo ?? undefined,
      deliveryType: p.deliveryType === 'manual' ? 'manual' : 'auto',
      stock: currentStock,
      stockStatus,
    }
  })
  
  // ดึงหมวดหมู่จาก API (จะแสดงเป็น Filter Bar บนหน้าร้านค้า)
  let categories: any[] = []
  try {
    categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    })
  } catch {
    // Fallback: ใช้หมวดหมู่เริ่มต้น
    categories = [
      { id: 'cat-subscription', name: 'แพ็กเกจรายเดือน', slug: 'subscription', icon: '🔄', color: '#6366f1', sortOrder: 1, isActive: true },
      { id: 'cat-digital', name: 'สินค้าดิจิทัล', slug: 'digital', icon: '🔑', color: '#f59e0b', sortOrder: 2, isActive: true },
    ]
  }

  return (
    <>
      <div className="animate-fade-in">

      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Background layers */}
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute inset-0 bg-hero-gradient" />

        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-accent/10 blur-[100px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[150px]" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8 animate-slide-up">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              ระบบอัตโนมัติ — พร้อมให้บริการตลอด 24ชั่วโมง
            </div>

            {/* Headline */}
            <h1 className="flex flex-col gap-4 sm:gap-5 text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.35] sm:leading-[1.32] lg:leading-[1.28] mb-7 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <span className="block">
                <Translate tKey="hero.title" />
              </span>
              <span className="gradient-text block text-3xl sm:text-4xl lg:text-5xl leading-[1.45] sm:leading-[1.4] lg:leading-[1.35]">
                <Translate tKey="hero.title2" />
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-textSecondary text-lg sm:text-xl leading-relaxed mb-10 max-w-xl animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Translate tKey="hero.subtitle" />
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <Link
                href="#products"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary-gradient text-white font-semibold text-base shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all btn-glow"
                id="hero-cta-shop"
              >
                <Translate tKey="hero.cta" />
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/cart"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-surfaceLight border border-border text-textPrimary font-semibold text-base hover:border-primary/40 hover:bg-surface transition-all"
                id="hero-cta-cart"
              >
                <Translate tKey="nav.cart" />
              </Link>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-6 mt-14 animate-slide-up" style={{ animationDelay: '0.4s' }}>
              {[
                { icon: Star, value: '500+', label: 'hero.feature1', color: 'text-amber-400' },
                { icon: ShieldCheck, value: '100%', label: 'hero.feature2', color: 'text-emerald-400' },
                { icon: Clock, value: '24/7', label: 'hero.feature3', color: 'text-primary' },
              ].map(({ icon: Icon, value, label, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={`${color} opacity-80`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className={`font-bold text-xl ${color}`}>{value}</div>
                    <div className="text-textMuted text-sm"><Translate tKey={label} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          TRUST BADGES
          ============================================ */}
      <section className="border-y border-border/50 bg-surface/30 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {[
              { icon: Zap, text: 'ส่งสินค้าทันที' },
              { icon: ShieldCheck, text: 'ชำระเงินปลอดภัย' },
              { icon: Clock, text: 'บริการ 24 ชม.' },
              { icon: Star, text: 'มีบริการหลังการขาย' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-textMuted text-sm">
                <Icon className="w-4 h-4 text-primary" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          PRODUCT GRID
          ============================================ */}
      <ProductGrid products={products} categories={categories} />

      {/* ============================================
          HOW IT WORKS SECTION
          ============================================ */}
      <section className="py-16 bg-surface/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-textPrimary mb-3">
              ซื้อง่าย ได้เร็ว อัตโนมัติ 100%
            </h2>
            <p className="text-textMuted">
              เพียง 3 ขั้นตอน ก็ได้สินค้าแล้ว
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: '🛒',
                title: 'เลือกสินค้า & เพิ่มในตะกร้า',
                desc: 'เลือกสินค้าที่ต้องการ กดเพิ่มในตะกร้า แล้วไปยืนยันออเดอร์',
              },
              {
                step: '02',
                icon: '💳',
                title: 'ชำระเงินผ่าน QR Code',
                desc: 'สแกน QR PromptPay หรือโอนเงินผ่านธนาคาร แล้วอัปโหลดสลิป',
              },
              {
                step: '03',
                icon: '⚡',
                title: 'รับสินค้าทันที',
                desc: 'ระบบตรวจสลิปอัตโนมัติ ยืนยันแล้วส่งสินค้าให้ทันที ไม่ต้องรอแอดมิน',
              },
            ].map(({ step, icon, title, desc }) => (
              <div
                key={step}
                className="relative p-6 rounded-2xl bg-card-gradient border border-border hover:border-primary/30 transition-all group"
              >
                <div className="absolute top-4 right-4 text-4xl font-black text-border/50 group-hover:text-primary/20 transition-colors">
                  {step}
                </div>
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="text-textPrimary font-semibold mb-2">{title}</h3>
                <p className="text-textMuted text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>

      {/* Social Proof — RecentPurchases popup (bottom-left, client-side) */}
    </>
  )
}
