'use client'

import { useEffect, useState } from 'react'

const CONSENT_KEY = 'shop78it-cookie-consent'

type CookieConsentValue = 'accepted' | 'rejected'

export function getCookieConsent(): CookieConsentValue | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(CONSENT_KEY)
  return value === 'accepted' || value === 'rejected' ? value : null
}

export function CookieConsent() {
  const [consent, setConsent] = useState<CookieConsentValue | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setConsent(getCookieConsent())
  }, [])

  const saveConsent = (value: CookieConsentValue) => {
    window.localStorage.setItem(CONSENT_KEY, value)
    setConsent(value)
    window.dispatchEvent(new CustomEvent('cookie-consent-change', { detail: value }))
  }

  if (!mounted || consent) return null

  return (
    <div className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-3xl rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-bold text-textPrimary">เว็บไซต์นี้ใช้คุกกี้</p>
          <p className="text-xs leading-relaxed text-textMuted">
            เราใช้คุกกี้เพื่อพัฒนาประสบการณ์ใช้งาน และจะโหลดเครื่องมือวิเคราะห์/การตลาดเมื่อคุณกดยอมรับเท่านั้น
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => saveConsent('rejected')}
            className="rounded-xl border border-border bg-surfaceLight px-4 py-2 text-xs font-bold text-textPrimary transition-colors hover:bg-surfaceLight/80"
          >
            ปฏิเสธ
          </button>
          <button
            type="button"
            onClick={() => saveConsent('accepted')}
            className="rounded-xl bg-primary-gradient px-4 py-2 text-xs font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
          >
            ยอมรับ
          </button>
        </div>
      </div>
    </div>
  )
}
