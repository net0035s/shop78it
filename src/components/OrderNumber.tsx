'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function OrderNumber({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setError(false); setTimeout(() => setCopied(false), 2000) }
    catch { setError(true) }
  }
  return <div className="mt-0.5 space-y-1">
    <div className="flex items-start gap-2">
      <span className="min-w-0 break-all select-text font-mono font-bold text-textPrimary" title={value}>{value}</span>
      <button type="button" onClick={() => void copy()} aria-label="คัดลอกเลขออเดอร์" className="shrink-0 rounded border border-border p-1.5 text-primary hover:bg-surfaceLight">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
    {copied && <p role="status" className="text-xs text-emerald-400">คัดลอกแล้ว</p>}
    {error && <p role="status" className="text-xs text-amber-400">เลือกเลขออเดอร์แล้วกด Ctrl+C เพื่อคัดลอก</p>}
  </div>
}
