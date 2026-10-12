import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { StoreAvailability } from '@/components/layout/StoreAvailability'
import { CartDrawer, FloatingCartButton } from '@/components/cart/CartDrawer'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from '@/components/ThemeProvider'
import { LanguageProvider } from '@/lib/i18n'
import { ClerkProvider } from '@clerk/nextjs'
import { RecentPurchases } from '@/components/ui/RecentPurchases'
import { FloatingChat } from '@/components/ui/FloatingChat'
import { TrackingScripts } from '@/components/TrackingScripts'
import { CookieConsent } from '@/components/ui/CookieConsent'
import { siteUrl } from '@/lib/site-url'


export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'Shop78it | ร้านขายซอฟต์แวร์และบัญชีดิจิทัล 24 ชม.',
    template: '%s | Shop78it',
  },
  description: 'ร้านสินค้าดิจิทัล คีย์ซอฟต์แวร์ และบัญชี AI พร้อมติดตามออเดอร์ มีทั้งจัดส่งอัตโนมัติและร้านจัดส่งตามรายละเอียดสินค้า',
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
    'Shop78it',
  ],
  openGraph: {
    title: 'Shop78it | ร้านขายซอฟต์แวร์และบัญชีดิจิทัล 24 ชม.',
    description: 'สินค้าดิจิทัลพร้อมติดตามออเดอร์ ตรวจชนิดการจัดส่งและเงื่อนไขก่อนสั่งซื้อ',
    type: 'website',
    locale: 'th_TH',
    siteName: 'Shop78it',
    images: ['/images/og-banner.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shop78it | ร้านขายซอฟต์แวร์และบัญชีดิจิทัล 24 ชม.',
    description: 'สินค้าดิจิทัลพร้อมระบบติดตามออเดอร์และรับสินค้า',
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
      <html lang="th" suppressHydrationWarning>
        <head>
          <meta charSet="utf-8" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          {/* Root App Router layout applies this stylesheet to every page. */}
          {/* eslint-disable-next-line @next/next/no-page-custom-font */}
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Thai:wght@300;400;500;600;700;800&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="bg-background text-textPrimary antialiased transition-colors duration-300">
          <ThemeProvider attribute="class" defaultTheme="dark">
            <LanguageProvider>
              <Navbar />
              <main className="min-h-screen pt-16">
                <StoreAvailability />
                {children}
              </main>
              <Footer />
              <CartDrawer />
              <FloatingCartButton />
              <RecentPurchases />
              <FloatingChat />
              <CookieConsent />
              <Toaster position="bottom-right" />
              <TrackingScripts />
            </LanguageProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
