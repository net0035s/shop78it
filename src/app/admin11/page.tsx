'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3, Box, Layers, Receipt, LogOut, Plus, Edit, Trash2,
  RefreshCw, DollarSign, ShoppingBag, AlertTriangle, ShieldCheck,
  Eye, Check, X, Upload, Loader2, Tag, TrendingUp, Clock,
  PackageX, ChevronRight, Zap, Hash
} from 'lucide-react'
import { formatPrice } from '@/lib/products'
import { formatDateWithTime } from '@/lib/utils'

type AdminTab = 'overview' | 'products' | 'stock' | 'stock-history' | 'orders' | 'categories'

// ===================================================
// Reusable Stock Content Parser Component
// ===================================================
function StockContentParser({ stock }: { stock: any }) {
  let parsed: any = {}
  try { parsed = JSON.parse(stock.content) } catch (e) {}

  return (
    <div className="space-y-1">
      {stock.type === 'license-key' ? (
        <div className="font-mono text-xs text-primary font-semibold">{parsed.licenseKey}</div>
      ) : stock.type === 'login-info' ? (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-textPrimary">{parsed.email}</span>
            <span className="text-textMuted">|</span>
            <span className="font-mono text-textSecondary">{parsed.password}</span>
          </div>
          {parsed.loginUrl && <div className="text-[10px] text-blue-400 truncate max-w-xs">{parsed.loginUrl}</div>}
        </div>
      ) : stock.type === 'login-link' ? (
        <div className="text-xs text-blue-400 truncate max-w-xs">{parsed.loginUrl || parsed.url || parsed.link}</div>
      ) : (stock.type === 'ai-credit' || stock.type === 'ai-credit-code' || stock.type === 'credit-code') ? (
        <div className="font-mono text-xs text-primary font-semibold">{parsed.creditCode || parsed.code} <span className="text-textMuted ml-1">({parsed.creditAmount})</span></div>
      ) : (
        <div className="font-mono text-[10px] text-textMuted break-all bg-surfaceLight/30 p-1.5 rounded">{stock.content}</div>
      )}
      {parsed.instructions && <div className="text-[10px] text-textMuted mt-1">{parsed.instructions}</div>}
    </div>
  )
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:               { label: 'รอชำระ',           color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30',   dot: 'bg-amber-400' },
  completed:             { label: 'สำเร็จ',            color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400' },
  needs_manual_delivery: { label: 'รอส่งด้วยตัวเอง',  color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30',  dot: 'bg-orange-400' },
  cancelled:             { label: 'ยกเลิก',            color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',        dot: 'bg-red-400' },
}

// ===================================================
// SVG Line Chart Component
// ===================================================
function LineChart({ data }: { data: { label: string; orders: number; revenue: number }[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; idx: number } | null>(null)
  const W = 460, H = 120, padL = 10, padR = 10, padT = 16, padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const maxOrders = Math.max(...data.map(d => d.orders), 1)
  const pts = data.map((d, i) => ({
    x: padL + (i / (data.length - 1 || 1)) * innerW,
    y: padT + innerH - (d.orders / maxOrders) * innerH,
  }))

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const areaPath = `M${pts[0]?.x},${padT + innerH} ` +
    pts.map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${pts[pts.length - 1]?.x},${padT + innerH} Z`

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => (
          <line key={i} x1={padL} x2={W - padR} y1={padT + r * innerH} y2={padT + r * innerH}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        {/* Area fill */}
        <path d={areaPath} fill="url(#chartGrad)" />
        {/* Line */}
        <polyline points={polyline} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Data points */}
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setTooltip({ x: p.x, y: p.y, idx: i })} onMouseLeave={() => setTooltip(null)}>
            <circle cx={p.x} cy={p.y} r="10" fill="transparent" className="cursor-pointer" />
            <circle cx={p.x} cy={p.y} r={tooltip?.idx === i ? 5 : 3}
              fill={tooltip?.idx === i ? '#818cf8' : '#6366f1'} stroke="#1e1e2e" strokeWidth="2" />
          </g>
        ))}
        {/* X labels */}
        {data.map((d, i) => (
          <text key={i} x={pts[i]?.x} y={H - 4} textAnchor="middle"
            fontSize="9" fill="rgba(255,255,255,0.4)">{d.label}</text>
        ))}
      </svg>
      {/* Tooltip */}
      {tooltip !== null && (
        <div className="absolute z-10 pointer-events-none"
          style={{ left: `${(tooltip.x / W) * 100}%`, top: `${(tooltip.y / H) * 100}%`, transform: 'translate(-50%, -130%)' }}>
          <div className="bg-surface border border-border rounded-xl px-3 py-2 text-xs shadow-xl whitespace-nowrap">
            <div className="font-bold text-textPrimary">{data[tooltip.idx]?.label}</div>
            <div className="text-textMuted">{data[tooltip.idx]?.orders} ออเดอร์</div>
            <div className="text-primary font-semibold">{formatPrice(data[tooltip.idx]?.revenue)}</div>
          </div>
        </div>
      )}
    </div>
  )
}

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
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)

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
    deliveryInfo: 'ส่งด่วนอัตโนมัติ ⚡', deliveryType: 'auto'
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
    setProductForm({ name: '', description: '', price: '', originalPrice: '', image: '/images/products/placeholder.png', category: categories[0]?.slug || 'subscription', categoryId: categories[0]?.id || '', tags: '', isNew: false, isFeatured: false, deliveryInfo: 'ส่งด่วนอัตโนมัติ ⚡', deliveryType: 'auto' })
    setIsProductModalOpen(true)
  }

  const openEditProduct = (p: any) => {
    setEditingProduct(p)
    setProductForm({ name: p.name, description: p.description, price: p.price.toString(), originalPrice: p.originalPrice?.toString() || '', image: p.image, category: p.category, categoryId: p.categoryId || '', tags: p.tags || '', isNew: p.isNew, isFeatured: p.isFeatured, deliveryInfo: p.deliveryInfo || 'ส่งด่วนอัตโนมัติ ⚡', deliveryType: p.deliveryType || 'auto' })
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
    const res = await fetch('/api/admin/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stockForm) })
    const result = await res.json()
    setIsStockSubmitting(false)
    if (result.success) { 
      setStockMsg(`✅ ${result.message} (สต็อกรวม: ${result.newStock})`)
      setStockForm(f => ({ ...f, bulkData: '' }))
      fetchAll()
      if (stockForm.productId) fetchDigitalStocks(stockForm.productId)
    }
    else setStockMsg(`❌ ${result.error}`)
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
    { id: 'stock' as AdminTab, label: 'เติมสต็อก', icon: Layers },
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
            <p className="text-[11px] text-textMuted">แผงควบคุมระบบจัดการร้านค้า ShopAuto 24/7</p>
          </div>
          <button onClick={fetchAll} className="flex items-center gap-1.5 text-xs text-textMuted hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/10">
            <RefreshCw className="w-3.5 h-3.5" /><span>รีเฟรช</span>
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
              {/* ========== TAB: OVERVIEW ========== */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Manual delivery alert */}
                  {manualDeliveryCount > 0 && (
                    <div className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl">
                      <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-orange-400">⚠️ มี {manualDeliveryCount} ออเดอร์ที่ต้องส่งสินค้าด้วยตัวเอง!</p>
                        <p className="text-xs text-textMuted mt-0.5">ลูกค้าชำระเงินแล้วแต่สต็อกสินค้าหมด กรุณาเข้าไปดำเนินการที่แท็บ "ออเดอร์"</p>
                      </div>
                      <button onClick={() => setActiveTab('orders')} className="text-xs text-orange-400 font-bold hover:underline flex items-center gap-1">
                        ดูออเดอร์ <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'รายได้วันนี้', value: formatPrice(stats?.todayRevenue ?? 0), icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                      { label: 'รายได้เดือนนี้', value: formatPrice(stats?.monthRevenue ?? 0), icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
                      { label: 'รอดำเนินการ', value: `${stats?.pendingOrders ?? 0} รายการ`, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                      { label: 'สต็อกใกล้หมด', value: `${stats?.lowStockProducts?.length ?? 0} สินค้า`, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
                    ].map((card, i) => {
                      const Icon = card.icon
                      return (
                        <div key={i} className="glass-card p-4 rounded-2xl border border-border/50 space-y-3">
                          <div className={`inline-flex w-9 h-9 rounded-xl ${card.bg} items-center justify-center`}>
                            <Icon className={`w-4.5 h-4.5 ${card.color}`} />
                          </div>
                          <div>
                            <div className={`text-xl font-extrabold ${card.color}`}>{card.value}</div>
                            <div className="text-[11px] text-textMuted">{card.label}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Chart + Low Stock */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* SVG Chart */}
                    <div className="lg:col-span-2 glass-card p-5 rounded-2xl border border-border/50">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-sm font-bold text-textPrimary">ยอดออเดอร์ 7 วันล่าสุด</h3>
                          <p className="text-xs text-textMuted">แสดงจำนวนออเดอร์ต่อวัน</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                          <Zap className="w-3 h-3" /><span>Live</span>
                        </div>
                      </div>
                      {stats?.last7Days?.length > 0 ? (
                        <LineChart data={stats.last7Days} />
                      ) : (
                        <div className="h-[120px] flex items-center justify-center text-textMuted text-sm">ยังไม่มีข้อมูลออเดอร์</div>
                      )}
                    </div>

                    {/* Low Stock Alert */}
                    <div className="glass-card p-5 rounded-2xl border border-border/50">
                      <h3 className="text-sm font-bold text-textPrimary mb-1">⚠️ สต็อกใกล้หมด</h3>
                      <p className="text-xs text-textMuted mb-4">สินค้าที่มีสต็อก ≤ 3 ชิ้น</p>
                      {(stats?.lowStockProducts ?? []).length === 0 ? (
                        <div className="text-center py-6">
                          <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                          <p className="text-xs text-textMuted">สต็อกสินค้าทั้งหมดอยู่ในระดับปกติ</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(stats.lowStockProducts as any[]).map((p: any) => (
                            <div key={p.id} className="flex items-center gap-2 p-2 rounded-xl bg-surfaceLight/30">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${p.unsoldCount === 0 ? 'bg-red-400' : 'bg-amber-400'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-textPrimary truncate">{p.name}</p>
                              </div>
                              <span className={`text-xs font-bold ${p.unsoldCount === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                                {p.unsoldCount === 0 ? 'หมด' : `${p.unsoldCount} ชิ้น`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recent Orders */}
                  <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
                    <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-textPrimary">ออเดอร์ล่าสุด</h3>
                      <button onClick={() => setActiveTab('orders')} className="text-xs text-primary hover:underline">ดูทั้งหมด →</button>
                    </div>
                    <div className="divide-y divide-border/30">
                      {(stats?.recentOrders ?? []).slice(0, 5).map((o: any) => {
                        const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.pending
                        return (
                          <div key={o.id} className="px-5 py-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-textPrimary">{o.orderNumber}</p>
                              <p className="text-[11px] text-textMuted truncate">{o.customerName}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold text-textPrimary">{formatPrice(o.total)}</p>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${cfg.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                      {(stats?.recentOrders ?? []).length === 0 && (
                        <div className="px-5 py-8 text-center text-sm text-textMuted">ยังไม่มีออเดอร์</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ========== TAB: PRODUCTS ========== */}
              {activeTab === 'products' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-textPrimary">จัดการสินค้า ({products.length})</h2>
                    <button onClick={openAddProduct} className="flex items-center gap-1.5 px-4 py-2 bg-primary-gradient rounded-xl text-white text-sm font-bold btn-glow">
                      <Plus className="w-4 h-4" /><span>เพิ่มสินค้า</span>
                    </button>
                  </div>
                  <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border/50 bg-surfaceLight/30">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">สินค้า</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider hidden md:table-cell">หมวดหมู่</th>
                          <th className="text-right px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">ราคา</th>
                          <th className="text-center px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">สต็อก</th>
                          <th className="text-right px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {products.map(p => {
                          const cat = categories.find(c => c.id === p.categoryId || c.slug === p.category)
                          return (
                            <tr key={p.id} className="hover:bg-surfaceLight/20 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-medium text-textPrimary text-xs">{p.name}</div>
                                <div className="text-[10px] text-textMuted">{p.deliveryInfo}</div>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                {cat ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border"
                                    style={{ color: cat.color, borderColor: cat.color + '40', background: cat.color + '15' }}>
                                    {cat.icon} {cat.name}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-textMuted">{p.category}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="text-xs font-bold text-textPrimary">{formatPrice(p.price)}</div>
                                {p.originalPrice && <div className="text-[10px] text-textMuted line-through">{formatPrice(p.originalPrice)}</div>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                                  p.stockStatus === 'out-of-stock' ? 'bg-red-500/10 text-red-400'
                                  : p.stockStatus === 'low-stock' ? 'bg-amber-500/10 text-amber-400'
                                  : 'bg-emerald-500/10 text-emerald-400'
                                }`}>
                                  {p.stock}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button onClick={() => openEditProduct(p)} className="p-1.5 text-textMuted hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 text-textMuted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {products.length === 0 && (
                          <tr><td colSpan={5} className="px-4 py-12 text-center text-textMuted text-sm">ยังไม่มีสินค้า</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ========== TAB: STOCK ========== */}
              {activeTab === 'stock' && (
                <div className="space-y-4 w-full">
                  <h2 className="text-base font-bold text-textPrimary">จัดการสต็อกสินค้าดิจิทัล</h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* Left Column: Form & Info */}
                    <div className="space-y-4">
                      <div className="glass-card p-6 rounded-2xl border border-border/50">
                    <form onSubmit={handleStockSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-textMuted uppercase tracking-wider mb-2">เลือกสินค้า</label>
                        <select value={stockForm.productId} onChange={e => setStockForm(f => ({ ...f, productId: e.target.value }))}
                          required className="w-full px-3 py-2.5 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60">
                          <option value="">— เลือกสินค้า —</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} (สต็อก: {p.stock})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-textMuted uppercase tracking-wider mb-2">ประเภทสต็อก</label>
                        <select value={stockForm.type} onChange={e => setStockForm(f => ({ ...f, type: e.target.value }))}
                          className="w-full px-3 py-2.5 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60">
                          <option value="login-info">🔐 Email + Password (รูปแบบ email|password|url)</option>
                          <option value="license-key">🔑 License Key (บรรทัดละ 1 คีย์)</option>
                          <option value="login-link">🔗 Login Link (บรรทัดละ 1 URL)</option>
                          <option value="ai-credit">💳 AI Credit Code (บรรทัดละ 1 โค้ด)</option>
                        </select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-bold text-textMuted uppercase tracking-wider">
                            วางข้อมูลสต็อก (บรรทัดละ 1 รายการ) — จะเติม <strong className="text-primary">{stockForm.bulkData.split('\n').filter(l => l.trim()).length} รายการ</strong>
                          </label>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-textSecondary bg-surfaceLight hover:bg-surfaceLight/80 hover:text-primary rounded-lg border border-border transition-all"
                          >
                            📄 Upload CSV/TXT
                          </button>
                          <input
                            type="file"
                            accept=".csv, .txt"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                          />
                        </div>
                        <textarea value={stockForm.bulkData} onChange={e => setStockForm(f => ({ ...f, bulkData: e.target.value }))}
                          required rows={6} placeholder={stockForm.type === 'login-info' ? 'user@email.com|password123|https://chatgpt.com\nuser2@email.com|pass456' : 'KEY-XXXX-YYYY-ZZZZ'}
                          className="w-full px-3 py-2.5 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary font-mono placeholder:text-textMuted focus:outline-none focus:border-primary/60 resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-textMuted uppercase tracking-wider mb-2">คำแนะนำการใช้งาน (optional)</label>
                        <input value={stockForm.instructions} onChange={e => setStockForm(f => ({ ...f, instructions: e.target.value }))}
                          placeholder="คำแนะนำเพิ่มเติมสำหรับลูกค้า..."
                          className="w-full px-3 py-2.5 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary placeholder:text-textMuted focus:outline-none focus:border-primary/60" />
                      </div>
                      {stockMsg && (
                        <p className={`text-sm font-medium p-3 rounded-xl ${stockMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{stockMsg}</p>
                      )}
                      <button type="submit" disabled={isStockSubmitting}
                        className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-primary-gradient text-white font-bold btn-glow disabled:opacity-50">
                        {isStockSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        เติมสต็อกทั้งหมด
                      </button>
                    </form>
                  </div>
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl text-xs text-textMuted space-y-1">
                    <p className="font-bold text-primary">💡 Single Source of Truth</p>
                    <p>จำนวนสต็อกที่แสดงหน้าเว็บร้านค้าจะคำนวณจากรายการใน DigitalStock ที่ยังไม่ถูกขายโดยอัตโนมัติ ไม่ต้องพิมพ์ตัวเลขเอง</p>
                  </div>
                    </div>

                    {/* Right Column: Data Table */}
                    <div>
                      {stockForm.productId ? (
                        <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
                      <div className="p-4 border-b border-border/50 bg-surfaceLight/30 flex justify-between items-center">
                        <h3 className="font-bold text-textPrimary text-sm">รายการสต็อกในคลัง ({digitalStocks.length})</h3>
                        <button onClick={() => fetchDigitalStocks(stockForm.productId)} className="text-textMuted hover:text-primary transition-colors">
                          <RefreshCw className={`w-4 h-4 ${isFetchingStocks ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-surfaceLight/20 border-b border-border/30">
                            <tr>
                              <th className="px-4 py-3 text-left font-bold text-xs text-textMuted uppercase tracking-wider">ข้อมูลสต็อก (Content)</th>
                              <th className="px-4 py-3 text-center font-bold text-xs text-textMuted uppercase tracking-wider">สถานะ</th>
                              <th className="px-4 py-3 text-right font-bold text-xs text-textMuted uppercase tracking-wider">จัดการ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {digitalStocks.map(stock => {
                              let parsed: any = {}
                              try { parsed = JSON.parse(stock.content) } catch (e) {}

                              return (
                                <tr key={stock.id} className="hover:bg-surfaceLight/20 transition-colors group">
                                  <td className="px-4 py-3">
                                    {editingStockItem === stock.id ? (
                                      <div className="flex flex-col gap-2 w-full max-w-sm">
                                        {stock.type === 'login-info' && (
                                          <>
                                            <input className="w-full bg-surface border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/60" value={editingStockContent.email || ''} onChange={e => setEditingStockContent({ ...editingStockContent, email: e.target.value })} placeholder="Email" />
                                            <input className="w-full bg-surface border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/60" value={editingStockContent.password || ''} onChange={e => setEditingStockContent({ ...editingStockContent, password: e.target.value })} placeholder="Password" />
                                            <input className="w-full bg-surface border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/60" value={editingStockContent.loginUrl || ''} onChange={e => setEditingStockContent({ ...editingStockContent, loginUrl: e.target.value })} placeholder="Login URL (optional)" />
                                          </>
                                        )}
                                        {stock.type === 'license-key' && (
                                          <input className="w-full bg-surface border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/60" value={editingStockContent.licenseKey || ''} onChange={e => setEditingStockContent({ ...editingStockContent, licenseKey: e.target.value })} placeholder="License Key" />
                                        )}
                                        {stock.type === 'login-link' && (
                                          <input className="w-full bg-surface border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/60" value={editingStockContent.loginUrl || editingStockContent.url || editingStockContent.link || ''} onChange={e => setEditingStockContent({ ...editingStockContent, loginUrl: e.target.value })} placeholder="Login Link" />
                                        )}
                                        {(stock.type === 'ai-credit' || stock.type === 'ai-credit-code' || stock.type === 'credit-code') && (
                                          <input className="w-full bg-surface border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/60" value={editingStockContent.creditCode || editingStockContent.code || ''} onChange={e => setEditingStockContent({ ...editingStockContent, creditCode: e.target.value })} placeholder="Credit Code" />
                                        )}
                                        {!['login-info', 'license-key', 'login-link', 'ai-credit', 'ai-credit-code', 'credit-code'].includes(stock.type) && (
                                          <textarea className="w-full bg-surface border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/60 font-mono" rows={3} value={JSON.stringify(editingStockContent)} onChange={e => {
                                            try { setEditingStockContent(JSON.parse(e.target.value)) } catch (err) {}
                                          }} placeholder="JSON Data" />
                                        )}
                                      </div>
                                    ) : (
                                      <StockContentParser stock={stock} />
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg ${stock.isSold ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                      {stock.isSold ? 'ขายแล้ว' : 'พร้อมขาย'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {editingStockItem === stock.id ? (
                                        <>
                                          <button onClick={() => handleUpdateStockItem(stock.id)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded transition-all">
                                            <Check className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => setEditingStockItem(null)} className="p-1 text-textMuted hover:bg-surfaceLight rounded transition-all">
                                            <X className="w-4 h-4" />
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button 
                                            onClick={() => { setEditingStockItem(stock.id); setEditingStockContent(parsed) }}
                                            className="p-1 text-textMuted hover:text-primary hover:bg-primary/10 rounded transition-all"
                                          >
                                            <Edit className="w-3.5 h-3.5" />
                                          </button>
                                          <button 
                                            onClick={() => handleDeleteStockItem(stock.id)}
                                            disabled={stock.isSold}
                                            className={`p-1 rounded transition-all ${stock.isSold ? 'text-border cursor-not-allowed' : 'text-textMuted hover:text-red-400 hover:bg-red-500/10'}`}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                            {digitalStocks.length === 0 && !isFetchingStocks && (
                              <tr><td colSpan={3} className="px-4 py-8 text-center text-textMuted text-sm">ยังไม่มีรายการสต็อก</td></tr>
                            )}
                            {isFetchingStocks && (
                              <tr><td colSpan={3} className="px-4 py-8 text-center text-textMuted"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                      ) : (
                        <div className="glass-card rounded-2xl border border-border/50 p-12 flex flex-col items-center justify-center text-center text-textMuted h-full min-h-[400px]">
                          <Box className="w-12 h-12 mb-3 opacity-20" />
                          <p>กรุณาเลือกสินค้าจากด้านซ้าย<br/>เพื่อจัดการรายการสต็อก</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ========== TAB: STOCK HISTORY ========== */}
              {activeTab === 'stock-history' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-textPrimary">ประวัติสต็อก (Stock History)</h2>
                      <p className="text-xs text-textMuted">ประวัติความเคลื่อนไหวของสต็อกสินค้าดิจิทัลทั้งหมด</p>
                    </div>
                    <button onClick={() => fetchStockHistory(historyPage)} className="p-2 bg-surfaceLight/50 hover:bg-surfaceLight rounded-xl border border-border/50 transition-all text-textMuted hover:text-primary">
                      <RefreshCw className={`w-4 h-4 ${isFetchingHistory ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-surfaceLight/20 border-b border-border/30">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold text-xs text-textMuted uppercase tracking-wider">สินค้า</th>
                            <th className="px-4 py-3 text-left font-bold text-xs text-textMuted uppercase tracking-wider">ข้อมูลสต็อก (Content)</th>
                            <th className="px-4 py-3 text-center font-bold text-xs text-textMuted uppercase tracking-wider">สถานะ</th>
                            <th className="px-4 py-3 text-left font-bold text-xs text-textMuted uppercase tracking-wider">ออเดอร์ที่สั่งซื้อ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {stockHistory.map(stock => (
                            <tr key={stock.id} className="hover:bg-surfaceLight/10 transition-colors">
                              <td className="px-4 py-3">
                                <div className="text-xs font-medium text-textPrimary max-w-[150px] truncate">{stock.product?.name || 'Unknown Product'}</div>
                              </td>
                              <td className="px-4 py-3">
                                <StockContentParser stock={stock} />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg ${stock.isSold ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                  {stock.isSold ? 'ขายแล้ว' : 'พร้อมขาย'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {stock.isSold && (stock.order?.orderNumber || stock.orderId) ? (
                                  <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80" onClick={() => {
                                    setOrderSearch(stock.order?.orderNumber || stock.orderId)
                                    setActiveTab('orders')
                                  }}>
                                    <Receipt className="w-3.5 h-3.5 text-primary" />
                                    <span className="text-xs font-mono text-primary font-medium hover:underline" title="คลิกเพื่อดูออเดอร์">
                                      {stock.order?.orderNumber || `${stock.orderId.substring(0, 8)}...`}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-textMuted">- (รอขาย)</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {stockHistory.length === 0 && !isFetchingHistory && (
                            <tr><td colSpan={4} className="px-4 py-12 text-center text-textMuted text-sm">ไม่มีประวัติสต็อก</td></tr>
                          )}
                          {isFetchingHistory && stockHistory.length === 0 && (
                            <tr><td colSpan={4} className="px-4 py-12 text-center text-textMuted"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination */}
                    {historyTotalPages > 1 && (
                      <div className="p-4 border-t border-border/50 bg-surfaceLight/10 flex items-center justify-between">
                        <button
                          disabled={historyPage === 1}
                          onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                          className="px-3 py-1.5 text-xs font-bold bg-surfaceLight border border-border rounded-lg disabled:opacity-30 transition-all hover:bg-surfaceLight/80"
                        >
                          ก่อนหน้า
                        </button>
                        <span className="text-xs text-textMuted font-medium">หน้า {historyPage} / {historyTotalPages}</span>
                        <button
                          disabled={historyPage === historyTotalPages}
                          onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}
                          className="px-3 py-1.5 text-xs font-bold bg-surfaceLight border border-border rounded-lg disabled:opacity-30 transition-all hover:bg-surfaceLight/80"
                        >
                          ถัดไป
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========== TAB: ORDERS ========== */}
              {activeTab === 'orders' && (
                <div className="space-y-4">
                  <h2 className="text-base font-bold text-textPrimary">รายการออเดอร์ทั้งหมด ({orders.length})</h2>
                  {manualDeliveryCount > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-sm text-orange-400 font-medium">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      มี {manualDeliveryCount} ออเดอร์รอส่งสินค้าด้วยตัวเอง (สต็อกหมดกะทันหัน หรือ เป็นสินค้า Manual)
                    </div>
                  )}

                  {/* Order Filter Tabs */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                      {[
                        { id: 'all', label: 'ทั้งหมด' },
                        { id: 'needs_manual_delivery', label: 'รอดำเนินการ (Manual)' },
                        { id: 'completed', label: 'สำเร็จ' },
                        { id: 'cancelled', label: 'ยกเลิก' },
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setOrderFilter(f.id)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                            orderFilter === f.id
                              ? 'bg-primary text-white shadow-md shadow-primary/20'
                              : 'bg-surfaceLight text-textMuted hover:text-textPrimary hover:bg-surfaceLight/80'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    
                    {/* Order Search */}
                    <div className="w-full sm:w-72">
                      <input
                        type="text"
                        placeholder="🔍 ค้นหาเลขออเดอร์ (เช่น SA-XXXX)"
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        className="w-full px-4 py-2 bg-surfaceLight/40 border border-border/60 rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60 transition-all placeholder:text-textMuted/60"
                      />
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border/50 bg-surfaceLight/30">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">ออเดอร์</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider hidden md:table-cell">ลูกค้า</th>
                          <th className="text-right px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">ยอด</th>
                          <th className="text-center px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">สถานะ</th>
                          <th className="text-right px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">ดูรายละเอียด</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {(() => {
                          const filteredOrders = orders
                            .filter(o => orderFilter === 'all' || o.status === orderFilter)
                            .filter(o => o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()))
                          
                          const totalPages = Math.ceil(filteredOrders.length / orderPerPage)
                          const startIndex = (orderPage - 1) * orderPerPage
                          const paginatedOrders = filteredOrders.slice(startIndex, startIndex + orderPerPage)

                          if (paginatedOrders.length === 0) {
                            return <tr><td colSpan={5} className="px-4 py-12 text-center text-textMuted text-sm">ไม่พบออเดอร์ในสถานะที่เลือก หรือค้นหาไม่พบ</td></tr>
                          }

                          return paginatedOrders.map(o => {
                            const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.pending
                            return (
                              <tr key={o.id} className={`hover:bg-surfaceLight/20 transition-colors ${o.status === 'needs_manual_delivery' ? 'bg-orange-500/5' : ''}`}>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-xs text-textPrimary">{o.orderNumber}</div>
                                  <div className="text-[10px] text-textMuted">{formatDateWithTime(o.createdAt)}</div>
                                </td>
                                <td className="px-4 py-3 hidden md:table-cell">
                                  <div className="text-xs text-textPrimary">{o.customerName}</div>
                                  <div className="text-[10px] text-textMuted">{o.customerEmail}</div>
                                </td>
                                <td className="px-4 py-3 text-right text-xs font-semibold text-textPrimary">{formatPrice(o.total)}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.color}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button onClick={() => openOrderEdit(o)} className="p-1.5 text-textMuted hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="แก้ไขออเดอร์">
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })
                        })()}
                      </tbody>
                    </table>

                    {/* Pagination UI */}
                    {(() => {
                      const filteredLength = orders
                        .filter(o => orderFilter === 'all' || o.status === orderFilter)
                        .filter(o => o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()))
                        .length
                      const totalPages = Math.ceil(filteredLength / orderPerPage)

                      if (filteredLength === 0) return null

                      return (
                        <div className="p-4 border-t border-border/50 bg-surfaceLight/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-textMuted">
                          <div className="flex items-center gap-2">
                            <span>แสดง</span>
                            <select
                              value={orderPerPage}
                              onChange={(e) => setOrderPerPage(Number(e.target.value))}
                              className="bg-surfaceLight border border-border rounded px-2 py-1 focus:outline-none focus:border-primary/50 text-textPrimary"
                            >
                              <option value={10}>10</option>
                              <option value={20}>20</option>
                              <option value={50}>50</option>
                            </select>
                            <span>รายการ</span>
                          </div>

                          <div className="flex items-center gap-4">
                            <span>Page {orderPage} of {totalPages || 1}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setOrderPage(p => Math.max(1, p - 1))}
                                disabled={orderPage === 1}
                                className="px-3 py-1.5 rounded bg-surfaceLight hover:bg-surfaceLight/80 border border-border disabled:opacity-50 disabled:cursor-not-allowed transition-all text-textPrimary"
                              >
                                Prev
                              </button>
                              <button
                                onClick={() => setOrderPage(p => Math.min(totalPages, p + 1))}
                                disabled={orderPage === totalPages || totalPages === 0}
                                className="px-3 py-1.5 rounded bg-surfaceLight hover:bg-surfaceLight/80 border border-border disabled:opacity-50 disabled:cursor-not-allowed transition-all text-textPrimary"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* ========== TAB: CATEGORIES ========== */}
              {activeTab === 'categories' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-textPrimary">จัดการหมวดหมู่ ({categories.length})</h2>
                    <button onClick={openAddCat} className="flex items-center gap-1.5 px-4 py-2 bg-primary-gradient rounded-xl text-white text-sm font-bold btn-glow">
                      <Plus className="w-4 h-4" /><span>เพิ่มหมวดหมู่</span>
                    </button>
                  </div>
                  <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border/50 bg-surfaceLight/30">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">หมวดหมู่</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider hidden md:table-cell">Slug</th>
                          <th className="text-center px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">สินค้า</th>
                          <th className="text-center px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">สถานะ</th>
                          <th className="text-right px-4 py-3 text-xs font-bold text-textMuted uppercase tracking-wider">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {categories.sort((a, b) => a.sortOrder - b.sortOrder).map(cat => {
                          const prodCount = products.filter(p => p.categoryId === cat.id || p.category === cat.slug).length
                          return (
                            <tr key={cat.id} className="hover:bg-surfaceLight/20 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="text-lg">{cat.icon}</span>
                                  <div>
                                    <div className="text-xs font-bold text-textPrimary">{cat.name}</div>
                                    <div className="w-16 h-1.5 rounded-full mt-1" style={{ background: cat.color }} />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <code className="text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-md">{cat.slug}</code>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-xs font-bold text-textPrimary">{prodCount}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${cat.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                  {cat.isActive ? 'เปิดใช้' : 'ปิดใช้'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button onClick={() => openEditCat(cat)} className="p-1.5 text-textMuted hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDeleteCat(cat.id)} className="p-1.5 text-textMuted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl text-xs text-textMuted">
                    <p className="font-bold text-primary mb-1">💡 วิธีใช้งาน</p>
                    <p>หมวดหมู่ที่สร้างที่นี่จะแสดงใน Dropdown เมื่อเพิ่ม/แก้ไขสินค้า และแสดงเป็นตัวกรองบนหน้าร้านค้า (Filter bar)</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
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
                  <option value="">— ไม่ระบุ —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1.5">รูปแบบการจัดส่ง (Delivery Type)</label>
                <select
                  value={(productForm as any).deliveryType || 'auto'}
                  onChange={e => setProductForm(f => ({ ...f, deliveryType: e.target.value }))}
                  className="w-full px-3 py-2 bg-surfaceLight/40 border border-border rounded-xl text-sm text-textPrimary focus:outline-none focus:border-primary/60">
                  <option value="auto">⚡ จัดส่งอัตโนมัติ 24/7 (เช็คคลัง DigitalStock)</option>
                  <option value="manual">🧑‍💻 แอดมินจัดส่งเอง (ไม่เช็คคลัง, โอนแล้วรอดำเนินการ)</option>
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
                💡 ไม่ต้องกรอกจำนวนสต็อก — ระบบคำนวณจาก DigitalStock อัตโนมัติ
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
                          {item.licenseKey && <p className="text-[10px] text-textMuted">🔑 {item.licenseKey}</p>}
                          {item.email && <p className="text-[10px] text-textMuted">📧 {item.email} | 🔒 {item.password}</p>}
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
                  <p className="text-[10px] text-textMuted mb-2">กรอกข้อมูลสินค้าหรือคีย์ที่ต้องการส่งให้ลูกค้าผ่านระบบตรงนี้ เมื่อเปลี่ยนสถานะเป็น "สำเร็จ" ข้อมูลนี้จะไปแสดงในหน้าตรวจออเดอร์ของลูกค้า</p>
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
