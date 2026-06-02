'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Edit, Loader2, Plus, Tag, Trash2, X } from 'lucide-react'

const emptyForm = {
  id: '',
  code: '',
  discountType: 'PERCENT',
  discountValue: '',
  minPurchaseAmount: '',
  applicableScope: 'all',
  maxUses: '',
  expiresAt: '',
  isActive: true,
}

function toDateInputValue(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function getStatus(discount: any) {
  if (!discount.isActive) return { label: 'ปิดใช้งาน', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' }
  if (discount.expiresAt && new Date(discount.expiresAt).getTime() < Date.now()) {
    return { label: 'หมดอายุ', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' }
  }
  if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
    return { label: 'สิทธิ์เต็ม', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' }
  }
  return { label: 'เปิดใช้งาน', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' }
}

function formatDiscount(discount: any) {
  return discount.discountType === 'PERCENT'
    ? `${discount.discountValue}%`
    : `${discount.discountValue.toLocaleString('th-TH')} บาท`
}

export default function AdminDiscountsPage() {
  const [mounted, setMounted] = useState(false)
  const [discounts, setDiscounts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [form, setForm] = useState(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')

  const editing = Boolean(form.id)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [discountRes, categoryRes] = await Promise.all([
        fetch('/api/admin/discounts'),
        fetch('/api/admin/categories'),
      ])
      const [discountData, categoryData] = await Promise.all([discountRes.json(), categoryRes.json()])
      if (discountData.success) setDiscounts(discountData.data)
      if (categoryData.success) setCategories(categoryData.data)
    } catch (error) {
      setMessage('โหลดข้อมูลคูปองไม่สำเร็จ')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    fetchData()
  }, [])

  const scopeOptions = useMemo(() => [
    { value: 'all', label: 'ใช้ได้ทั้งร้าน' },
    { value: 'type:auto', label: 'เฉพาะสินค้าส่งอัตโนมัติ' },
    { value: 'type:manual', label: 'เฉพาะสินค้าที่แอดมินจัดการ' },
    ...categories.map((category) => ({
      value: `category:${category.id}`,
      label: `หมวดหมู่: ${category.name}`,
    })),
  ], [categories])

  const resetForm = () => {
    setForm(emptyForm)
    setMessage('')
  }

  const openEdit = (discount: any) => {
    const applicableScope = discount.applicableType
      ? `type:${discount.applicableType}`
      : discount.applicableCategoryId
        ? `category:${discount.applicableCategoryId}`
        : 'all'

    setForm({
      id: discount.id,
      code: discount.code,
      discountType: discount.discountType,
      discountValue: String(discount.discountValue),
      minPurchaseAmount: discount.minPurchaseAmount ? String(discount.minPurchaseAmount) : '',
      applicableScope,
      maxUses: discount.maxUses ? String(discount.maxUses) : '',
      expiresAt: toDateInputValue(discount.expiresAt),
      isActive: discount.isActive,
    })
    setMessage('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setMessage('')

    const applicableType = form.applicableScope.startsWith('type:') ? form.applicableScope.replace('type:', '') : null
    const applicableCategoryId = form.applicableScope.startsWith('category:') ? form.applicableScope.replace('category:', '') : null

    try {
      const res = await fetch('/api/admin/discounts', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id || undefined,
          code: form.code,
          discountType: form.discountType,
          discountValue: form.discountValue,
          minPurchaseAmount: form.minPurchaseAmount,
          applicableType,
          applicableCategoryId,
          maxUses: form.maxUses,
          expiresAt: form.expiresAt || null,
          isActive: form.isActive,
        }),
      })
      const result = await res.json()
      if (!result.success) {
        setMessage(result.error || 'บันทึกคูปองไม่สำเร็จ')
        return
      }
      setMessage(editing ? 'แก้ไขคูปองเรียบร้อยแล้ว' : 'สร้างคูปองเรียบร้อยแล้ว')
      resetForm()
      fetchData()
    } catch (error) {
      setMessage('บันทึกคูปองไม่สำเร็จ')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบคูปองนี้?')) return
    const res = await fetch(`/api/admin/discounts?id=${id}`, { method: 'DELETE' })
    const result = await res.json()
    if (result.success) fetchData()
    else setMessage(result.error || 'ลบคูปองไม่สำเร็จ')
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[#060609] text-textPrimary px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link href="/admin11" className="inline-flex items-center gap-2 text-xs text-textMuted hover:text-primary mb-3">
              <ArrowLeft className="w-4 h-4" />
              กลับหน้าแอดมินหลัก
            </Link>
            <h1 className="text-2xl font-black text-textPrimary flex items-center gap-2">
              <Tag className="w-6 h-6 text-primary" />
              จัดการคูปองส่วนลด
            </h1>
            <p className="text-sm text-textMuted mt-1">สร้าง แก้ไข ปิดใช้ และจำกัดเงื่อนไขคูปองสำหรับลูกค้า</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-surface/70 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
              <h2 className="font-bold text-textPrimary">รายการคูปอง ({discounts.length})</h2>
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surfaceLight/20 text-textMuted text-xs">
                  <tr>
                    <th className="text-left px-5 py-3">Code</th>
                    <th className="text-left px-5 py-3">สถานะ</th>
                    <th className="text-left px-5 py-3">ยอดที่ลด</th>
                    <th className="text-left px-5 py-3">ใช้ไป</th>
                    <th className="text-right px-5 py-3">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {discounts.map((discount) => {
                    const status = getStatus(discount)
                    return (
                      <tr key={discount.id} className="hover:bg-surfaceLight/10">
                        <td className="px-5 py-4">
                          <p className="font-mono font-black text-textPrimary">{discount.code}</p>
                          <p className="text-[11px] text-textMuted">
                            ขั้นต่ำ {discount.minPurchaseAmount || 0} บาท
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg border text-[11px] font-bold ${status.bg} ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-bold text-primary">{formatDiscount(discount)}</td>
                        <td className="px-5 py-4 text-textSecondary">
                          {discount.usedCount} / {discount.maxUses ?? 'ไม่จำกัด'}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(discount)} className="p-2 rounded-lg text-textMuted hover:text-primary hover:bg-primary/10">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(discount.id)} className="p-2 rounded-lg text-textMuted hover:text-red-400 hover:bg-red-500/10">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!isLoading && discounts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-textMuted">ยังไม่มีคูปอง</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-border/60 bg-surface/70 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-textPrimary">{editing ? 'แก้ไขคูปอง' : 'สร้างคูปองใหม่'}</h2>
              {editing && (
                <button type="button" onClick={resetForm} className="p-1.5 rounded-lg text-textMuted hover:text-textPrimary hover:bg-surfaceLight/40">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <label className="block">
              <span className="block text-[11px] font-bold text-textMuted mb-1.5">ชื่อโค้ด</span>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-xl bg-surfaceLight/40 border border-border text-textPrimary font-mono focus:outline-none focus:border-primary" />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[11px] font-bold text-textMuted mb-1.5">ประเภท</span>
                <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-surfaceLight/40 border border-border text-textPrimary focus:outline-none focus:border-primary">
                  <option value="PERCENT">ลดเป็น %</option>
                  <option value="FIXED">ลดเป็นบาท</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] font-bold text-textMuted mb-1.5">ยอดลด</span>
                <input required type="number" min="0" step="0.01" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-surfaceLight/40 border border-border text-textPrimary focus:outline-none focus:border-primary" />
              </label>
            </div>

            <label className="block">
              <span className="block text-[11px] font-bold text-textMuted mb-1.5">ยอดซื้อขั้นต่ำ</span>
              <input type="number" min="0" step="0.01" placeholder="ปล่อยว่างได้" value={form.minPurchaseAmount} onChange={(e) => setForm({ ...form, minPurchaseAmount: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-surfaceLight/40 border border-border text-textPrimary focus:outline-none focus:border-primary" />
            </label>

            <label className="block">
              <span className="block text-[11px] font-bold text-textMuted mb-1.5">ข้อจำกัดสินค้า</span>
              <select value={form.applicableScope} onChange={(e) => setForm({ ...form, applicableScope: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-surfaceLight/40 border border-border text-textPrimary focus:outline-none focus:border-primary">
                {scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="block text-[11px] font-bold text-textMuted mb-1.5">จำกัดจำนวนการใช้</span>
              <input type="number" min="1" placeholder="ปล่อยว่าง = ไม่จำกัด" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-surfaceLight/40 border border-border text-textPrimary focus:outline-none focus:border-primary" />
            </label>

            <label className="block">
              <span className="block text-[11px] font-bold text-textMuted mb-1.5">วันและเวลาหมดอายุ</span>
              <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-surfaceLight/40 border border-border text-textPrimary focus:outline-none focus:border-primary" />
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 rounded accent-primary" />
              <span className="text-sm text-textSecondary">เปิดใช้งานคูปองนี้</span>
            </label>

            {message && <p className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">{message}</p>}

            <button disabled={isSaving} className="w-full py-3 rounded-xl bg-primary-gradient text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editing ? 'บันทึกการแก้ไข' : 'สร้างคูปอง'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
