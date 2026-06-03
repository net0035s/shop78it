'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3, Box, Layers, Receipt, LogOut, RefreshCw,
  Check, X, Loader2, Tag, Clock, Sparkles
} from 'lucide-react'
import { formatPrice } from '@/lib/products'
import { formatDateWithTime } from '@/lib/utils'
import { DashboardOverview } from '@/components/admin/DashboardOverview'
import { ProductManager } from '@/components/admin/ProductManager'
import { StockManager } from '@/components/admin/StockManager'
import { OrderManager } from '@/components/admin/OrderManager'
import { CategoryManager } from '@/components/admin/CategoryManager'

type AdminTab = 'overview' | 'products' | 'stock' | 'stock-history' | 'orders' | 'categories'

// ===================================================
// MAIN ADMIN DASHBOARD
// ===================================================
export default function AdminDashboardPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')

  // Data states
  const [products, setProducts] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Order List States
  const [orderFilter, setOrderFilter] = useState('all')
  const [orderSearch, setOrderSearch] = useState('')
  const [orderPage, setOrderPage] = useState(1)
  const [orderPerPage, setOrderPerPage] = useState(10)

  // Reset page on filter/search change
  useEffect(() => {
    setOrderPage(1)
  }, [orderFilter, orderSearch, orderPerPage])

  // Product form
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [productForm, setProductForm] = useState({
    name: '', description: '', price: '', originalPrice: '', image: '/images/products/placeholder.png',
    category: 'subscription', categoryId: '', tags: '', isNew: false, isFeatured: false,
    deliveryInfo: 'ส่งด่วนอัตโนมัติ', deliveryType: 'auto'
  })

  // Stock form
  const [stockForm, setStockForm] = useState({ productId: '', type: 'login-info', bulkData: '', instructions: '' })
  const [isStockSubmitting, setIsStockSubmitting] = useState(false)
  const [stockMsg, setStockMsg] = useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (text) {
        setStockForm(f => ({ ...f, bulkData: text }))
      }
    }
    reader.onerror = () => {
      alert('เกิดข้อผิดพลาดในการอ่านไฟล์')
    }
    reader.readAsText(file)
    e.target.value = '' // Clear input so the same file can be selected again
  }

  // Stock Management (Read, Update, Delete)
  const [digitalStocks, setDigitalStocks] = useState<any[]>([])
  const [isFetchingStocks, setIsFetchingStocks] = useState(false)
  const [editingStockItem, setEditingStockItem] = useState<any>(null)
  const [editingStockContent, setEditingStockContent] = useState<any>({})

  // Stock History State
  const [stockHistory, setStockHistory] = useState<any[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [isFetchingHistory, setIsFetchingHistory] = useState(false)

  const fetchStockHistory = useCallback(async (page: number) => {
    setIsFetchingHistory(true)
    try {
      const res = await fetch(`/api/admin/stock/history?page=${page}&limit=20`)
      const data = await res.json()
      if (data.stocks) {
        setStockHistory(data.stocks)
        setHistoryTotalPages(data.totalPages || 1)
      }
    } catch (e) {
      console.error('Error fetching stock history:', e)
    } finally {
      setIsFetchingHistory(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'stock-history') {
      fetchStockHistory(historyPage)
    }
  }, [activeTab, historyPage, fetchStockHistory])

  // Fetch stocks when product is selected
  useEffect(() => {
    if (stockForm.productId) {
      fetchDigitalStocks(stockForm.productId)
    } else {
      setDigitalStocks([])
    }
  }, [stockForm.productId])

  const fetchDigitalStocks = async (productId: string) => {
    setIsFetchingStocks(true)
    try {
      const res = await fetch(`/api/admin/stock?productId=${productId}`)
      const data = await res.json()
      if (data.success) {
        setDigitalStocks(data.data)
      }
    } catch (e) { console.error('Error fetching digital stocks:', e) }
    finally { setIsFetchingStocks(false) }
  }

  // Category form
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<any>(null)
  const [catForm, setCatForm] = useState({ name: '', slug: '', icon: '📦', color: '#6366f1', sortOrder: 99 })

  // Order detail
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [editOrderForm, setEditOrderForm] = useState({ customerEmail: '', status: '', internalNote: '', deliveredContent: '', sendEmailNotification: true })
  const [isSavingOrder, setIsSavingOrder] = useState(false)

  const openOrderEdit = (order: any) => {
    setSelectedOrder(order)
    setEditOrderForm({
      customerEmail: order.customerEmail || '',
      status: order.status || 'pending',
      internalNote: order.internalNote || '',
      deliveredContent: order.deliveredContent || '',
      sendEmailNotification: true
    })
  }

  const handleSaveOrderEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedOrder) return
    setIsSavingOrder(true)
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editOrderForm)
      })
      const result = await res.json()
      if (result.success) {
        alert('บันทึกข้อมูลออเดอร์เรียบร้อยแล้ว')
        setSelectedOrder(null)
        fetchAll()
      } else {
        alert(result.error)
      }
    } catch (err) {
      console.error(err)
      alert('เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setIsSavingOrder(false)
    }
  }

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    try {
      const [pRes, oRes, cRes, sRes] = await Promise.all([
        fetch('/api/admin/products'),
        fetch('/api/admin/orders'),
        fetch('/api/admin/categories'),
        fetch('/api/admin/stats'),
      ])
      const [pData, oData, cData, sData] = await Promise.all([pRes.json(), oRes.json(), cRes.json(), sRes.json()])
      if (pData.success) setProducts(pData.data)
      if (oData.success) setOrders(oData.data)
      if (cData.success) setCategories(cData.data)
      if (sData.success) setStats(sData.data)
    } catch (e) { console.error('Fetch error:', e) }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      fetchAll()
    }
  }, [fetchAll])

  if (!mounted) return null

  const handleLogout = () => {
    localStorage.removeItem('shopauto-admin-token')
    router.push('/sign-in')
  }

  // ---- Product Handlers ----
  const openAddProduct = () => {
    setEditingProduct(null)
    setProductForm({ name: '', description: '', price: '', originalPrice: '', image: '/images/products/placeholder.png', category: categories[0]?.slug || 'subscription', categoryId: categories[0]?.id || '', tags: '', isNew: false, isFeatured: false, deliveryInfo: 'ส่งด่วนอัตโนมัติ', deliveryType: 'auto' })
    setIsProductModalOpen(true)
  }

  const openEditProduct = (p: any) => {
    setEditingProduct(p)
    setProductForm({ name: p.name, description: p.description, price: p.price.toString(), originalPrice: p.originalPrice?.toString() || '', image: p.image, category: p.category, categoryId: p.categoryId || '', tags: p.tags || '', isNew: p.isNew, isFeatured: p.isFeatured, deliveryInfo: p.deliveryInfo || 'ส่งด่วนอัตโนมัติ', deliveryType: p.deliveryType || 'auto' })
    setIsProductModalOpen(true)
  }

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = '/api/admin/products'
    const method = editingProduct ? 'PUT' : 'POST'
    const payload = editingProduct ? { ...productForm, id: editingProduct.id } : productForm
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const result = await res.json()
    if (result.success) { setIsProductModalOpen(false); fetchAll() }
    else alert(result.error || 'เกิดข้อผิดพลาด')
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('ยืนยันการลบสินค้า?')) return
    const res = await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' })
    const result = await res.json()
    if (result.success) fetchAll()
    else alert(result.error)
  }

  // ---- Stock Handlers ----
  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsStockSubmitting(true)
    setStockMsg('')
    try {
      const res = await fetch('/api/admin/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stockForm) })
      const result = await res.json()
      if (result.success) { 
        setStockMsg(`สำเร็จ: ${result.message} (สต็อกรวม: ${result.newStock})`)
        setStockForm(f => ({ ...f, bulkData: '' }))
        await fetchAll()
        if (stockForm.productId) await fetchDigitalStocks(stockForm.productId)
      }
      else setStockMsg(`ผิดพลาด: ${result.error}`)
    } catch (error) {
      console.error('Stock submit failed:', error)
      setStockMsg('ผิดพลาด: ไม่สามารถเติมสต็อกได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsStockSubmitting(false)
    }
  }

  const handleDeleteStockItem = async (id: string) => {
    if (!confirm('ยืนยันการลบรายการสต็อกนี้?')) return
    const res = await fetch(`/api/admin/stock?id=${id}`, { method: 'DELETE' })
    const result = await res.json()
    if (result.success) {
      fetchDigitalStocks(stockForm.productId)
      fetchAll() // update product count
    } else {
      alert(result.error)
    }
  }

  const handleUpdateStockItem = async (id: string) => {
    const res = await fetch(`/api/admin/stock?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editingStockContent })
    })
    const result = await res.json()
    if (result.success) {
      setEditingStockItem(null)
      fetchDigitalStocks(stockForm.productId)
    } else {
      alert(result.error)
    }
  }

  // ---- Order Handlers ----
  const handleUpdateOrderStatus = async (id: string, status: string) => {
    const res = await fetch('/api/admin/orders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    const result = await res.json()
    if (result.success) { setSelectedOrder(null); fetchAll() }
    else alert(result.error)
  }

  // ---- Category Handlers ----
  const openAddCat = () => { setEditingCat(null); setCatForm({ name: '', slug: '', icon: '📦', color: '#6366f1', sortOrder: 99 }); setIsCatModalOpen(true) }
  const openEditCat = (c: any) => { setEditingCat(c); setCatForm({ name: c.name, slug: c.slug, icon: c.icon, color: c.color, sortOrder: c.sortOrder }); setIsCatModalOpen(true) }

  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = '/api/admin/categories'
    const method = editingCat ? 'PUT' : 'POST'
    const payload = editingCat ? { ...catForm, id: editingCat.id } : catForm
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const result = await res.json()
    if (result.success) { setIsCatModalOpen(false); fetchAll() }
    else alert(result.error)
  }

  const handleDeleteCat = async (id: string) => {
    if (!confirm('ยืนยันการลบหมวดหมู่?')) return
    const res = await fetch(`/api/admin/categories?id=${id}`, { method: 'DELETE' })
    const result = await res.json()
    if (result.success) fetchAll()
    else alert(result.error)
  }

  // ---- Sidebar config ----
  const tabs = [
    { id: 'overview' as AdminTab, label: 'ภาพรวม', icon: BarChart3 },
    { id: 'products' as AdminTab, label: 'สินค้า', icon: Box },
    { id: 'stock' as AdminTab, label: 'สต็อกสินค้า', icon: Layers },
    { id: 'stock-history' as AdminTab, label: 'ประวัติสต็อก', icon: Clock },
    { id: 'orders' as AdminTab, label: 'ออเดอร์', icon: Receipt },
    { id: 'categories' as AdminTab, label: 'หมวดหมู่', icon: Tag },
  ]

  const manualDeliveryCount = orders.filter(o => o.status === 'needs_manual_delivery').length

  // =========================================================
  return (
    <div className="min-h-screen bg-[#060609] flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border/50 flex flex-col bg-surface/30 backdrop-blur sticky top-0 h-screen">
        <div className="p-5 border-b border-border/40">
          <div className="text-xs font-bold text-textMuted uppercase tracking-widest mb-1">ShopAuto</div>
          <div className="text-lg font-extrabold gradient-text">Admin Panel</div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const badge = tab.id === 'orders' && manualDeliveryCount > 0 ? manualDeliveryCount : null
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-primary/15 text-primary border border-primary/25' : 'text-textMuted hover:text-textPrimary hover:bg-surfaceLight/40'}`}>
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {badge && <span className="ml-auto bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{badge}</span>}
              </button>
            )
          })}
          <button onClick={() => router.push('/admin11/discounts')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-textMuted hover:text-textPrimary hover:bg-surfaceLight/40">
            <Tag className="w-4 h-4 shrink-0" />
            <span>คูปองส่วนลด</span>
          </button>
          <button onClick={() => router.push('/admin11/patch-notes')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-textMuted hover:text-textPrimary hover:bg-surfaceLight/40">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>อัปเดตระบบ</span>
          </button>
        </nav>
        <div className="p-3 border-t border-border/40">
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-textMuted hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut className="w-4 h-4" /><span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#060609]/90 backdrop-blur border-b border-border/40 px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-textPrimary text-base capitalize">{tabs.find(t => t.id === activeTab)?.label}</h1>
            <p className="text-[11px] text-textMuted">ระบบจัดการร้านค้า ShopAuto 24/7</p>
          </div>
          <button onClick={fetchAll} className="flex items-center gap-1.5 text-xs text-textMuted hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/10">
            <RefreshCw className="w-3.5 h-3.5" /><span>รีเฟรชข้อมูล</span>
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <div className="text-center space-y-4">
                <Loader2 className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto text-primary" />
                <p className="text-sm text-textMuted">กำลังดึงข้อมูลฐานข้อมูล...</p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <DashboardOverview
                  stats={stats}
                  manualDeliveryCount={manualDeliveryCount}
                  onShowOrders={() => setActiveTab('orders')}
                />
              )}

              {activeTab === 'products' && (
                <ProductManager
                  products={products}
                  categories={categories}
                  onAddProduct={openAddProduct}
                  onEditProduct={openEditProduct}
                  onDeleteProduct={handleDeleteProduct}
                />
              )}

              {activeTab === 'stock' && (
                <StockManager
                  mode="manage"
                  products={products}
                  stockForm={stockForm}
                  setStockForm={setStockForm}
                  isStockSubmitting={isStockSubmitting}
                  stockMsg={stockMsg}
                  digitalStocks={digitalStocks}
                  isFetchingStocks={isFetchingStocks}
                  editingStockItem={editingStockItem}
                  setEditingStockItem={setEditingStockItem}
                  editingStockContent={editingStockContent}
                  setEditingStockContent={setEditingStockContent}
                  fileInputRef={fileInputRef}
                  onFileUpload={handleFileUpload}
                  onSubmitStock={handleStockSubmit}
                  onDeleteStockItem={handleDeleteStockItem}
                  onUpdateStockItem={handleUpdateStockItem}
                  stockHistory={stockHistory}
                  historyPage={historyPage}
                  historyTotalPages={historyTotalPages}
                  setHistoryPage={setHistoryPage}
                  isFetchingHistory={isFetchingHistory}
                />
              )}

              {activeTab === 'stock-history' && (
                <StockManager
                  mode="history"
                  products={products}
                  stockForm={stockForm}
                  setStockForm={setStockForm}
                  isStockSubmitting={isStockSubmitting}
                  stockMsg={stockMsg}
                  digitalStocks={digitalStocks}
                  isFetchingStocks={isFetchingStocks}
                  editingStockItem={editingStockItem}
                  setEditingStockItem={setEditingStockItem}
                  editingStockContent={editingStockContent}
                  setEditingStockContent={setEditingStockContent}
                  fileInputRef={fileInputRef}
                  onFileUpload={handleFileUpload}
                  onSubmitStock={handleStockSubmit}
                  onDeleteStockItem={handleDeleteStockItem}
                  onUpdateStockItem={handleUpdateStockItem}
                  stockHistory={stockHistory}
                  historyPage={historyPage}
                  historyTotalPages={historyTotalPages}
                  setHistoryPage={setHistoryPage}
                  isFetchingHistory={isFetchingHistory}
                />
              )}

              {activeTab === 'orders' && (
                <OrderManager
                  orders={orders}
                  manualDeliveryCount={manualDeliveryCount}
                  orderFilter={orderFilter}
                  setOrderFilter={setOrderFilter}
                  orderSearch={orderSearch}
                  setOrderSearch={setOrderSearch}
                  orderPage={orderPage}
                  setOrderPage={setOrderPage}
                  orderPerPage={orderPerPage}
                  setOrderPerPage={setOrderPerPage}
                  onEditOrder={openOrderEdit}
                />
              )}

              {activeTab === 'categories' && (
                <CategoryManager
                  categories={categories}
                  products={products}
                  onAddCategory={openAddCat}
                  onEditCategory={openEditCat}
                  onDeleteCategory={handleDeleteCat}
                />
              )}
            </>
          )}        </div>
      </main>

      {/* ========== MODAL: Product Form ========== */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setIsProductModalOpen(false)}>
          <div className="w-full max-w-lg glass-card border border-border/80 rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-textPrimary">{editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="p-1.5 text-textMuted hover:text-textPrimary rounded-lg hover:bg-surfaceLight/40">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleProductSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {[
                { label: 'ชื่อสินค้า', key: 'name', type: 'text', required: true },
                { label: 'URL รูปภาพ', key: 'image', type: 'text' },
                { label: 'ราคาปัจจุบัน (฿)', key: 'price', type: 'number', required: true },
                { label: 'ราคาก่อนลด (฿)', key: 'originalPrice', type: 'number' },
                { label: 'แท็ก (คั่นด้วย ,)', key: 'tags', type: 'text' },
                { label: 'ข้อมูลการส่ง', key: 'deliveryInfo', type: 'text' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1.5">{field.label}</label>
                  <input type={field.type} required={field.required}
                    value={(productForm as any)[field.key]}
                    onChange={e => setProductForm(f => ({ ...f, [field.key]: e.target.value }))}
                    className="w-full px-3 py-2 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60" />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1.5">หมวดหมู่</label>
                <select
                  value={productForm.categoryId}
                  onChange={e => {
                    const cat = categories.find(c => c.id === e.target.value)
                    setProductForm(f => ({ ...f, categoryId: e.target.value, category: cat?.slug || 'subscription' }))
                  }}
                  className="w-full px-3 py-2 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60">
                  <option value="">- ไม่ระบุ -</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1.5">รูปแบบการจัดส่ง (Delivery Type)</label>
                <select
                  value={(productForm as any).deliveryType || 'auto'}
                  onChange={e => setProductForm(f => ({ ...f, deliveryType: e.target.value }))}
                  className="w-full px-3 py-2 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60">
                  <option value="auto">จัดส่งอัตโนมัติ 24/7 (เช็กคลัง DigitalStock)</option>
                  <option value="manual">แอดมินจัดส่งเอง (ไม่เช็กคลัง, โอนแล้วรอดำเนินการ)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1.5">รายละเอียด</label>
                <textarea rows={3} value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} required
                  className="w-full px-3 py-2 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60 resize-none" />
              </div>
              <div className="flex gap-4">
                {[{ label: 'สินค้าใหม่', key: 'isNew' }, { label: 'สินค้าแนะนำ', key: 'isFeatured' }].map(cb => (
                  <label key={cb.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={(productForm as any)[cb.key]}
                      onChange={e => setProductForm(f => ({ ...f, [cb.key]: e.target.checked }))}
                      className="w-4 h-4 rounded accent-primary" />
                    <span className="text-xs text-textMuted">{cb.label}</span>
                  </label>
                ))}
              </div>
              <div className="pt-2 bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-textMuted">
                ไม่ต้องกรอกจำนวนสต็อก ระบบคำนวณจาก DigitalStock อัตโนมัติ
              </div>
              <button type="submit" className="w-full py-2.5 bg-primary-gradient rounded-xl text-white font-bold text-sm btn-glow">
                {editingProduct ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มสินค้า'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========== MODAL: Category Form ========== */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setIsCatModalOpen(false)}>
          <div className="w-full max-w-md glass-card border border-border/80 rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-textPrimary">{editingCat ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}</h3>
              <button onClick={() => setIsCatModalOpen(false)} className="p-1.5 text-textMuted hover:text-textPrimary rounded-lg hover:bg-surfaceLight/40"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCatSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1.5">ชื่อหมวดหมู่ *</label>
                <input required value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="เช่น แพ็กเกจรายเดือน"
                  className="w-full px-3 py-2 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1.5">Slug (ใช้สำหรับ filter) *</label>
                <input required value={catForm.slug} onChange={e => setCatForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                  placeholder="เช่น monthly-package"
                  className="w-full px-3 py-2 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary font-mono focus:outline-none focus:border-primary/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1.5">ไอคอน (Emoji)</label>
                  <input value={catForm.icon} onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
                    placeholder="🤖"
                    className="w-full px-3 py-2 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1.5">สี Badge</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                      className="w-10 h-10 rounded-xl border border-border cursor-pointer bg-transparent" />
                    <input value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                      className="flex-1 px-2 py-2 bg-surfaceLight/40 border border-border rounded-xl text-xs text-textPrimary font-mono focus:outline-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1.5">ลำดับการแสดงผล</label>
                <input type="number" value={catForm.sortOrder} onChange={e => setCatForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 99 }))}
                  className="w-full px-3 py-2 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60" />
              </div>
              {/* Preview */}
              <div className="p-3 bg-surfaceLight/20 rounded-xl border border-border/40">
                <p className="text-[10px] text-textMuted mb-2">ตัวอย่าง Badge:</p>
                <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-lg border font-medium"
                  style={{ color: catForm.color, borderColor: catForm.color + '50', background: catForm.color + '20' }}>
                  {catForm.icon || '📦'} {catForm.name || 'ชื่อหมวดหมู่'}
                </span>
              </div>
              <button type="submit" className="w-full py-2.5 bg-primary-gradient rounded-xl text-white font-bold text-sm btn-glow">
                {editingCat ? 'บันทึกการเปลี่ยนแปลง' : 'สร้างหมวดหมู่'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========== MODAL: Order Detail & Safe Edit ========== */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
          <div className="w-full max-w-2xl glass-card border border-border/80 rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-textPrimary">ออเดอร์ {selectedOrder.orderNumber}</h3>
                <p className="text-xs text-textMuted">{formatDateWithTime(selectedOrder.createdAt)}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1.5 text-textMuted hover:text-textPrimary rounded-lg hover:bg-surfaceLight/40"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveOrderEdit} className="space-y-6 text-xs">
              
              {/* 1. Read-only Section */}
              <div className="p-4 bg-surfaceLight/10 border border-border/50 rounded-xl space-y-3">
                <h4 className="font-bold text-textPrimary mb-2 border-b border-border/50 pb-2">ข้อมูลหลัก (Read-only)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-textMuted mb-1">ชื่อลูกค้า</p>
                    <p className="font-bold text-textPrimary">{selectedOrder.customerName}</p>
                  </div>
                  <div>
                    <p className="text-textMuted mb-1">ยอดชำระสุทธิ</p>
                    <p className="font-bold text-primary text-base">{formatPrice(selectedOrder.total)}</p>
                  </div>
                </div>
                
                {/* Delivery Items */}
                {selectedOrder.deliveryItems?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-textMuted mb-1">สินค้าที่สั่งซื้อ / ส่งมอบ:</p>
                    <div className="space-y-2">
                      {selectedOrder.deliveryItems.map((item: any, i: number) => (
                        <div key={i} className="p-2 bg-surfaceLight/30 rounded-lg">
                          <p className="font-bold text-textPrimary">{item.productName}</p>
                          {item.licenseKey && <p className="text-[10px] text-textMuted">ข้อมูลสินค้า: {item.licenseKey}</p>}
                          {item.email && <p className="text-[10px] text-textMuted">อีเมล: {item.email} | รหัสผ่าน: {item.password}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Slip Image */}
                {selectedOrder.slipUrl && (
                  <div className="mt-2">
                    <p className="text-textMuted mb-1">สลิปโอนเงิน:</p>
                    <a href={selectedOrder.slipUrl} target="_blank" rel="noreferrer" className="block w-24 h-32 bg-surfaceLight/50 rounded-lg border border-border overflow-hidden hover:opacity-80 transition-opacity">
                      <img src={selectedOrder.slipUrl} alt="Slip" className="w-full h-full object-cover" />
                    </a>
                  </div>
                )}
              </div>

              {/* 2. Safe Edit Section */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-4">
                <h4 className="font-bold text-primary mb-2 border-b border-primary/20 pb-2">แก้ไขข้อมูล (Safe Edit)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-textMuted uppercase tracking-wider mb-1.5">อีเมลลูกค้า</label>
                    <input 
                      type="email" 
                      value={editOrderForm.customerEmail} 
                      onChange={e => setEditOrderForm({ ...editOrderForm, customerEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-surfaceLight/40 border border-border rounded-xl text-textPrimary focus:outline-none focus:border-primary/60" 
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-textMuted uppercase tracking-wider mb-1.5">สถานะออเดอร์</label>
                    <select 
                      value={editOrderForm.status} 
                      onChange={e => setEditOrderForm({ ...editOrderForm, status: e.target.value })}
                      className="w-full px-3 py-2 bg-surfaceLight/40 border border-border rounded-xl text-textPrimary focus:outline-none focus:border-primary/60"
                    >
                      <option value="pending">รอชำระเงิน (Pending)</option>
                      <option value="completed">สำเร็จ (Completed)</option>
                      <option value="needs_manual_delivery">รอดำเนินการโดยแอดมิน (Manual)</option>
                      <option value="cancelled">ยกเลิก (Cancelled)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-textMuted uppercase tracking-wider mb-1.5">บันทึกภายใน (Internal Note)</label>
                  <textarea 
                    rows={2}
                    value={editOrderForm.internalNote} 
                    onChange={e => setEditOrderForm({ ...editOrderForm, internalNote: e.target.value })}
                    placeholder="เช่น โอนเงินคืนแล้ว 150 บาท..."
                    className="w-full px-3 py-2 bg-surfaceLight/40 border border-border rounded-xl text-textPrimary focus:outline-none focus:border-primary/60 resize-none" 
                  />
                  <p className="text-[10px] text-textMuted mt-1">ข้อมูลส่วนนี้ลูกค้าจะไม่เห็น</p>
                </div>
              </div>

              {/* 3. Manual Fulfillment */}
              {(editOrderForm.status === 'needs_manual_delivery' || selectedOrder.status === 'needs_manual_delivery') && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl space-y-3">
                  <h4 className="font-bold text-orange-400 mb-1">จัดส่ง Manual</h4>
                  <p className="text-[10px] text-textMuted mb-2">กรอกข้อมูลสินค้าหรือรายละเอียดที่ต้องการส่งให้ลูกค้าผ่านระบบตรงนี้ เมื่อเปลี่ยนสถานะเป็น "สำเร็จ" ข้อมูลนี้จะแสดงในหน้าตรวจออเดอร์ของลูกค้า</p>
                  <textarea 
                    rows={3}
                    value={editOrderForm.deliveredContent} 
                    onChange={e => setEditOrderForm({ ...editOrderForm, deliveredContent: e.target.value })}
                    placeholder="เช่น ไอดี: test@test.com รหัสผ่าน: 12345"
                    className="w-full px-3 py-2 bg-surface border border-orange-500/30 rounded-xl text-textPrimary focus:outline-none focus:border-orange-500/60 font-mono text-xs" 
                  />
                  <label className="flex items-start gap-2.5 rounded-xl border border-orange-500/20 bg-surface/50 px-3 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editOrderForm.sendEmailNotification}
                      onChange={e => setEditOrderForm({ ...editOrderForm, sendEmailNotification: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded accent-primary"
                    />
                    <span className="text-xs text-textSecondary leading-relaxed">
                      ส่งอีเมลแจ้งเตือนลูกค้าถึงการอัปเดตนี้
                    </span>
                  </label>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isSavingOrder} className="flex-1 py-2.5 bg-primary-gradient rounded-xl text-white font-bold text-sm btn-glow disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSavingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  บันทึกและอัปเดตออเดอร์
                </button>
                <button type="button" onClick={() => setSelectedOrder(null)} className="px-6 py-2.5 bg-surfaceLight hover:bg-surfaceLight/80 border border-border rounded-xl text-textPrimary font-bold text-sm transition-all">
                  ปิดหน้าต่าง
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  )
}
