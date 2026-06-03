'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, RefreshCw, ShieldCheck, AlertCircle } from 'lucide-react'
import { formatPrice } from '@/lib/products'

interface PaymentQRProps {
  amount: number
  orderNumber: string
}

type BeamQrData = {
  chargeId?: string
  imageBase64Encoded: string
  expiry?: string
}

function getSecondsUntil(expiry?: string) {
  if (!expiry) return 0
  return Math.max(0, Math.floor((new Date(expiry).getTime() - Date.now()) / 1000))
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default function PaymentQR({ amount, orderNumber }: PaymentQRProps) {
  const [qrData, setQrData] = useState<BeamQrData | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isLoadingQr, setIsLoadingQr] = useState(false)
  const [error, setError] = useState('')

  const timerExpired = qrData ? timeLeft <= 0 : false

  const qrImageSrc = useMemo(() => {
    if (!qrData?.imageBase64Encoded) return ''
    return `data:image/png;base64,${qrData.imageBase64Encoded}`
  }, [qrData])

  const fetchBeamQr = useCallback(async () => {
    if (!orderNumber) return

    setIsLoadingQr(true)
    setError('')

    try {
      const response = await fetch('/api/checkout/beam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderNumber }),
      })

      const result = await response.json()

      if (!result.success) {
        setQrData(null)
        setError(result.error || 'สร้าง QR ชำระเงินไม่สำเร็จ')
        return
      }

      setQrData({
        chargeId: result.data.chargeId,
        imageBase64Encoded: result.data.imageBase64Encoded,
        expiry: result.data.expiry,
      })
      setTimeLeft(getSecondsUntil(result.data.expiry))
    } catch (fetchError) {
      console.error('Beam QR fetch failed:', fetchError)
      setQrData(null)
      setError('เชื่อมต่อระบบชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsLoadingQr(false)
    }
  }, [orderNumber])

  useEffect(() => {
    fetchBeamQr()
  }, [fetchBeamQr])

  useEffect(() => {
    if (!qrData?.expiry) return

    const timer = setInterval(() => {
      setTimeLeft(getSecondsUntil(qrData.expiry))
    }, 1000)

    return () => clearInterval(timer)
  }, [qrData?.expiry])

  return (
    <div className="space-y-6 bg-surface border border-border shadow-sm p-6 sm:p-8 rounded-2xl relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4 relative">
        <div>
          <h2 className="text-xl font-bold text-textPrimary mb-1">ชำระเงินผ่าน Beam PromptPay</h2>
          <p className="text-xs text-textMuted flex items-center gap-1.5 mt-0.5">
            เลขที่ออเดอร์: <span className="font-mono text-textPrimary font-semibold">{orderNumber}</span>
          </p>
        </div>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shrink-0 w-fit text-sm font-semibold transition-all ${
          timerExpired
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : timeLeft < 120
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-primary/10 border-primary/20 text-primary-light'
        }`}>
          <Clock className="w-4 h-4" />
          <span>{timerExpired ? 'QR หมดอายุแล้ว' : formatTime(timeLeft)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,320px)_1fr] gap-6 sm:gap-8 items-center relative">
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[300px] rounded-2xl overflow-hidden shadow-2xl border border-[#0d2a4a] bg-white text-slate-800">
            <div className="bg-[#002f5f] px-4 py-3 flex flex-col items-center border-b border-[#0d2a4a]">
              <div className="text-white font-extrabold tracking-tight text-lg italic">
                <span className="text-[#05b0f4]">Prompt</span>Pay
              </div>
              <span className="text-[10px] text-slate-300 font-semibold tracking-widest mt-0.5">
                POWERED BY BEAM
              </span>
            </div>

            <div className="p-5 flex flex-col items-center bg-white min-h-[260px] justify-center">
              {isLoadingQr ? (
                <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                  <RefreshCw className="w-9 h-9 animate-spin text-[#002f5f]" />
                  <p className="text-xs font-semibold">กำลังสร้าง QR...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <AlertCircle className="w-10 h-10 text-red-500" />
                  <p className="text-xs font-semibold text-red-600">{error}</p>
                </div>
              ) : qrImageSrc ? (
                <img
                  src={qrImageSrc}
                  alt="Beam PromptPay QR Code"
                  className="w-52 h-52 rounded-xl border border-slate-200 object-contain"
                />
              ) : null}

              <div className="mt-3.5 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  ยอดเงินชำระ
                </span>
                <span className="text-xl font-extrabold text-[#002f5f] tracking-tight">
                  {formatPrice(amount)}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-textMuted flex items-center gap-1 justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ระบบจะตรวจสอบยอดโอนอัตโนมัติผ่าน Beam
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-surfaceLight/40 border border-border/50 rounded-xl space-y-2 text-xs text-textSecondary">
            <p className="font-semibold text-textPrimary">ขั้นตอนการชำระเงิน:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-textMuted">
              <li>เปิดแอปธนาคารของคุณ แล้วสแกน QR Code ด้านซ้าย</li>
              <li>ตรวจสอบยอดเงินให้ตรงกับ <strong className="text-textPrimary">{formatPrice(amount)}</strong></li>
              <li>ชำระเงินให้เสร็จก่อน QR หมดอายุ</li>
              <li>หลังชำระสำเร็จ ระบบจะตัดสต็อกและส่งสินค้าดิจิทัลให้อัตโนมัติ</li>
              <li>หากเป็นสินค้าที่ต้องให้แอดมินจัดส่ง ระบบจะแจ้งสถานะรอดำเนินการ</li>
            </ol>
          </div>

          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-200">
            ไม่ต้องอัปโหลดสลิปแล้ว ระบบ Beam จะส่ง Webhook กลับมาให้ร้านทันทีเมื่อชำระเงินสำเร็จ
          </div>

          <button
            type="button"
            onClick={fetchBeamQr}
            disabled={isLoadingQr}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surfaceLight hover:bg-surfaceLight/80 disabled:opacity-50 text-textPrimary font-semibold text-sm border border-border transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingQr ? 'animate-spin' : ''}`} />
            ขอ QR ใหม่
          </button>
        </div>
      </div>
    </div>
  )
}
