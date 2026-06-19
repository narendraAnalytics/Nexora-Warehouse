"use client"

import { useEffect, useState } from "react"
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
import "./blr-dash.css"

Chart.register(ArcElement, LineElement, BarElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

// ── Types ─────────────────────────────────────────────────────────────────────
interface KpiData {
  inventoryValue: number
  totalOrders: number
  totalShipments: number
  onTimeDelivery: number
  activeSKUs: number
  pendingPOs: number | null
  openPRs: number | null
}
interface TrendPoint { day: string; count: number }
interface CatPoint   { category: string; value: number }
interface AlertItem  { agentName: string; action: string; summary: string; status: string; createdAt: string }
interface PRStatus   { id: string; pr_number: string; status: string; total_estimated_value: number; escalation_deadline: string; created_at: string }

// ── Static (design elements, not data) ───────────────────────────────────────
const CAT_COLORS = ["#EA580C", "#F59E0B", "#0D9488", "#16A34A", "#D97706", "#DC2626"]

const AGENTS = [
  { name: "Inventory Intelligence", color: "#EA580C" },
  { name: "Demand Forecast",        color: "#F59E0B" },
  { name: "Procurement Agent",      color: "#0D9488" },
  { name: "Supplier Risk Agent",    color: "#16A34A" },
  { name: "Warehouse Transfer",     color: "#D97706" },
  { name: "Logistics & Dispatch",   color: "#EA580C" },
  { name: "Order Fulfillment",      color: "#0D9488" },
  { name: "Finance & Profitability",color: "#16A34A" },
]

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtCr(v: number) { return `₹${(v / 1e7).toFixed(1)} Cr` }
function fmtNum(v: number) { return v.toLocaleString("en-IN") }

// ── Chart options ─────────────────────────────────────────────────────────────
const barOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (c: { raw: unknown }) => `${c.raw} orders` } },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10, family: "'Plus Jakarta Sans'" }, color: "#A16207" } },
    y: { grid: { color: "rgba(253,230,138,0.35)" }, ticks: { font: { size: 10 }, color: "#A16207" } },
  },
}

const lineOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { mode: "index" as const, intersect: false },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 9, family: "'Plus Jakarta Sans'" }, color: "#A16207", maxRotation: 0, maxTicksLimit: 8 } },
    y: { grid: { color: "rgba(253,230,138,0.3)" }, ticks: { font: { size: 9 }, color: "#A16207" } },
  },
}

