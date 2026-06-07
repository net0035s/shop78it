'use client'

import Link from 'next/link'
import { ShoppingCart, Store, Menu, X, Moon, Sun, Globe } from 'lucide-react'
import { UserButton, useUser } from '@clerk/nextjs'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useTheme } from 'next-themes'
import { useCartStore } from '@/store/cartStore'
import { useLanguage } from '@/lib/i18n'
import { patchNotes } from '@/data/patchNotes'

const CURRENT_VERSION = patchNotes[0]?.version ?? 'dev'

export function Navbar() {
  const itemCount = useCartStore((s) => s.getItemCount())
  const openCart = useCartStore((s) => s.openCart)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const logoClickCount = useRef(0)
  const logoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRedirecting = useRef(false)
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const { isSignedIn } = useUser()

  useEffect(() => {
    setIsMounted(true)

    fetch('/api/settings')
      .then((response) => response.json())
      .then((result) => {
        if (result.success && typeof result.data?.logoUrl === 'string') {
          setLogoUrl(result.data.logoUrl)
        }
      })
      .catch((error) => {
        console.error('Failed to load store logo:', error)
      })

    return () => {
      if (logoTimeoutRef.current) clearTimeout(logoTimeoutRef.current)
    }
  }, [])

  const handleLogoSecretTrigger = (e: MouseEvent<HTMLAnchorElement>) => {
    if (isRedirecting.current) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    logoClickCount.current += 1

    if (logoClickCount.current >= 5) {
      e.preventDefault()
      e.stopPropagation()
      isRedirecting.current = true
      window.location.href = '/admin11'
      return
    }

    if (logoTimeoutRef.current) clearTimeout(logoTimeoutRef.current)
    logoTimeoutRef.current = setTimeout(() => {
      logoClickCount.current = 0
    }, 1500)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 backdrop-blur-md bg-background/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" onClick={handleLogoSecretTrigger} className="flex items-center gap-2.5 group">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Shop78it"
                className="h-10 max-w-[160px] object-contain transition-all group-hover:scale-105"
                onError={() => setLogoUrl('')}
                draggable={false}
              />
            ) : (
              <>
                <div className="w-9 h-9 rounded-xl bg-primary-gradient flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-primary/50 transition-all group-hover:scale-105">
                  <Store className="h-[18px] w-[18px] text-white" />
                </div>
                <span className="font-black text-xl tracking-normal text-textPrimary">
                  Shop
                  <span className="text-primary">78</span>
                  <span className="text-accent">it</span>
                </span>
              </>
            )}
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-textSecondary hover:text-textPrimary transition-colors text-sm font-medium">
              {t('nav.home')}
            </Link>
            <Link href="/#products" className="text-textSecondary hover:text-textPrimary transition-colors text-sm font-medium">
              {t('nav.products')}
            </Link>
            <Link href="/cart" className="text-textSecondary hover:text-textPrimary transition-colors text-sm font-medium">
              {t('nav.cart')}
            </Link>
            <Link href="/track" className="text-textSecondary hover:text-textPrimary transition-colors text-sm font-medium">
              ติดตามออเดอร์
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span
              className="hidden sm:inline-flex items-center rounded-full border border-border/70 bg-surfaceLight/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-normal text-textMuted"
              title="Current version"
            >
              {CURRENT_VERSION}
            </span>

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

            <button
              className="md:hidden p-2 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-surfaceLight transition-all"
              onClick={() => setMobileOpen((current) => !current)}
              aria-label="เมนู"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-border/50 py-4 space-y-2 animate-fade-in">
            <div className="px-3 py-2 text-[11px] font-black uppercase text-primary">
              Version {CURRENT_VERSION}
            </div>
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
