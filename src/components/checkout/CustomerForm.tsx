'use client'

import React, { useState } from 'react'
import { User, Mail, Phone, ArrowRight } from 'lucide-react'
import { CheckoutFormData } from '@/types'

interface CustomerFormProps {
  onSubmit: (data: CheckoutFormData) => void
  initialData?: CheckoutFormData
  isLoading?: boolean
}

export default function CustomerForm({ onSubmit, initialData, isLoading = false }: CustomerFormProps) {
  const [formData, setFormData] = useState<CheckoutFormData>({
    name: initialData?.name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.name.trim()) {
      newErrors.name = 'กรุณากรอกชื่อ-นามสกุล'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'กรุณากรอกอีเมล'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง'
    }

    if (formData.phone && !/^[0-9\-+]{9,15}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'เบอร์โทรศัพท์ไม่ถูกต้อง (9-15 หลัก)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => {
        const updated = { ...prev }
        delete updated[name]
        return updated
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onSubmit(formData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-surface border border-border shadow-sm p-6 sm:p-8 rounded-2xl relative overflow-hidden transition-all duration-300">
      {/* Decorative corner glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-success/5 rounded-full blur-3xl pointer-events-none" />

      <div>
        <h2 className="text-xl font-bold text-textPrimary mb-1">ข้อมูลผู้ซื้อ</h2>
        <p className="text-textMuted text-sm">กรุณากรอกข้อมูลของคุณเพื่อใช้ในการจัดส่งสินค้าและส่งมอบข้อมูล</p>
      </div>

      <div className="space-y-4">
        {/* Name Input */}
        <div>
          <label htmlFor="customer-name" className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">
            ชื่อ-นามสกุล <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-textMuted">
              <User className="w-5 h-5 transition-colors group-focus-within:text-primary" />
            </div>
            <input
              type="text"
              id="customer-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="สมชาย ใจดี"
              className={`w-full pl-11 pr-4 py-3 bg-surfaceLight/50 border rounded-xl text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surfaceLight transition-all ${
                errors.name ? 'border-red-500/50 focus:border-red-500' : 'border-border focus:border-primary'
              }`}
              disabled={isLoading}
            />
          </div>
          {errors.name && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1 font-medium">{errors.name}</p>}
        </div>

        {/* Email Input */}
        <div>
          <label htmlFor="customer-email" className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">
            อีเมลสำหรับรับสินค้า <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-textMuted">
              <Mail className="w-5 h-5" />
            </div>
            <input
              type="email"
              id="customer-email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="example@domain.com"
              className={`w-full pl-11 pr-4 py-3 bg-surfaceLight/50 border rounded-xl text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surfaceLight transition-all ${
                errors.email ? 'border-red-500/50 focus:border-red-500' : 'border-border focus:border-primary'
              }`}
              disabled={isLoading}
            />
          </div>
          <p className="mt-1 text-[11px] text-textMuted">
            ⚠️ สำคัญมาก: ระบบจัดส่งข้อมูลสินค้า (AI Code, บัญชี, หรือลิงก์) ไปยังอีเมลนี้
          </p>
          {errors.email && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1 font-medium">{errors.email}</p>}
        </div>

        {/* Phone Input */}
        <div>
          <label htmlFor="customer-phone" className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-2">
            เบอร์โทรศัพท์ (ถ้ามี)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-textMuted">
              <Phone className="w-5 h-5" />
            </div>
            <input
              type="tel"
              id="customer-phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="0812345678"
              className={`w-full pl-11 pr-4 py-3 bg-surfaceLight/50 border rounded-xl text-textPrimary placeholder:text-textMuted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surfaceLight transition-all ${
                errors.phone ? 'border-red-500/50 focus:border-red-500' : 'border-border focus:border-primary'
              }`}
              disabled={isLoading}
            />
          </div>
          {errors.phone && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1 font-medium">{errors.phone}</p>}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-primary-gradient hover:opacity-90 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-lg shadow-primary/20 transition-all btn-glow"
      >
        {isLoading ? 'กำลังดำเนินการ...' : 'ไปขั้นตอนชำระเงิน'}
        {!isLoading && <ArrowRight className="w-4 h-4" />}
      </button>
    </form>
  )
}
