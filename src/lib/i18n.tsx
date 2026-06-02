'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Language = 'th' | 'en'

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const translations = {
  th: {
    'nav.home': 'หน้าแรก',
    'nav.products': 'สินค้า',
    'nav.contact': 'ติดต่อเรา',
    'nav.cart': 'ตะกร้าสินค้า',
    'hero.title': 'ยินดีต้อนรับเข้าสู่ Shop78it',
    'hero.title2': 'มีบริการจัดส่งออนไลน์ตลอด 24 ชั่วโมง',
    'hero.subtitle': 'ส่งมอบสินค้าดิจิทัล ซอฟต์แวร์ และ Gift Card ทันทีหลังชำระเงิน มีบริการหลังการขาย',
    'hero.cta': 'เลือกดูสินค้าทั้งหมด',
    'hero.feature1': 'รีวิว 5 ดาว',
    'hero.feature2': 'ปลอดภัย 100%',
    'hero.feature3': 'จัดส่งอัตโนมัติ',
    'checkout.title': 'ตรวจสอบรายการสั่งซื้อ',
    'checkout.empty': 'ไม่พบสินค้าที่จะชำระเงิน',
  },
  en: {
    'nav.home': 'Home',
    'nav.products': 'Products',
    'nav.contact': 'Contact Us',
    'nav.cart': 'Shopping Cart',
    'hero.title': 'Welcome to Shop78it',
    'hero.title2': 'Online delivery service available 24 hours',
    'hero.subtitle': 'Instant delivery of digital goods, software, and gift cards after payment, with after-sales support.',
    'hero.cta': 'Browse All Products',
    'hero.feature1': '5-Star Reviews',
    'hero.feature2': '100% Secure',
    'hero.feature3': 'Automatic Delivery',
    'checkout.title': 'Checkout',
    'checkout.empty': 'No items to checkout',
  },
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('th')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('app_language') as Language
    if (saved && (saved === 'th' || saved === 'en')) {
      setLanguageState(saved)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('app_language', lang)
  }

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.th] || translations.th[key as keyof typeof translations.th] || key
  }

  const currentLanguage = mounted ? language : 'th'

  return (
    <I18nContext.Provider value={{ language: currentLanguage, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
