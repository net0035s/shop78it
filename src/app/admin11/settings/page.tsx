'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ImageIcon, Loader2, Save, Store, XCircle } from 'lucide-react'

const FALLBACK_LOGO = ''

export default function AdminStoreSettingsPage() {
  const [logoUrl, setLogoUrl] = useState('')
  const [previewUrl, setPreviewUrl] = useState(FALLBACK_LOGO)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/admin/settings')
        const result = await response.json()

        if (result.success) {
          const nextLogoUrl = result.data?.logoUrl || ''
          setLogoUrl(nextLogoUrl)
          setPreviewUrl(nextLogoUrl)
        } else {
          setError(result.error || 'โหลดการตั้งค่าร้านค้าไม่สำเร็จ')
        }
      } catch {
        setError('โหลดการตั้งค่าร้านค้าไม่สำเร็จ')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: logoUrl.trim() }),
      })
      const result = await response.json()

      if (!result.success) {
        setError(result.error || 'บันทึกโลโก้ไม่สำเร็จ')
        return
      }

      const nextLogoUrl = result.data?.logoUrl || ''
      setLogoUrl(nextLogoUrl)
      setPreviewUrl(nextLogoUrl)
      setMessage('บันทึกโลโก้เรียบร้อยแล้ว')
    } catch {
      setError('บันทึกโลโก้ไม่สำเร็จ')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-textPrimary">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Link
          href="/admin11"
          className="inline-flex items-center gap-2 text-sm text-textMuted hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับหน้าแอดมิน
        </Link>

        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
            <Store className="w-4 h-4" />
            Store Settings
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">ตั้งค่าร้านค้า</h1>
          <p className="text-sm text-textMuted">
            วางลิงก์รูปภาพโลโก้เพื่อเปลี่ยนโลโก้ที่แสดงบน Navbar ของเว็บไซต์
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-3 bg-surface border border-border rounded-2xl p-5 sm:p-6 space-y-5"
          >
            {isLoading ? (
              <div className="flex items-center gap-3 text-sm text-textMuted">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                กำลังโหลดการตั้งค่า...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-textPrimary">
                    ลิงก์รูปภาพโลโก้ (Image URL)
                  </label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(event) => {
                      setLogoUrl(event.target.value)
                      setPreviewUrl(event.target.value.trim())
                    }}
                    placeholder="https://example.com/logo.png"
                    className="w-full rounded-xl border border-border bg-surfaceLight/50 px-4 py-3 text-sm text-textPrimary placeholder:text-textMuted focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/60"
                  />
                  <p className="text-xs text-textMuted">
                    ถ้าปล่อยว่าง ระบบจะกลับไปใช้โลโก้ตัวอักษร Shop78it แบบเดิม
                  </p>
                </div>

                {message && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    {message}
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                    <XCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-gradient px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  บันทึก
                </button>
              </>
            )}
          </form>

          <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-bold text-textPrimary">Preview</h2>
              <p className="text-xs text-textMuted mt-1">ตัวอย่างโลโก้ที่จะโชว์บน Navbar</p>
            </div>

            <div className="rounded-2xl border border-border bg-background/60 p-5 min-h-[160px] flex items-center justify-center">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Store logo preview"
                  className="max-h-20 max-w-full object-contain"
                  onError={() => setPreviewUrl('')}
                />
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-primary-gradient flex items-center justify-center shadow-lg shadow-primary/25">
                    <ImageIcon className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-black text-xl tracking-normal text-textPrimary">
                    Shop<span className="text-primary">78</span><span className="text-accent">it</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
