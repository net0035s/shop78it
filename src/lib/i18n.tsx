'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Language = 'th' | 'en'

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

// Basic dictionary. Keys can be added here.
const translations = {
  th: {
    'nav.home': 'หน้าแรก',
    'nav.products': 'สินค้า',
    'nav.contact': 'ติดต่อเรา',
    'nav.cart': 'ตะกร้าสินค้า',
    'hero.title': 'ร้านค้าออนไลน์อัตโนมัติ',
    'hero.title2': 'ตลอด 24 ชั่วโมง',
    'hero.subtitle': 'ส่งมอบสินค้าดิจิทัล ซอฟต์แวร์ และ Gift Card ทันทีหลังชำระเงิน พร้อมระบบสนับสนุนตลอดเวลา',
    'hero.cta': 'เลือกดูสินค้าทั้งหมด',
    'hero.feature1': 'ส่งมอบทันที',
    'hero.feature2': 'ปลอดภัย 100%',
    'hero.feature3': 'รองรับหลายช่องทาง',
    'checkout.title': 'ตรวจสอบรายการสั่งซื้อ',
    'checkout.empty': 'ไม่พบสินค้าที่จะชำระเงิน',
  },
  en: {
    'nav.home': 'Home',
    'nav.products': 'Products',
    'nav.contact': 'Contact Us',
    'nav.cart': 'Shopping Cart',
    'hero.title': 'Automated Online Store',
    'hero.title2': 'Available 24/7',
    'hero.subtitle': 'Instant delivery of digital goods, software, and gift cards right after payment.',
    'hero.cta': 'Browse All Products',
    'hero.feature1': 'Instant Delivery',
    'hero.feature2': '100% Secure',
    'hero.feature3': 'Multiple Payments',
    'checkout.title': 'Checkout',
    'checkout.empty': 'No items to checkout',
  }
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('th') // Default TH
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
    // @ts-ignore
    return translations[language][key] || translations['th'][key] || key
  }

  // To prevent hydration errors, we just provide the default (TH) context until mounted
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
