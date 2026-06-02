'use client'

import Link from 'next/link'
import { ShoppingCart, Zap, Menu, X, Moon, Sun, Globe } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { useLanguage } from '@/lib/i18n'
import { UserButton, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

export function Navbar() {
  const router = useRouter()
  const itemCount = useCartStore((s) => s.getItemCount())
  const openCart = useCartStore((s) => s.openCart)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { isSignedIn } = useUser()
  const logoClickCountRef = useRef(0)
  const logoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Must wait for client hydration before showing cart count from localStorage
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => { setIsMounted(true) }, [])

  useEffect(() => {
    return () => {
      if (logoTimerRef.current) clearTimeout(logoTimerRef.current)
    }
  }, [])

  const handleLogoClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    logoClickCountRef.current += 1

    if (logoClickCountRef.current === 1) {
      logoTimerRef.current = setTimeout(() => {
        logoClickCountRef.current = 0
        logoTimerRef.current = null
      }, 3000)
    }

    if (logoClickCountRef.current >= 5) {
      event.preventDefault()
      if (logoTimerRef.current) clearTimeout(logoTimerRef.current)
      logoTimerRef.current = null
      logoClickCountRef.current = 0
      router.push('/admin11')
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 backdrop-blur-md bg-background/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" onClick={handleLogoClick} className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary-gradient flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-primary/50 transition-shadow">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-textPrimary">
              Shop
              <span className="text-primary">Auto</span>
              <span className="text-textSecondary text-sm ml-1">24/7</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="text-textSecondary hover:text-textPrimary transition-colors text-sm font-medium"
            >
              {t('nav.home')}
            </Link>
            <Link
              href="/#products"
              className="text-textSecondary hover:text-textPrimary transition-colors text-sm font-medium"
            >
              {t('nav.products')}
            </Link>
            <Link
              href="/cart"
              className="text-textSecondary hover:text-textPrimary transition-colors text-sm font-medium"
            >
              {t('nav.cart')}
            </Link>
            <Link
              href="/track"
              className="text-textSecondary hover:text-textPrimary transition-colors text-sm font-medium"
            >
              ติดตามออเดอร์
            </Link>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Toggle */}
            {isMounted ? (
              <button
                onClick={() => setLanguage(language === 'th' ? 'en' : 'th')}
                className="flex items-center gap-1 p-2 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-surfaceLight transition-all text-xs font-bold uppercase"
                aria-label="เปลี่ยนภาษา"
              >
                <Globe className="w-4 h-4" />
                {language}
              </button>
            ) : (
              <div className="w-[52px] h-[32px] rounded-lg bg-surfaceLight/50 animate-pulse" />
            )}

            {/* Theme Toggle */}
            {isMounted ? (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-surfaceLight transition-all"
                aria-label="สลับโหมดสี"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-[32px] h-[32px] rounded-lg bg-surfaceLight/50 animate-pulse" />
            )}

            {/* Cart Button */}
            <button
              onClick={openCart}
              className="relative p-2 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-surfaceLight transition-all"
              aria-label="ตะกร้าสินค้า"
              id="cart-button-nav"
            >
              <ShoppingCart className="w-5 h-5" />
              {isMounted && itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce-subtle">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </button>

            {isMounted && isSignedIn && (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg text-textSecondary hover:bg-surfaceLight transition-all">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: 'h-8 w-8',
                    },
                  }}
                />
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-surfaceLight transition-all"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="เมนู"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border/50 py-4 space-y-2 animate-fade-in">
            {[
              { href: '/', label: t('nav.home') },
              { href: '/#products', label: t('nav.products') },
              { href: '/cart', label: t('nav.cart') },
              { href: '/track', label: 'ติดตามออเดอร์' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-surfaceLight transition-all text-sm"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
