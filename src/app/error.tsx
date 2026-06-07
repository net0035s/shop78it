"use client";

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="min-h-screen bg-background px-4 py-24 text-textPrimary">
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
        <section className="w-full rounded-3xl border border-border bg-surface/90 p-6 text-center shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-400">
            <AlertTriangle className="h-8 w-8" aria-hidden="true" />
          </div>

          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-primary">
            System Error
          </p>
          <h1 className="text-2xl font-extrabold leading-relaxed text-textPrimary sm:text-3xl">
            ขออภัย เกิดข้อผิดพลาดบางประการ
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-textSecondary">
            ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง หากยังพบปัญหาเดิม
            สามารถกลับไปหน้าหลักแล้วเริ่มใหม่ได้
          </p>

          {error.digest ? (
            <p className="mt-4 rounded-xl border border-border bg-surfaceLight/40 px-3 py-2 text-xs text-textMuted">
              รหัสอ้างอิง: <span className="font-mono">{error.digest}</span>
            </p>
          ) : null}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-gradient px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-[0.98]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              ลองใหม่อีกครั้ง
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surfaceLight px-5 py-3 text-sm font-bold text-textPrimary transition-all hover:border-primary/50 hover:bg-surfaceLight/80 active:scale-[0.98]"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              กลับสู่หน้าหลัก
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
