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
    'hero.title2': 'ถูกใจเรื่องราคา ง่ายทุกการสั่งซื้อ พร้อมดูแลหลังการขาย',
    'hero.subtitle': 'สินค้าดิจิทัล ซอฟต์แวร์ และ Gift Card พร้อมระบบติดตามออเดอร์ ตรวจชนิดการจัดส่งและเงื่อนไขสินค้าก่อนสั่งซื้อ',
    'hero.cta': 'เลือกดูสินค้าทั้งหมด',
    'hero.value1': 'ออเดอร์',
    'hero.value2': 'ยืนยันสิทธิ์',
    'hero.value3': '2 รูปแบบ',
    'hero.feature1': 'ตรวจสถานะและรับสินค้า',
    'hero.feature2': 'ก่อนเปิดข้อมูลสินค้า',
    'hero.feature3': 'อัตโนมัติและร้านจัดส่ง',
    'checkout.title': 'ตรวจสอบรายการสั่งซื้อ',
    'checkout.empty': 'ไม่พบสินค้าที่จะชำระเงิน',
  },
  en: {
    'nav.home': 'Home',
    'nav.products': 'Products',
    'nav.contact': 'Contact Us',
    'nav.cart': 'Shopping Cart',
    'hero.title': 'Welcome to Shop78it',
    'hero.title2': 'Great prices, easy ordering, and after-sales support',
    'hero.subtitle': 'Digital goods, software, and gift cards with order tracking. Check delivery methods and product terms before ordering.',
    'hero.cta': 'Browse All Products',
    'hero.value1': 'Orders',
    'hero.value2': 'Verify access',
    'hero.value3': '2 methods',
    'hero.feature1': 'Track and receive products',
    'hero.feature2': 'Before viewing product details',
    'hero.feature3': 'Automatic and manual delivery',
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
