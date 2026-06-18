"use client"

import { useEffect, useState } from "react"
import { useUser, UserButton } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import {
  Chart,
  ArcElement,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from "chart.js"
import { Doughnut, Line, Bar } from "react-chartjs-2"
import "./dashboard.css"

Chart.register(ArcElement, LineElement, BarElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

// ── Types ──────────────────────────────────────────────────────────────────
interface KpiData {
  inventoryValue: number
  totalOrders: number
  totalShipments: number
  onTimeDelivery: number
  activeProducts: number
}
interface Branch {
  name: string
  city: string
  inventoryValue: number
  utilizationPct: number
  otdPct: number
}
interface Category {
  category: string
  value: number
}
interface TrendPoint {
  day: string
  count: number
}
interface AlertItem {
  agentName: string
  action: string
  summary: string
  status: string
  createdAt: string
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatCr(val: number) {
  if (!val) return "₹0 Cr"
  return `₹${(val / 1e7).toFixed(1)} Cr`
}
function formatNum(val: number) {
  return val.toLocaleString("en-IN")
}
function fmtDay(d: string) {
  const dt = new Date(d + "T00:00:00")
  return dt.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
}
function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`
  return `${Math.floor(hrs / 24)} days ago`
}
function weekRange() {
  const now = new Date()
  const end = now.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })
  const start = new Date(now)
  start.setDate(start.getDate() - 7)
  return `${start.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} – ${end}`
}

// ── Static Config ──────────────────────────────────────────────────────────
const BRANCH_CFG: Record<string, { img: string; dot: string; bg: string; state: string }> = {
  Hyderabad: { img: "https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781620100/HydImage_amqqrf.png", dot: "#16a34a", bg: "#FDF6E8", state: "Telangana" },
  Bangalore: { img: "https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781620138/bangaloreImage_bta6fn.png", dot: "#16a34a", bg: "#F5EFE2", state: "Karnataka" },
  Chennai:   { img: "https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781620119/chennaiImage_mpzhdu.png", dot: "#EC4899", bg: "#FFF8F0", state: "Tamil Nadu" },
  Mumbai:    { img: "https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781620117/mumbaiImage_f7mzxa.png", dot: "#2563EB", bg: "#FBF5E8", state: "Maharashtra" },
  Pune:      { img: "https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781620117/puneImage_gozf1r.png", dot: "#FF4FA3", bg: "#F5F0EA", state: "Maharashtra" },
}

const CAT_COLOR: Record<string, string> = {
  "Laptops":              "#3B82F6",
  "Mobiles & Tablets":    "#FF6B35",
  "TVs & Displays":       "#7C3AED",
  "Gaming Consoles":      "#EC4899",
  "Networking Equipment": "#18D8C3",
  "Accessories":          "#F59E0B",
}
const CAT_ICON: Record<string, string> = {
  "Laptops":              "laptop",
  "Mobiles & Tablets":    "mobile",
  "TVs & Displays":       "tv",
  "Gaming Consoles":      "gamepad",
  "Networking Equipment": "network",
  "Accessories":          "headphones",
}

const AGENTS = [
  { num: 1, color: "#7C3AED", name: "Inventory Intelligence Agent", sub: "Monitoring & Recommendations" },
  { num: 2, color: "#FF6B35", name: "Demand Forecast Agent", sub: "Predicting Demand Trends" },
  { num: 3, color: "#EC4899", name: "Procurement Agent", sub: "PO Creation & Optimization" },
  { num: 4, color: "#2563EB", name: "Supplier Risk Agent", sub: "Risk Scoring & Alternatives" },
  { num: 5, color: "#18D8C3", name: "Warehouse Transfer Agent", sub: "Balancing & Stock Transfer" },
  { num: 6, color: "#A855F7", name: "Logistics & Dispatch Agent", sub: "Route & Delivery Optimization" },
  { num: 7, color: "#7C3AED", name: "Order Fulfillment Agent", sub: "Tracking & Escalation" },
  { num: 8, color: "#FF4FA3", name: "Finance & Profitability Agent", sub: "Revenue & Cost Insights" },
]

// ── Icon Components ────────────────────────────────────────────────────────
function CatIcon({ type, color }: { type: string; color: string }) {
  const s = color
  if (type === "laptop") return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/></svg>
  if (type === "tv") return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
  if (type === "mobile") return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
  if (type === "gamepad") return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
  if (type === "network") return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
}

function alertIconType(a: AlertItem): "warn" | "info" | "truck" | "ok" {
  const txt = (a.action + " " + a.summary).toLowerCase()
  if (a.status === "error" || txt.includes("risk") || txt.includes("low") || txt.includes("delay") || txt.includes("overdue") || txt.includes("fail")) return "warn"
  if (txt.includes("demand") || txt.includes("forecast") || txt.includes("order")) return "info"
  if (txt.includes("shipment") || txt.includes("delivery") || txt.includes("dispatch") || txt.includes("logistics")) return "truck"
  return "ok"
}

function AlertIcon({ type }: { type: "warn" | "info" | "truck" | "ok" }) {
  if (type === "warn") return (
    <div className="al-ico" style={{ background: "rgba(245,158,11,0.1)" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    </div>
  )
  if (type === "info") return (
    <div className="al-ico" style={{ background: "rgba(37,99,235,0.1)" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    </div>
  )
  if (type === "truck") return (
    <div className="al-ico" style={{ background: "rgba(168,85,247,0.1)" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A855F7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/></svg>
    </div>
  )
  return (
    <div className="al-ico" style={{ background: "rgba(22,163,74,0.1)" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [ordersTrend, setOrdersTrend] = useState<TrendPoint[]>([])
  const [shipmentsTrend, setShipmentsTrend] = useState<TrendPoint[]>([])
  const [alertData, setAlertData] = useState<{ count: number; alerts: AlertItem[] }>({ count: 0, alerts: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && !user) router.push("/")
  }, [isLoaded, user, router])

  useEffect(() => {
    document.body.style.overflow = "hidden"
    document.body.style.background = "#F4F3FA"
    return () => {
      document.body.style.overflow = ""
      document.body.style.background = ""
    }
  }, [])

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/kpis").then((r) => r.json()),
      fetch("/api/dashboard/branches").then((r) => r.json()),
      fetch("/api/dashboard/inventory-categories").then((r) => r.json()),
      fetch("/api/dashboard/orders-trend").then((r) => r.json()),
      fetch("/api/dashboard/shipments-trend").then((r) => r.json()),
      fetch("/api/dashboard/alerts").then((r) => r.json()),
    ])
      .then(([k, b, c, o, s, a]) => {
        if (!k?.error) setKpis(k)
        if (Array.isArray(b)) setBranches(b)
        if (Array.isArray(c)) setCategories(c)
        if (Array.isArray(o)) setOrdersTrend(o)
        if (Array.isArray(s)) setShipmentsTrend(s)
        if (a && !a.error) setAlertData(a)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const username = user?.username || user?.firstName || "CEO"
  const totalCatValue = categories.reduce((s, c) => s + c.value, 0)

  const donutData = {
    labels: categories.map((c) => c.category),
    datasets: [{
      data: categories.map((c) => totalCatValue > 0 ? +((c.value / totalCatValue) * 100).toFixed(1) : 0),
      backgroundColor: categories.map((c) => CAT_COLOR[c.category] ?? "#9CA3AF"),
      borderWidth: 2,
      borderColor: "#fff",
      hoverOffset: 5,
    }],
  }

  const ordValues = ordersTrend.map((p) => p.count)
  const totalOrdTrend = ordValues.reduce((s, v) => s + v, 0)
  const shipValues = shipmentsTrend.map((p) => p.count)
  const totalShipTrend = shipValues.reduce((s, v) => s + v, 0)

  return (
    <div className="nexora-dash">
      <div className="nd-layout">

        {/* ═══════ SIDEBAR ═══════ */}
        <aside className="nd-sb">
          <div className="sb-logo">
            <svg className="lm" viewBox="0 0 34 34" fill="none">
              <defs>
                <linearGradient id="nsg1" x1="0" y1="0" x2="34" y2="34"><stop offset="0%" stopColor="#FF8C00"/><stop offset="100%" stopColor="#FFD700"/></linearGradient>
                <linearGradient id="nsg2" x1="3" y1="12" x2="22" y2="31"><stop offset="0%" stopColor="#FF4FA3"/><stop offset="50%" stopColor="#3EE8C2"/><stop offset="100%" stopColor="#7C3AED"/></linearGradient>
              </defs>
              <path d="M17 1.5L32.5 13V32.5H1.5V13Z" fill="white" stroke="url(#nsg1)" strokeWidth="2" strokeLinejoin="round"/>
              <rect x="3" y="13" width="7" height="18" rx="1.2" fill="url(#nsg2)"/>
              <polygon points="10,13 15,13 21,31 16,31" fill="url(#nsg2)"/>
              <rect x="13" y="13" width="7" height="18" rx="1.2" fill="url(#nsg2)"/>
              <rect x="22" y="13" width="1.5" height="18" rx=".8" fill="#ddd"/>
              <rect x="30" y="13" width="1.5" height="18" rx=".8" fill="#ddd"/>
              <rect x="22" y="13" width="9.5" height="6" rx="1.5" fill="#FF6B35" opacity=".9"/>
              <rect x="22" y="21" width="9.5" height="5" rx="1.5" fill="#3EE8C2" opacity=".9"/>
            </svg>
            <div><div className="ln">NEXORA</div><div className="ls">Warehouse</div></div>
          </div>

          <div className="sb-nav">
            {[
              { icon: "dashboard", label: "Dashboard", active: true },
              { icon: "branches", label: "Branches / Warehouses" },
              { icon: "inventory", label: "Inventory" },
              { icon: "orders", label: "Orders" },
              { icon: "shipments", label: "Shipments" },
              { icon: "products", label: "Products", href: "/products" },
              { icon: "suppliers", label: "Suppliers" },
              { icon: "analytics", label: "Analytics" },
              { icon: "alerts", label: "Alerts & Notifications", badge: alertData.count > 0 ? String(alertData.count) : undefined },
              { icon: "reports", label: "Reports" },
              { icon: "settings", label: "Settings" },
            ].map((item) => (
              <a
                key={item.label}
                className={`nav-a${item.active ? " on" : ""}`}
                onClick={() => item.href && router.push(item.href)}
                style={item.href ? { cursor: "pointer" } : undefined}
              >
                <SidebarIcon name={item.icon}/>
                {item.label}
                {item.badge && <span className="nb">{item.badge}</span>}
              </a>
            ))}
          </div>

          <div className="sb-ai">
            <div className="ai-av">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="8" width="18" height="12" rx="2"/>
                <path d="M12 2v4"/><circle cx="12" cy="6" r="2" fill="rgba(255,255,255,0.9)" stroke="none"/>
                <circle cx="8" cy="14" r="1.5" fill="rgba(255,255,255,0.85)" stroke="none"/>
                <circle cx="16" cy="14" r="1.5" fill="rgba(255,255,255,0.85)" stroke="none"/>
                <path d="M8 18h8" strokeWidth="1.8"/>
              </svg>
            </div>
            <div className="ai-name">AI Assistant</div>
            <div className="ai-dot">Online</div>
            <div className="ai-copy">Need insights or help? Ask me anything about your warehouse operations.</div>
            <button className="ai-btn">Chat Now</button>
          </div>
        </aside>

        {/* ═══════ MAIN ═══════ */}
        <div className="nd-main">

          {/* TOPBAR */}
          <div className="topbar">
            <div className="tb-row1">
              <div className="tb-greet">
                <h1>Welcome back, {username}! 👋</h1>
                <p>Here&apos;s what&apos;s happening across your warehouse network today.</p>
              </div>
              <div className="tb-controls">
                <div className="tb-srch">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input type="text" placeholder="Search anything..." readOnly/>
                  <span className="kb-hint">⌘ K</span>
                </div>
                <div className="tb-btn">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  {alertData.count > 0 && <div className="n-badge">{alertData.count}</div>}
                </div>
                <div className="tb-btn">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div className="ceo-wrap">
                  <div className="ceo-av">{username.charAt(0).toUpperCase()}</div>
                  <div><div className="ceo-n">{username}</div><div className="ceo-r">Nexora Corp</div></div>
                  <UserButton />
                </div>
              </div>
            </div>
            <div className="tb-row2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {weekRange()}
            </div>
          </div>

          {/* CONTENT */}
          <div className="content">

            {/* ── KPI STRIP ── */}
            <div className="kpi-strip">
              <div className="kc">
                <div className="kc-ico" style={{ background: "rgba(59,130,246,0.1)" }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                </div>
                <div>
                  <div className="kc-l">Total Inventory Value</div>
                  <div className="kc-v">{loading ? <Skel w={80} h={24}/> : formatCr(kpis?.inventoryValue ?? 0)}</div>
                  <div className="kc-ch">Live <em>all warehouses</em></div>
                </div>
              </div>
              <div className="kc">
                {!loading && (kpis?.totalOrders ?? 0) > 0 && <div className="kc-badge">{(kpis?.totalOrders ?? 0) > 99 ? "99+" : kpis?.totalOrders}</div>}
                <div className="kc-ico" style={{ background: "rgba(255,107,53,0.1)" }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                </div>
                <div>
                  <div className="kc-l">Total Orders (7 days)</div>
                  <div className="kc-v">{loading ? <Skel w={60} h={24}/> : formatNum(kpis?.totalOrders ?? 0)}</div>
                  <div className="kc-ch">Live <em>this week</em></div>
                </div>
              </div>
              <div className="kc">
                <div className="kc-ico" style={{ background: "rgba(37,99,235,0.1)" }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                </div>
                <div>
                  <div className="kc-l">Total Shipments</div>
                  <div className="kc-v">{loading ? <Skel w={60} h={24}/> : formatNum(kpis?.totalShipments ?? 0)}</div>
                  <div className="kc-ch">Live <em>this week</em></div>
                </div>
              </div>
              <div className="kc">
                <div className="kc-ico" style={{ background: "rgba(22,163,74,0.1)" }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div>
                  <div className="kc-l">On-Time Delivery</div>
                  <div className="kc-v">{loading ? <Skel w={60} h={24}/> : `${kpis?.onTimeDelivery ?? 0}%`}</div>
                  <div className="kc-ch">Live <em>all branches</em></div>
                </div>
              </div>
              <div className="kc">
                <div className="kc-ico" style={{ background: "rgba(236,72,153,0.1)" }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
                </div>
                <div>
                  <div className="kc-l">Active Products</div>
                  <div className="kc-v">{loading ? <Skel w={60} h={24}/> : formatNum(kpis?.activeProducts ?? 0)}</div>
                  <div className="kc-ch">Live <em>in catalog</em></div>
                </div>
              </div>
            </div>

            {/* ── MIDDLE ROW ── */}
            <div className="mid">

              {/* BRANCHES */}
              <div className="mid-l card cp">
                <div className="ch">
                  <div className="ct">Our Branches / Warehouses</div>
                  <button className="clink">View All Branches →</button>
                </div>
                <div className="br-inner">
                  <div className="india-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781620104/IndianMAp_nawnxy.png" alt="India Map" style={{ width: 200, height: 300, display: "block", objectFit: "cover", filter: "drop-shadow(0 6px 22px rgba(124,58,237,0.13))" }}/>
                  </div>
                  <div className="br-list">
                    {loading
                      ? [0,1,2,3,4].map(i => (
                          <div key={i} className="bri" style={{padding:"10px 0"}}>
                            <Skel w={52} h={46} r={8}/><Skel w={80} h={32} r={6} ml={9}/><Skel w={60} h={32} r={6} ml={9}/>
                          </div>
                        ))
                      : branches.map((b) => {
                          const cfg = BRANCH_CFG[b.city] ?? { img:"", dot:"#9CA3AF", bg:"#F3F4F6", state:"" }
                          const barColor = b.utilizationPct >= 80 ? "#16a34a" : b.utilizationPct >= 60 ? "#d97706" : "#ef4444"
                          const isOp = b.otdPct >= 90
                          return (
                            <div key={b.city} className={`bri${b.city === "Bangalore" ? " bri-blr" : ""}`} style={{padding:"10px 0", cursor: b.city === "Bangalore" ? "pointer" : "default"}} onClick={b.city === "Bangalore" ? () => router.push("/branch/bangalore") : undefined}>
                              <div className="br-thumb" style={{ background: cfg.bg }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={cfg.img} style={{width:"100%",height:"100%",objectFit:"contain",objectPosition:"center",display:"block"}} alt={b.city}/>
                              </div>
                              <div className="br-city-wrap">
                                <div className="br-city">{b.city}<div className="dot" style={{background:cfg.dot}}/></div>
                                <div className="br-state">{cfg.state}</div>
                              </div>
                              <div className="br-inv">
                                <div className="lbl">Inventory Value</div>
                                <div className="val">{formatCr(b.inventoryValue)}</div>
                              </div>
                              <div className="br-util">
                                <div className="lbl">Utilization</div>
                                <div className="bar-t"><div className="bar-f" style={{width:`${b.utilizationPct}%`,background:barColor}}/></div>
                                <div className="pct">{b.utilizationPct}%</div>
                              </div>
                              <div className="br-status">
                                {isOp ? <div className="st-op">Operational</div> : <div className="st-at">Attention</div>}
                                <div className="br-ot">On-Time Delivery</div>
                                <div className="br-otv">{b.otdPct}%</div>
                              </div>
                            </div>
                          )
                        })
                    }
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="mid-r">

                {/* DONUT */}
                <div className="card cp" style={{flex:"1.1"}}>
                  <div className="ch">
                    <div className="ct">Inventory by Product Category</div>
                    <button className="clink">View Report</button>
                  </div>
                  <div className="donut-row">
                    <div className="donut-canvas" style={{width:118,height:118}}>
                      {loading
                        ? <Skel w={118} h={118} r={59}/>
                        : categories.length > 0 && (
                          <Doughnut
                            data={donutData}
                            options={{ cutout:"68%", responsive:false, plugins:{ legend:{display:false}, tooltip:{ backgroundColor:"#111827", cornerRadius:8, padding:10, callbacks:{ label:(c)=>` ${c.label}: ${c.parsed.toFixed(1)}%` } } } }}
                            width={118} height={118}
                          />
                        )
                      }
                      <div className="donut-center">
                        <div className="dc-v">{formatCr(totalCatValue)}</div>
                        <div className="dc-l">Total Value</div>
                      </div>
                    </div>
                    <div className="leg">
                      {loading
                        ? [0,1,2,3,4].map(i => <Skel key={i} w="100%" h={16} r={4} mb={6}/>)
                        : categories.map((c) => (
                            <div key={c.category} className="leg-r">
                              <div className="leg-lft"><div className="ldot" style={{background:CAT_COLOR[c.category]??"#9CA3AF"}}/>{c.category}</div>
                              <div className="leg-rgt">
                                <div className="leg-v">{formatCr(c.value)}</div>
                                <div className="leg-p">{totalCatValue > 0 ? ((c.value/totalCatValue)*100).toFixed(1) : 0}%</div>
                              </div>
                            </div>
                          ))
                      }
                    </div>
                  </div>
                </div>

                {/* ALERTS */}
                <div className="card cp">
                  <div className="ch">
                    <div className="ct">Recent Alerts</div>
                    <button className="clink">View All</button>
                  </div>
                  {loading
                    ? [0,1,2,3].map(i => (
                        <div key={i} className="al-i">
                          <Skel w={28} h={28} r={8}/><Skel w="80%" h={28} r={4} ml={9}/>
                        </div>
                      ))
                    : alertData.alerts.length > 0
                      ? alertData.alerts.map((a, i) => (
                          <div key={i} className="al-i">
                            <AlertIcon type={alertIconType(a)}/>
                            <div className="al-t">{a.summary.length > 80 ? a.summary.slice(0,80)+"…" : a.summary}</div>
                            <div className="al-time">{timeAgo(a.createdAt)}</div>
                          </div>
                        ))
                      : <div style={{fontSize:11,color:"var(--muted)",padding:"8px 0"}}>No recent alerts — all systems nominal.</div>
                  }
                </div>

              </div>
            </div>

            {/* ── BOTTOM ROW ── */}
            <div className="bot">

              {/* ORDERS CHART */}
              <div className="bot-c card cp" style={{height:300}}>
                <div className="ct-hdr">
                  <div className="ct">Orders Overview</div>
                  <div className="period-btn">This Week <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg></div>
                </div>
                <div className="chart-top">
                  <div><div className="ch-num">{loading ? "—" : formatNum(totalOrdTrend)}</div><div className="ch-sub">Total Orders</div></div>
                </div>
                {!loading && ordersTrend.length > 0 && (
                  <Line
                    data={{ labels: ordersTrend.map(p=>fmtDay(p.day)), datasets:[{ data:ordValues, fill:true, backgroundColor:"rgba(124,58,237,0.10)", borderColor:"#7C3AED", borderWidth:2.5, pointRadius:4, pointBackgroundColor:"#7C3AED", pointBorderColor:"#fff", pointBorderWidth:2, pointHoverRadius:6, tension:0.42 }] }}
                    options={{ responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:{backgroundColor:"#111827",cornerRadius:8,padding:10} }, scales:{ x:{grid:{display:false},ticks:{font:{size:9},color:"#9CA3AF"}}, y:{grid:{color:"rgba(0,0,0,0.04)"},ticks:{font:{size:9},color:"#9CA3AF"},border:{display:false}} } }}
                    height={100}
                  />
                )}
              </div>

              {/* SHIPMENTS CHART */}
              <div className="bot-c card cp" style={{height:300}}>
                <div className="ct-hdr">
                  <div className="ct">Shipments Overview</div>
                  <div className="period-btn">This Week <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg></div>
                </div>
                <div className="chart-top">
                  <div><div className="ch-num">{loading ? "—" : formatNum(totalShipTrend)}</div><div className="ch-sub">Total Shipments</div></div>
                </div>
                {!loading && shipmentsTrend.length > 0 && (
                  <Bar
                    data={{ labels: shipmentsTrend.map(p=>fmtDay(p.day)), datasets:[{ data:shipValues, backgroundColor:"rgba(37,99,235,0.7)", hoverBackgroundColor:"#2563EB", borderRadius:5 }] }}
                    options={{ responsive:true, maintainAspectRatio:true, plugins:{ legend:{display:false}, tooltip:{backgroundColor:"#111827",cornerRadius:8,padding:10} }, scales:{ x:{grid:{display:false},ticks:{font:{size:9},color:"#9CA3AF"}}, y:{grid:{color:"rgba(0,0,0,0.04)"},ticks:{font:{size:9},color:"#9CA3AF"},border:{display:false}} } }}
                    height={100}
                  />
                )}
              </div>

              {/* WORKFLOW */}
              <div className="bot-wf card cp wf-wrap">
                <div className="wf-head">
                  <div><div className="wf-t">Autonomous Workflow</div><div className="wf-sub">Our 8 AI Agents</div></div>
                  <button className="wf-btn">View Workflow</button>
                </div>
                <div className="wf-grid">
                  {AGENTS.map((a) => (
                    <div key={a.num} className="wf-a">
                      <div className="wf-num" style={{background:a.color}}>{a.num}</div>
                      <div className="wf-n">{a.name}</div>
                      <div className="wf-s">{a.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── TOP PRODUCTS ── */}
            <div style={{fontSize:13,fontWeight:800,color:"var(--dark)",marginBottom:9}}>Top Products by Value</div>
            <div className="prod-row">
              {loading
                ? [0,1,2,3,4].map(i => <div key={i} className="prod-c"><Skel w={42} h={42} r={9}/><Skel w="60%" h={36} r={6} ml={9}/></div>)
                : categories.map((c) => {
                    const color = CAT_COLOR[c.category] ?? "#9CA3AF"
                    const bg = color === "#D1D5DB" ? "rgba(107,114,128,0.08)" : color + "14"
                    return (
                      <div key={c.category} className="prod-c">
                        <div className="prod-ico" style={{background:bg}}><CatIcon type={CAT_ICON[c.category]??"headphones"} color={color}/></div>
                        <div><div className="prod-n">{c.category}</div><div className="prod-v">{formatCr(c.value)}</div></div>
                      </div>
                    )
                  })
              }
            </div>

          </div>{/* /content */}
        </div>{/* /nd-main */}
      </div>{/* /nd-layout */}
    </div>
  )
}

// ── Skeleton helper ────────────────────────────────────────────────────────
function Skel({ w, h, r = 6, ml, mb }: { w: number | string; h: number; r?: number; ml?: number; mb?: number }) {
  return (
    <span className="skel" style={{ display:"inline-block", width:w, height:h, borderRadius:r, marginLeft:ml, marginBottom:mb }}/>
  )
}

// ── Sidebar icon map ───────────────────────────────────────────────────────
function SidebarIcon({ name }: { name: string }) {
  const p: Record<string, React.ReactNode> = {
    dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
    branches:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    inventory: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
    orders:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>,
    shipments: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    products:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    suppliers: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    analytics: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    alerts:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    reports:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    settings:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  }
  return p[name] ?? null
}
