'use client'

import React, { useState, useEffect } from 'react'
import { Clock, ShieldCheck, CreditCard, RefreshCw } from 'lucide-react'
import { formatPrice } from '@/lib/products'
import SlipUploader from './SlipUploader'

interface PaymentQRProps {
  amount: number
  orderNumber: string
  onConfirm: (slipFile: File) => void
  isLoading?: boolean
}

export default function PaymentQR({ amount, orderNumber, onConfirm, isLoading = false }: PaymentQRProps) {
  const [timeLeft, setTimeLeft] = useState(15 * 60) // 15 minutes in seconds
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [timerExpired, setTimerExpired] = useState(false)

  // Timer Countdown Effect
  useEffect(() => {
    if (timeLeft <= 0) {
      setTimerExpired(true)
      return
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      alert('กรุณาอัปโหลดสลิปการโอนเงินเพื่อยืนยัน')
      return
    }
    onConfirm(selectedFile)
  }

  const resetTimer = () => {
    setTimeLeft(15 * 60)
    setTimerExpired(false)
  }

  return (
    <div className="space-y-6 bg-surface border border-border shadow-sm p-6 sm:p-8 rounded-2xl relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-textPrimary mb-1">ชำระเงินผ่าน PromptPay</h2>
          <p className="text-xs text-textMuted flex items-center gap-1.5 mt-0.5">
            เลขที่ออเดอร์: <span className="font-mono text-textPrimary font-semibold">{orderNumber}</span>
          </p>
        </div>

        {/* Timer Badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shrink-0 w-fit text-sm font-semibold transition-all ${
          timerExpired
            ? 'bg-red-500/10 border-red-500/20 text-red-400 animate-pulse'
            : timeLeft < 120
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse'
            : 'bg-primary/10 border-primary/20 text-primary-light'
        }`}>
          <Clock className="w-4 h-4" />
          <span>{timerExpired ? 'หมดเวลาชำระเงิน' : formatTime(timeLeft)}</span>
        </div>
      </div>

      {timerExpired ? (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-textPrimary">ชำระเงินเกินเวลาที่กำหนด</h3>
            <p className="text-sm text-textMuted max-w-sm mx-auto mt-1">
              ออเดอร์นี้หมดระยะเวลาการชำระเงิน 15 นาทีแล้ว หากท่านยังต้องการซื้อสินค้า กรุณากดปุ่มด้านล่างเพื่อเริ่มใหม่
            </p>
          </div>
          <button
            onClick={resetTimer}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surfaceLight hover:bg-surfaceLight/80 text-textPrimary font-semibold text-sm border border-border transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            ขอรหัส QR ใหม่
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center">
            {/* Left Column: QR Card */}
            <div className="flex flex-col items-center">
              {/* Premium PromptPay QR Card */}
              <div className="w-full max-w-[280px] rounded-2xl overflow-hidden shadow-2xl border border-[#0d2a4a] bg-white text-slate-800">
                {/* Header (PromptPay Brand Style) */}
                <div className="bg-[#002f5f] px-4 py-3 flex flex-col items-center border-b border-[#0d2a4a]">
                  <div className="flex items-center gap-2">
                    {/* PromptPay Stylized Text & Icon */}
                    <div className="text-white font-extrabold tracking-tight text-lg italic flex items-center">
                      <span className="text-[#05b0f4]">Prompt</span>Pay
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-300 font-semibold tracking-widest mt-0.5">
                    พร้อมเพย์
                  </span>
                </div>

                {/* QR Code Grid Area (Stylized SVG for premium look) */}
                <div className="p-5 flex flex-col items-center bg-white">
                  <div className="w-44 h-44 relative bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-center">
                    <svg
                      viewBox="0 0 100 100"
                      className="w-full h-full text-slate-900"
                      fill="currentColor"
                    >
                      {/* Quiet Zone Grid blocks to simulate a real QR Code */}
                      <rect x="0" y="0" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="4" />
                      <rect x="5" y="5" width="15" height="15" />
                      <rect x="9" y="9" width="7" height="7" fill="white" />
                      
                      <rect x="75" y="0" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="4" />
                      <rect x="80" y="5" width="15" height="15" />
                      <rect x="84" y="9" width="7" height="7" fill="white" />
                      
                      <rect x="0" y="75" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="4" />
                      <rect x="5" y="80" width="15" height="15" />
                      <rect x="9" y="84" width="7" height="7" fill="white" />
                      
                      {/* Random QR pixels simulation */}
                      <rect x="35" y="5" width="5" height="10" />
                      <rect x="45" y="0" width="10" height="5" />
                      <rect x="60" y="10" width="5" height="15" />
                      <rect x="30" y="20" width="15" height="5" />
                      <rect x="50" y="20" width="10" height="10" />
                      
                      <rect x="5" y="35" width="10" height="5" />
                      <rect x="0" y="45" width="5" height="15" />
                      <rect x="15" y="50" width="15" height="5" />
                      <rect x="25" y="35" width="5" height="10" />
                      <rect x="10" y="60" width="10" height="5" />
                      
                      <rect x="75" y="35" width="15" height="5" />
                      <rect x="90" y="40" width="10" height="15" />
                      <rect x="80" y="60" width="5" height="10" />
                      <rect x="65" y="50" width="10" height="5" />
                      <rect x="70" y="25" width="5" height="15" />
                      
                      <rect x="35" y="75" width="10" height="5" />
                      <rect x="50" y="85" width="15" height="10" />
                      <rect x="40" y="65" width="5" height="10" />
                      <rect x="55" y="60" width="15" height="5" />
                      <rect x="30" y="50" width="10" height="10" />
                      <rect x="30" y="90" width="15" height="5" />
                      <rect x="70" y="80" width="5" height="15" />
                      
                      {/* Center PromptPay small logo in QR */}
                      <rect x="42" y="42" width="16" height="16" fill="white" rx="2" />
                      <circle cx="50" cy="50" r="5" fill="#002f5f" />
                    </svg>
                  </div>
                  
                  {/* Total price inside card */}
                  <div className="mt-3.5 text-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      ยอดเงินชำระ
                    </span>
                    <span className="text-xl font-extrabold text-[#002f5f] tracking-tight">
                      {formatPrice(amount)}
                    </span>
                  </div>
                </div>

                {/* Footer instructions */}
                <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 text-center">
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    ชื่อบัญชี: บจก. ช็อปออโต้ 24.7 (จำลอง)
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                    เลขพร้อมเพย์: 099-123-4567 (จำลอง)
                  </span>
                </div>
              </div>

              <div className="mt-3 text-center">
                <p className="text-xs text-textMuted flex items-center gap-1 justify-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  สแกนด้วยแอปธนาคารใดก็ได้เพื่อชำระเงิน
                </p>
              </div>
            </div>

            {/* Right Column: Slip Upload */}
            <div className="space-y-4">
              <div className="p-4 bg-surfaceLight/40 border border-border/50 rounded-xl space-y-2 text-xs text-textSecondary">
                <p className="font-semibold text-textPrimary">📌 ขั้นตอนการชำระเงิน:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-textMuted">
                  <li>เปิดแอปธนาคารของคุณ สแกน QR Code ด้านซ้าย</li>
                  <li>ตรวจสอบยอดเงินให้ตรงกับ <strong className="text-textPrimary">{formatPrice(amount)}</strong></li>
                  <li>โอนเงินเรียบร้อยแล้ว เซฟรูปสลิปลงเครื่อง</li>
                  <li>นำสลิปรูปภาพมาอัปโหลดที่ช่องด้านล่าง</li>
                  <li>ระบบจะทำการตรวจสอบและส่งสินค้าให้ทันที ⚡</li>
                </ol>
              </div>

              <SlipUploader
                onFileSelect={setSelectedFile}
                selectedFile={selectedFile}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-border pt-5 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={isLoading || !selectedFile}
              className="w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-8 rounded-xl bg-primary-gradient hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm tracking-wide shadow-lg shadow-primary/20 transition-all btn-glow"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  กำลังตรวจสอบสลิป...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  ยืนยันการชำระเงิน
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