const donutOpts = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "68%",
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (c: { label: string; raw: unknown }) => ` ${c.label}: ₹${c.raw}L` } },
  },
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function KpiIcon({ color }: { color: string }) {
  return (
    <div className="bd-kc-ico" style={{ background: `${color}18` }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
        <path d="M3 3h18M3 9h18M3 15h18M3 21h18"/>
      </svg>
    </div>
  )
}

function AlertIcon({ type }: { type: string }) {
  const color = type === "critical" ? "#DC2626" : type === "warning" ? "#D97706" : "#0D9488"
  return (
    <div className="bd-alert-ico">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round">
        {type === "info"
          ? <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
          : <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
        }
      </svg>
    </div>
  )
}

function Skel({ h, w }: { h?: number; w?: string }) {
  return <div className="bd-skel" style={{ height: h ?? 16, width: w ?? "100%" }} />
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BangaloreDashboard() {
  const router = useRouter()

  const [kpis,     setKpis]     = useState<KpiData | null>(null)
  const [ordTrend, setOrdTrend] = useState<TrendPoint[]>([])
  const [cats,     setCats]     = useState<CatPoint[]>([])
  const [alerts,   setAlerts]   = useState<AlertItem[]>([])
  const [prs,      setPRs]      = useState<PRStatus[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    Promise.all([
      fetch("/api/branch/bangalore/kpis").then(r => r.json()),
      fetch("/api/branch/bangalore/orders-trend").then(r => r.json()),
      fetch("/api/branch/bangalore/inventory-categories").then(r => r.json()),
      fetch("/api/dashboard/alerts").then(r => r.json()),
      fetch("/api/procurement/pr?warehouse_id=531e5c42-e4a1-4db0-a35c-a434f3b94344").then(r => r.json()).catch(() => []),
    ]).then(([k, o, c, a, p]) => {
      setKpis(k)
      setOrdTrend(Array.isArray(o) ? o : [])
      setCats(Array.isArray(c) ? c : [])
      setAlerts(Array.isArray(a) ? a : [])
      setPRs(Array.isArray(p) ? p.slice(0, 5) : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // ── Date/time ───────────────────────────────────────────────────────────────
  const now = new Date()
  const dateStr = now.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
  const dayStr  = now.toLocaleDateString("en-IN", { weekday: "long" })
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })

  // ── Derived chart data ───────────────────────────────────────────────────────
  const dayLabel = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
  }

  const ordBarChart = {
    labels: ordTrend.map(d => dayLabel(d.day)),
    datasets: [{
      label: "Orders",
      data: ordTrend.map(d => d.count),
      backgroundColor: "rgba(234,88,12,0.75)",
      borderRadius: 5,
    }],
  }

  const ordLineChart = {
    labels: ordTrend.map(d => dayLabel(d.day)),
    datasets: [{
      label: "Orders",
      data: ordTrend.map(d => d.count),
      borderColor: "#EA580C",
      backgroundColor: "rgba(234,88,12,0.08)",
      fill: true,
      tension: 0.42,
      pointRadius: 3,
      pointBackgroundColor: "#EA580C",
    }],
  }

  const catsChart = {
    labels: cats.map(c => c.category),
    datasets: [{
      data: cats.map(c => Math.round(c.value / 1e5) / 10),
      backgroundColor: cats.map((_, i) => CAT_COLORS[i % CAT_COLORS.length]),
      borderWidth: 0,
      hoverOffset: 6,
    }],
  }

  // ── KPI config (computed from real data) ────────────────────────────────────
  const KPI_CONFIG = [
    { label: "Inventory Value",   value: kpis ? fmtCr(kpis.inventoryValue)     : "--", sub: "Current stock value",        color: "#EA580C" },
    { label: "Orders (7d)",       value: kpis ? fmtNum(kpis.totalOrders)        : "--", sub: "Orders last 7 days",          color: "#F59E0B" },
    { label: "Shipments (7d)",    value: kpis ? fmtNum(kpis.totalShipments)     : "--", sub: "Deliveries last 7 days",      color: "#0D9488" },
    { label: "On-Time Delivery",  value: kpis ? `${kpis.onTimeDelivery}%`       : "--", sub: "All-time OTD rate",           color: "#16A34A" },
    { label: "Active SKUs",       value: kpis ? fmtNum(kpis.activeSKUs)         : "--", sub: "Distinct active products",    color: "#D97706" },
    { label: "Pending POs",       value: kpis?.pendingPOs != null ? String(kpis.pendingPOs) : "--", sub: "Coming in Phase 22", color: "#DC2626" },
    { label: "Open PRs",          value: kpis?.openPRs != null ? String(kpis.openPRs) : "--",   sub: "Pending approvals",  color: "#7C3AED" },
  ]

  // ── Alert severity ───────────────────────────────────────────────────────────
  function alertType(a: AlertItem) {
    const s = a.status?.toLowerCase() ?? ""
    if (s === "error" || s === "failed" || s === "critical") return "critical"
    if (s === "warning") return "warning"
    return "info"
  }

  return (
    <div className="blr-dash">

      {/* ── SIDEBAR ── */}
      <aside className="bd-sb">
        <div className="bd-sb-logo">
          <svg className="bd-sb-lm" viewBox="0 0 34 34" fill="none">
            <defs>
              <linearGradient id="bsg1" x1="0" y1="0" x2="34" y2="34"><stop offset="0%" stopColor="#FF8C00"/><stop offset="100%" stopColor="#FFD700"/></linearGradient>
              <linearGradient id="bsg2" x1="3" y1="12" x2="22" y2="31"><stop offset="0%" stopColor="#FF4FA3"/><stop offset="50%" stopColor="#3EE8C2"/><stop offset="100%" stopColor="#7C3AED"/></linearGradient>
            </defs>
            <path d="M17 1.5L32.5 13V32.5H1.5V13Z" fill="white" stroke="url(#bsg1)" strokeWidth="2" strokeLinejoin="round"/>
            <rect x="3" y="13" width="7" height="18" rx="1.2" fill="url(#bsg2)"/>
            <polygon points="10,13 15,13 21,31 16,31" fill="url(#bsg2)"/>
            <rect x="13" y="13" width="7" height="18" rx="1.2" fill="url(#bsg2)"/>
            <rect x="22" y="13" width="1.5" height="18" rx=".8" fill="#ddd"/>
            <rect x="30" y="13" width="1.5" height="18" rx=".8" fill="#ddd"/>
            <rect x="22" y="13" width="9.5" height="6" rx="1.5" fill="#FF6B35" opacity=".9"/>
            <rect x="22" y="21" width="9.5" height="5" rx="1.5" fill="#3EE8C2" opacity=".9"/>
          </svg>
          <div>
            <div className="bd-sb-ln">NEXORA</div>
            <div className="bd-sb-ls">Warehouse</div>
          </div>
        </div>

        <nav className="bd-sb-nav">
          {[
            { label: "Dashboard",              active: true,  badge: null, href: null,
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
            { label: "Inventory",              active: false, badge: null, href: "/branch/bangalore/inventory",
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
            { label: "Orders",                 active: false, badge: null, href: null,
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg> },
            { label: "Shipments",              active: false, badge: null, href: null,
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
            { label: "Products",               active: false, badge: null, href: null,
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> },
            { label: "Suppliers",              active: false, badge: null, href: null,
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
            { label: "Procurement",            active: false, badge: null, href: "/branch/bangalore/procurement/pr",
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg> },
            { label: "AI Agents",              active: false, badge: null, href: null,
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 2v4"/><circle cx="12" cy="6" r="2"/><circle cx="8" cy="14" r="1.5"/><circle cx="16" cy="14" r="1.5"/></svg> },
            { label: "Analytics",              active: false, badge: null, href: null,
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
            { label: "Alerts & Notifications", active: false, badge: alerts.length > 0 ? String(alerts.length) : null, href: null,
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
            { label: "Reports",                active: false, badge: null, href: null,
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
            { label: "Settings",               active: false, badge: null, href: null,
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
          ].map((item) => (
            <a
              key={item.label}
              className={`bd-nav-a${item.active ? " on" : ""}${item.href ? " clickable" : ""}`}
              onClick={() => item.href && router.push(item.href)}
              style={item.href ? { cursor: "pointer" } : undefined}
            >
              {item.icon}
              {item.label}
              {item.badge && <span className="bd-nb">{item.badge}</span>}
            </a>
          ))}
        </nav>

        <div className="bd-sb-ai">
          <div className="bd-ai-av">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="8" width="18" height="12" rx="2"/>
              <path d="M12 2v4"/>
              <circle cx="12" cy="6" r="2" fill="rgba(255,255,255,0.9)" stroke="none"/>
              <circle cx="8" cy="14" r="1.5" fill="rgba(255,255,255,0.85)" stroke="none"/>
              <circle cx="16" cy="14" r="1.5" fill="rgba(255,255,255,0.85)" stroke="none"/>
              <path d="M8 18h8" strokeWidth="1.8"/>
            </svg>
          </div>
          <div className="bd-ai-name">AI Assistant</div>
          <div className="bd-ai-dot">Online</div>
          <div className="bd-ai-copy">Need insights or help? Ask me anything about Bangalore branch operations.</div>
          <button className="bd-ai-btn">Chat Now</button>
        </div>
      </aside>

      {/* ── WRAPPER (header + body) ── */}
      <div className="bd-wrapper">

        {/* ── TOPBAR ── */}
        <div className="bd-topbar">
          <div className="bd-tb-left">
            <svg className="bd-tb-lm" viewBox="0 0 34 34" fill="none">
              <defs>
                <linearGradient id="tbg1" x1="0" y1="0" x2="34" y2="34"><stop offset="0%" stopColor="#FF8C00"/><stop offset="100%" stopColor="#FFD700"/></linearGradient>
                <linearGradient id="tbg2" x1="3" y1="12" x2="22" y2="31"><stop offset="0%" stopColor="#FF4FA3"/><stop offset="50%" stopColor="#3EE8C2"/><stop offset="100%" stopColor="#7C3AED"/></linearGradient>
              </defs>
              <path d="M17 1.5L32.5 13V32.5H1.5V13Z" fill="white" stroke="url(#tbg1)" strokeWidth="2" strokeLinejoin="round"/>
              <rect x="3" y="13" width="7" height="18" rx="1.2" fill="url(#tbg2)"/>
              <polygon points="10,13 15,13 21,31 16,31" fill="url(#tbg2)"/>
              <rect x="13" y="13" width="7" height="18" rx="1.2" fill="url(#tbg2)"/>
              <rect x="22" y="13" width="1.5" height="18" rx=".8" fill="#ddd"/>
              <rect x="30" y="13" width="1.5" height="18" rx=".8" fill="#ddd"/>
              <rect x="22" y="13" width="9.5" height="6" rx="1.5" fill="#FF6B35" opacity=".9"/>
              <rect x="22" y="21" width="9.5" height="5" rx="1.5" fill="#3EE8C2" opacity=".9"/>
            </svg>
            <div className="bd-tb-brand">
              <div className="bd-tb-ln">NEXORA</div>
              <div className="bd-tb-ls">WAREHOUSE</div>
            </div>
            <div className="bd-tb-sep" />
            <div className="bd-tb-title-block">
              <div className="bd-tb-title">Branch Dashboard</div>
              <div className="bd-tb-sub">Bangalore Central Warehouse (BLR-01)</div>
            </div>
          </div>

          <div className="bd-tb-center">
            <div className="bd-status-pill">
              <div className="bd-status-dot" />
              All Systems Operational
            </div>
          </div>

          <div className="bd-tb-right">
            <div className="bd-tb-datetime">
              <div className="bd-tb-date">{dateStr}</div>
              <div className="bd-tb-time">{dayStr}, {timeStr}</div>
            </div>
            <div className="bd-tb-bell">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {alerts.length > 0 && <div className="bd-tb-badge">{alerts.length}</div>}
            </div>
            <div className="bd-tb-user">
              <div className="bd-tb-avatar">R</div>
              <div>
                <div className="bd-tb-uname">Rajesh Kumar</div>
                <div className="bd-tb-urole">Branch Manager</div>
              </div>
            </div>
            <button className="bd-signout" onClick={() => router.push("/dashboard")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign Out
            </button>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="bd-body">

          {/* ── MAIN ── */}
          <div className="bd-main">

            {/* KPI Strip */}
            <div className="bd-kpi-strip">
              {KPI_CONFIG.map((k) => (
                <div key={k.label} className="bd-kc">
                  <KpiIcon color={k.color} />
                  <div className="bd-kc-l">{k.label}</div>
                  <div className="bd-kc-v">
                    {loading ? <Skel h={22} w="70%" /> : k.value}
                  </div>
                  <div className="bd-kc-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Row 1 — Orders Overview bar + Inventory by Category donut */}
            <div className="bd-row bd-row-2">
              <div className="bd-card">
                <div className="bd-ch">
                  <span className="bd-ct">Orders Overview</span>
                  <span className="bd-cb">Last 8 days</span>
                </div>
                <div className="bd-chart-h240">
                  {loading
                    ? <Skel h={240} />
                    : <Bar data={ordBarChart} options={barOpts as object} />
                  }
                </div>
              </div>

              <div className="bd-card">
                <div className="bd-ch">
                  <span className="bd-ct">Inventory by Category</span>
                  <span className="bd-cb">Value in ₹L</span>
                </div>
                {loading ? (
                  <Skel h={240} />
                ) : cats.length > 0 ? (
                  <div className="bd-donut-wrap">
                    <div className="bd-donut-chart">
                      <Doughnut data={catsChart} options={donutOpts} />
                    </div>
                    <div className="bd-legend">
                      {cats.map((c, i) => (
                        <div key={c.category} className="bd-leg-row">
                          <div className="bd-leg-l">
                            <div className="bd-leg-dot" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                            {c.category}
                          </div>
                          <div className="bd-leg-v">₹{(c.value / 1e5).toFixed(1)}L</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bd-empty">No inventory data</div>
                )}
              </div>
            </div>

            {/* Row 2 — Orders Trend + Supply Chain + Agent Alerts */}
            <div className="bd-row bd-row-3b">
              <div className="bd-card">
                <div className="bd-ch">
                  <span className="bd-ct">Orders Trend</span>
                  <span className="bd-cb">Last 8 days</span>
                </div>
                <div className="bd-chart-h200">
                  {loading
                    ? <Skel h={200} />
                    : <Line data={ordLineChart} options={lineOpts as object} />
                  }
                </div>
              </div>

              <div className="bd-card">
                <div className="bd-ch">
                  <span className="bd-ct">Supply Chain</span>
                </div>
                <div className="bd-phase22">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13"/>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/>
                    <circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                  <div className="bd-phase22-title">Supplier data coming in Phase 22</div>
                  <div className="bd-phase22-sub">Real-time supplier tracking, PO status, and delivery ETAs will be available in the next release.</div>
                </div>
              </div>

              <div className="bd-card">
                <div className="bd-ch">
                  <span className="bd-ct">Agent Alerts</span>
                  {!loading && alerts.length > 0 && <span className="bd-cb">{alerts.length} recent</span>}
                </div>
                <div className="bd-alerts">
                  {loading ? (
                    <>
                      <Skel h={50} />
                      <Skel h={50} />
                      <Skel h={50} />
                    </>
                  ) : alerts.length > 0 ? (
                    alerts.map((a, i) => {
                      const t = alertType(a)
                      return (
                        <div key={i} className={`bd-alert-row ${t}`}>
                          <AlertIcon type={t} />
                          <div>
                            <div className="bd-alert-title">{a.agentName} — {a.action}</div>
                            <div className="bd-alert-sub">{a.summary}</div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="bd-empty">No recent alerts</div>
                  )}
                </div>
              </div>
            </div>

          </div>{/* /bd-main */}

          {/* ── RIGHT PANEL ── */}
          <div className="bd-right">

            {/* CEO Message */}
            <div className="bd-ceo-card">
              <div className="bd-ceo-header">
                <div className="bd-ceo-avatar">AM</div>
                <div>
                  <div className="bd-ceo-name">Arvind Mehta</div>
                  <div className="bd-ceo-role">CEO, Nexora</div>
                </div>
              </div>
              <p className="bd-ceo-quote">
                &ldquo;Bangalore is our fastest-growing hub. Sustain momentum on OTD and keep inventory turns high. Push the key restocks before month-end.&rdquo;
              </p>
            </div>

            {/* Agents Status */}
            <div className="bd-agents-card">
              <div className="bd-agents-hdr">
                <span className="bd-agents-title">AI Agents</span>
                <span className="bd-agents-badge">8 Active</span>
              </div>
              {AGENTS.map((a) => (
                <div key={a.name} className="bd-agent-row">
                  <div className="bd-agent-dot" style={{ background: a.color, color: a.color }} />
                  <span className="bd-agent-name">{a.name}</span>
                  <span className="bd-agent-status">Active</span>
                </div>
              ))}
            </div>

            {/* Procurement Requests */}
            <div className="bd-card bd-pr-status-card">
              <div className="bd-ch">
                <span className="bd-ct">Procurement Requests</span>
                <button className="bd-clink" onClick={() => router.push("/branch/bangalore/procurement/pr")}>New PR →</button>
              </div>
              {loading ? (
                <><Skel h={38}/><Skel h={38}/></>
              ) : prs.length === 0 ? (
                <div className="bd-pr-empty">No PRs yet — generate one from Inventory.</div>
              ) : (
                prs.map(pr => {
                  const val = pr.total_estimated_value
                  const valStr = val >= 1e7 ? `₹${(val/1e7).toFixed(2)} Cr` : val >= 1e5 ? `₹${(val/1e5).toFixed(1)}L` : `₹${Math.round(val).toLocaleString("en-IN")}`
                  return (
                    <div key={pr.id} className="bd-pr-row" onClick={() => router.push(`/branch/bangalore/procurement/pr/${pr.id}`)}>
                      <div className="bd-pr-left">
                        <div className="bd-pr-num">{pr.pr_number}</div>
                        <div className="bd-pr-val">{valStr}</div>
                      </div>
                      <div className="bd-pr-right">
                        <span className={`bd-pr-badge ${pr.status}`}>{pr.status.replace(/_/g, " ")}</span>
                        {pr.status === "APPROVED" && <div className="bd-pr-next">▶ Supplier Risk Agent</div>}
                        {pr.status === "FINANCE_APPROVED" && <div className="bd-pr-next">Awaiting CEO approval</div>}
                        {pr.status === "PENDING" && <div className="bd-pr-next">Awaiting Finance review</div>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Quick Actions */}
            <div className="bd-qa-card">
              <div className="bd-qa-title">Quick Actions</div>
              <button className="bd-qa-btn procurement" onClick={() => router.push("/branch/bangalore/procurement/pr")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="13" x2="12" y2="17"/>
                  <line x1="10" y1="15" x2="14" y2="15"/>
                </svg>
                Create PR
              </button>
              <button className="bd-qa-btn primary">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Raise Purchase Order
              </button>
              <button className="bd-qa-btn secondary">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M1 3h22v18H1z"/><path d="M1 9h22"/>
                </svg>
                Request Stock Transfer
              </button>
              <button className="bd-qa-btn tertiary">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Export Branch Report
              </button>
            </div>

          </div>{/* /bd-right */}
        </div>{/* /bd-body */}

      </div>{/* /bd-wrapper */}
    </div>
  )
}
