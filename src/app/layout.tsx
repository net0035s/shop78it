import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer, FloatingCartButton } from '@/components/cart/CartDrawer'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from '@/components/ThemeProvider'
import { LanguageProvider } from '@/lib/i18n'
import { ClerkProvider } from '@clerk/nextjs'
import { RecentPurchases } from '@/components/ui/RecentPurchases'
import { FloatingChat } from '@/components/ui/FloatingChat'
import { TrackingScripts } from '@/components/TrackingScripts'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'ShopAuto 24/7 | ร้านขายซอฟต์แวร์และบัญชีดิจิทัล 24 ชม.',
    template: '%s | ShopAuto 24/7',
  },
  description: 'บริการจำหน่ายคีย์ซอฟต์แวร์แท้ บัญชี AI พรีเมียม และระบบสมาชิกต่างๆ ส่งคีย์อัตโนมัติตลอด 24 ชั่วโมง รวดเร็ว ปลอดภัย พร้อมระบบติดตามออเดอร์',
  keywords: [
    'ซอฟต์แวร์แท้',
    'คีย์ Windows',
    'บัญชี ChatGPT',
    'ChatGPT Plus',
    'บัญชี AI พรีเมียม',
    'คีย์ซอฟต์แวร์',
    'ส่งคีย์ออโต้',
    'ร้านขายสินค้าดิจิทัล',
    'ระบบสมาชิกพรีเมียม',
    'ShopAuto 24/7',
  ],
  openGraph: {
    title: 'ShopAuto 24/7 | ร้านขายซอฟต์แวร์และบัญชีดิจิทัล 24 ชม.',
    description: 'จำหน่ายคีย์ซอฟต์แวร์แท้ บัญชี AI พรีเมียม และสินค้าดิจิทัล ส่งอัตโนมัติตลอด 24 ชั่วโมง',
    type: 'website',
    locale: 'th_TH',
    siteName: 'ShopAuto 24/7',
    images: ['/images/og-banner.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShopAuto 24/7 | ร้านขายซอฟต์แวร์และบัญชีดิจิทัล 24 ชม.',
    description: 'ส่งคีย์อัตโนมัติ รวดเร็ว ปลอดภัย พร้อมระบบติดตามออเดอร์',
    images: ['/images/og-banner.jpg'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="th" className={inter.variable} suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="bg-background text-textPrimary antialiased transition-colors duration-300">
          <ThemeProvider attribute="class" defaultTheme="dark">
            <LanguageProvider>
              <Navbar />
              <main className="min-h-screen pt-16">
                {children}
              </main>
              <Footer />
              <CartDrawer />
              <FloatingCartButton />
              <RecentPurchases />
              <FloatingChat />
              <Toaster position="bottom-right" />
              <TrackingScripts />
            </LanguageProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
