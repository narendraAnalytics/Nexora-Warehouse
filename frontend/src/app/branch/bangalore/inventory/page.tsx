"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import "../../../inventory/inventory.css"

interface StockRow {
  sku:            string
  name:           string
  category:       string
  brand:          string
  warehouse_name: string
  warehouse_city: string
  quantity:       number
  reserved_qty:   number
  reorder_point:  number
  reorder_qty:    number
  max_stock:      number
  avg_daily_sales:number
  stock_status: "CRITICAL" | "LOW" | "OK" | "OVERSTOCK"
}

interface AnalysisResult {
  warehouse_id:    string
  analysis:        string
  reorder_alerts:  object[]
  low_stock_count: number
  ran_at?:         string
}

const STATUS_CLS: Record<string, string> = {
  CRITICAL: "critical",
  LOW:      "low",
  OK:       "ok",
  OVERSTOCK:"overstock",
}

function parseAnalysis(text: string) {
  return text.split(/\n\n+/).map(block => {
    const [header, ...rest] = block.split("\n")
    const dashIdx = header.indexOf(" — ")
    return {
      title:    dashIdx > -1 ? header.slice(0, dashIdx).trim() : header.trim(),
      subtitle: dashIdx > -1 ? header.slice(dashIdx + 3).trim() : "",
      lines:    rest.filter(Boolean),
    }
  }).filter(s => s.title)
}

function slug(title: string) {
  if (title.includes("REORDER"))   return "reorder"
  if (title.includes("OVERSTOCK")) return "overstock"
  if (title.includes("TRANSFER"))  return "transfer"
  return "summary"
}

const WAREHOUSE_IDS: Record<string, string> = {
  bangalore: "531e5c42-e4a1-4db0-a35c-a434f3b94344",
}

function Skel({ w, h }: { w: number; h: number }) {
  return <span className="ni-skel" style={{ display: "inline-block", width: w, height: h }} />
}

/* ══ MODAL ANIMATION CONFIG ══ */
const MODAL_STEPS = [
  { id:"s1", emoji:"⚡", title:"Frontend Request Sent",    sub:"POST /api/inventory/analyze?branch=bangalore", startMs:0,     doneMs:900,   prog:12,  status:"Sending analysis request…" },
  { id:"s2", emoji:"🔗", title:"Warehouse UUID Resolved",  sub:"Neon DB lookup — 531e5c42…4344",               startMs:900,   doneMs:2100,  prog:25,  status:"Resolving Bangalore warehouse ID…" },
  { id:"s3", emoji:"⚙️", title:"FastAPI Backend Init",     sub:"nexora-warehouse.onrender.com",                startMs:2100,  doneMs:3400,  prog:40,  status:"Building LangGraph task message…" },
  { id:"s4", emoji:"🧠", title:"LangGraph ReAct Agent",    sub:"inventory_analyst — llama-3.1-8b-instant",     startMs:3400,  doneMs:5200,  prog:55,  status:"LLM reasoning — selecting tools…" },
  { id:"s5", emoji:"🛢️", title:"4 DB Tool Calls Executing",sub:"Stock · Reorder · Overstock · Transfer",       startMs:5200,  doneMs:9500,  prog:80,  status:"Running inventory database queries…" },
  { id:"s6", emoji:"✍️", title:"LLM Generating Report",    sub:"Structured analysis with reorder plan",        startMs:9500,  doneMs:11800, prog:93,  status:"LLM writing structured analysis…" },
  { id:"s7", emoji:"📦", title:"Results Delivered",        sub:"Logged to agent_logs · JSON returned",         startMs:11800, doneMs:13200, prog:100, status:"Finalizing & logging results…" },
]

const MODAL_LOGS = [
  {ms:0,     cls:"info", txt:"[07:12:43.001] Initiating inventory analysis for Bangalore branch…"},
  {ms:150,   cls:"info", txt:"[07:12:43.152] → POST /api/inventory/analyze?branch=bangalore"},
  {ms:320,   cls:"dim",  txt:"[07:12:43.320]   Body: {}"},
  {ms:900,   cls:"info", txt:"[07:12:43.900] Next.js API route received request — branch: bangalore"},
  {ms:1100,  cls:"sql",  txt:"[07:12:44.100] ⬡ SELECT id FROM warehouses WHERE LOWER(city) = 'bangalore' AND is_active = TRUE LIMIT 1"},
  {ms:1550,  cls:"ok",   txt:"[07:12:44.550] ✓ warehouse_id: 531e5c42-e4a1-4db0-a35c-a434f3b94344"},
  {ms:1750,  cls:"info", txt:"[07:12:44.750] → Forwarding to FastAPI backend…"},
  {ms:2100,  cls:"info", txt:"[07:12:45.100] FastAPI: POST /inventory/analyze received"},
  {ms:2350,  cls:"info", txt:"[07:12:45.350] Building task: \"Analyze inventory for warehouse_id=531e5c42…\""},
  {ms:2700,  cls:"info", txt:"[07:12:45.700] Initializing LangGraph state: { messages: [HumanMessage] }"},
  {ms:3100,  cls:"info", txt:"[07:12:46.100] → graph.ainvoke(initial_state) called"},
  {ms:3400,  cls:"info", txt:"[07:12:46.400] inventory_analyst node: prepending SystemMessage…"},
  {ms:3800,  cls:"llm",  txt:"[07:12:46.800] 🤖 LLM (llama-3.1-8b-instant): deciding tool calls…"},
  {ms:4300,  cls:"tool", txt:"[07:12:47.300] ⚒  Tool selected: get_stock_levels(531e5c42…)"},
  {ms:5200,  cls:"tool", txt:"[07:12:48.200] ⚒  Tool call: get_stock_levels(warehouse_id)"},
  {ms:5500,  cls:"sql",  txt:"[07:12:48.500] ⬡ SELECT p.sku, p.name, p.category, i.quantity, i.reserved_qty, i.reorder_point FROM inventory i JOIN products p …"},
  {ms:6050,  cls:"ok",   txt:"[07:12:49.050] ✓ get_stock_levels: records retrieved (sorted by qty ASC)"},
  {ms:6100,  cls:"tool", txt:"[07:12:49.100] ⚒  Tool call: get_reorder_alerts(warehouse_id)"},
  {ms:6500,  cls:"sql",  txt:"[07:12:49.500] ⬡ SELECT p.sku, p.name, (i.reorder_point - i.quantity) AS deficit FROM inventory i … WHERE i.quantity <= i.reorder_point ORDER BY deficit DESC"},
  {ms:7050,  cls:"ok",   txt:"[07:12:50.050] ✓ get_reorder_alerts: items below reorder point returned"},
  {ms:7100,  cls:"tool", txt:"[07:12:50.100] ⚒  Tool call: get_overstock_alerts(warehouse_id)"},
  {ms:7500,  cls:"sql",  txt:"[07:12:50.500] ⬡ SELECT p.sku, (i.quantity - i.max_stock) AS excess FROM inventory i … WHERE i.quantity >= i.max_stock ORDER BY excess DESC"},
  {ms:8050,  cls:"ok",   txt:"[07:12:51.050] ✓ get_overstock_alerts: items above max stock returned"},
  {ms:8100,  cls:"tool", txt:"[07:12:51.100] ⚒  Tool call: get_transfer_opportunities()"},
  {ms:8500,  cls:"sql",  txt:"[07:12:51.500] ⬡ Cross-warehouse join: matching surplus branches → deficit branches for same SKU… LIMIT 15"},
  {ms:9450,  cls:"ok",   txt:"[07:12:52.450] ✓ get_transfer_opportunities: opportunities found"},
  {ms:9500,  cls:"llm",  txt:"[07:12:52.500] 🤖 All tools complete. LLM generating structured report…"},
  {ms:9900,  cls:"llm",  txt:"[07:12:52.900] 🤖 Writing REORDER ALERTS section…"},
  {ms:10400, cls:"llm",  txt:"[07:12:53.400] 🤖 Writing OVERSTOCK ALERTS section…"},
  {ms:10900, cls:"llm",  txt:"[07:12:53.900] 🤖 Writing TRANSFER OPPORTUNITIES section…"},
  {ms:11300, cls:"llm",  txt:"[07:12:54.300] 🤖 Writing SUMMARY — Health assessment…"},
  {ms:11800, cls:"ok",   txt:"[07:12:54.800] ✓ LLM report generated successfully"},
  {ms:11900, cls:"info", txt:"[07:12:54.900] → Logging to agent_logs table…"},
  {ms:12100, cls:"sql",  txt:"[07:12:55.100] ⬡ INSERT INTO agent_logs (agent_name='inventory_agent', action='inventory_analysis', status='success')"},
  {ms:12400, cls:"ok",   txt:"[07:12:55.400] ✓ Logged successfully."},
  {ms:12600, cls:"info", txt:"[07:12:55.600] → Returning JSON response to Next.js…"},
  {ms:13000, cls:"ok",   txt:"[07:12:56.000] ✅ Analysis complete! Generate PR unlocked."},
]

const BAR_COLOR: Record<string, string> = {
  critical: "#EF4444",
  low:      "#FFB800",
  ok:       "#22C55E",
  overstock:"#18D8C3",
}

export default function BranchInventoryPage() {
  const router = useRouter()
  const params = useParams()
  const branch = (params?.branch as string) ?? "bangalore"
  const branchLabel = branch.charAt(0).toUpperCase() + branch.slice(1)

  /* ── EXISTING STATE (unchanged) ── */
  const [stock,     setStock]     = useState<StockRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis,  setAnalysis]  = useState<AnalysisResult | null>(null)
  const [toast,     setToast]     = useState("")

  /* ── NEW DISPLAY STATE ── */
  const [modalOpen,    setModalOpen]    = useState(false)
  const [modalDone,    setModalDone]    = useState(false)
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [stepStates,   setStepStates]   = useState<Record<string, string>>({})
  const [logLines,     setLogLines]     = useState<Array<{cls: string; txt: string}>>([])
  const [progPct,      setProgPct]      = useState(0)
  const [mfStatus,     setMfStatus]     = useState("Initializing inventory agent…")
  const [elapsedSec,   setElapsedSec]   = useState(0)
  const [truckStopped, setTruckStopped] = useState(false)
  const timeoutsRef  = useRef<ReturnType<typeof setTimeout>[]>([])
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const logBodyRef   = useRef<HTMLDivElement>(null)

  const warehouseId = WAREHOUSE_IDS[branch.toLowerCase()] ?? WAREHOUSE_IDS.bangalore

  /* ── EXISTING FUNCTIONS (unchanged) ── */
  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3500)
  }

  const fetchStock = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/inventory/stock?warehouse_id=${warehouseId}`)
      const data = await res.json()
      setStock(Array.isArray(data) ? data : [])
    } catch {
      showToast("Failed to load stock data")
    } finally {
      setLoading(false)
    }
  }, [warehouseId])

  useEffect(() => { fetchStock() }, [fetchStock])

  const runAnalysis = async () => {
    setAnalyzing(true)
    setAnalysis(null)
    try {
      const res  = await fetch(`/api/inventory/analyze?branch=${branch}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Analysis failed")
      setAnalysis({ ...data, ran_at: new Date().toLocaleTimeString() })
      showToast("Inventory analysis complete")
      fetchStock()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setAnalyzing(false)
    }
  }

  /* ── Watch analyzing completion → show modal done overlay ── */
  useEffect(() => {
    if (!analyzing && modalOpen && analysis) {
      setModalDone(true)
      setTruckStopped(true)
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      setMfStatus("Analysis complete — items need reordering")
    }
  }, [analyzing, modalOpen, analysis])

  /* ── Auto-scroll log body ── */
  useEffect(() => {
    if (logBodyRef.current) {
      logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight
    }
  }, [logLines])

  /* ── Modal animation controller ── */
  const startModalAnimation = () => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }

    setStepStates({})
    setLogLines([])
    setProgPct(0)
    setElapsedSec(0)
    setTruckStopped(false)
    setMfStatus("Initializing inventory agent…")

    let secs = 0
    intervalRef.current = setInterval(() => { secs++; setElapsedSec(secs) }, 1000)

    MODAL_STEPS.forEach(step => {
      const t1 = setTimeout(() => {
        setStepStates(prev => ({ ...prev, [step.id]: "active" }))
        setMfStatus(step.status)
      }, step.startMs)
      const t2 = setTimeout(() => {
        setStepStates(prev => ({ ...prev, [step.id]: "done" }))
        setProgPct(step.prog)
      }, step.doneMs)
      timeoutsRef.current.push(t1, t2)
    })

    MODAL_LOGS.forEach(line => {
      const t = setTimeout(() => {
        setLogLines(prev => [...prev, { cls: line.cls, txt: line.txt }])
      }, line.ms)
      timeoutsRef.current.push(t)
    })
  }

  const closeModal = () => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setModalOpen(false)
    setModalDone(false)
    setTruckStopped(false)
  }

  /* ── Computed ── */
  const criticalCount  = stock.filter(r => r.stock_status === "CRITICAL").length
  const lowCount       = stock.filter(r => r.stock_status === "LOW").length
  const okCount        = stock.filter(r => r.stock_status === "OK").length
  const overstockCount = stock.filter(r => r.stock_status === "OVERSTOCK").length
  const hasLowStock    = criticalCount + lowCount > 0

  const filteredStock = useMemo(() =>
    filterStatus === "ALL" ? stock : stock.filter(r => r.stock_status === filterStatus),
    [stock, filterStatus]
  )

  const elapsedFormatted = `${String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:${String(elapsedSec % 60).padStart(2, "0")} elapsed`

  /* ── Analysis section builder from parsed text ── */
  function buildApSections(parsed: ReturnType<typeof parseAnalysis>) {
    const sectionDefs = [
      {
        key: "reorder",
        title: "Reorder Alerts",
        ico: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
        ),
        icoBg: "rgba(239,68,68,.12)",
        countBg: "rgba(239,68,68,.1)", countColor: "#DC2626",
        numBg: "#EF4444",
      },
      {
        key: "overstock",
        title: "Overstock Alerts",
        ico: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="15 7 22 7 22 14"/>
          </svg>
        ),
        icoBg: "rgba(24,216,195,.12)",
        countBg: "rgba(24,216,195,.1)", countColor: "#0D9488",
        numBg: "#18D8C3",
      },
      {
        key: "transfer",
        title: "Transfer Opportunities",
        ico: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="16 3 21 3 21 8"/><polyline points="4 20 9 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><polyline points="8 3 3 3 3 8"/>
            <line x1="3" y1="3" x2="10" y2="10"/>
          </svg>
        ),
        icoBg: "rgba(255,184,0,.12)",
        countBg: "rgba(255,184,0,.1)", countColor: "#B45309",
        numBg: "#FFB800",
      },
      {
        key: "summary",
        title: "Summary & Actions",
        ico: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9333EA" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 8h.01"/><path d="M12 12v4"/>
          </svg>
        ),
        icoBg: "rgba(168,85,247,.12)",
        countBg: "rgba(168,85,247,.1)", countColor: "#9333EA",
        numBg: "#A855F7",
      },
    ]

    return sectionDefs.map(def => {
      const sec = parsed.find(s => slug(s.title) === def.key)
      return (
        <div className="ni-ap-sec" key={def.key}>
          <div className="ni-ap-sec-hdr">
            <div className="ni-ap-sec-ico" style={{ background: def.icoBg }}>{def.ico}</div>
            <span className="ni-ap-sec-title">{def.title}</span>
            <div className="ni-ap-count" style={{ background: def.countBg, color: def.countColor }}>
              {sec ? sec.lines.length : 0} item{sec && sec.lines.length !== 1 ? "s" : ""}
            </div>
          </div>
          {sec && sec.lines.length > 0 ? sec.lines.map((line, i) => (
            <div className="ni-ap-item" key={i}>
              <div className="ni-ap-num" style={{ background: def.numBg }}>{i + 1}</div>
              <div>
                <div className="ni-ap-name">{line}</div>
              </div>
            </div>
          )) : (
            <div style={{ fontSize: 11, color: "#C09060", padding: "6px 0", fontStyle: "italic" }}>None found</div>
          )}
        </div>
      )
    })
  }

  return (
    <div className="nexora-inventory">

      {/* ══ SIDEBAR ══ */}
      <aside className="ni-sidebar">
        <div className="ni-sb-logo">
          <svg className="ni-sb-logo-mark" viewBox="0 0 34 34" fill="none">
            <defs>
              <linearGradient id="nisg1" x1="0" y1="0" x2="34" y2="34">
                <stop offset="0%" stopColor="#FF8C00"/>
                <stop offset="100%" stopColor="#FFD700"/>
              </linearGradient>
            </defs>
            <path d="M17 1.5L32.5 13V32.5H1.5V13Z" fill="white" stroke="url(#nisg1)" strokeWidth="2" strokeLinejoin="round"/>
            <rect x="3" y="13" width="7" height="18" rx="1.2" fill="#FF6B35"/>
            <polygon points="10,13 15,13 21,31 16,31" fill="#FFB800"/>
            <rect x="13" y="13" width="7" height="18" rx="1.2" fill="#FF6B35"/>
            <rect x="22" y="13" width="9.5" height="6" rx="1.5" fill="#FF6B35"/>
            <rect x="22" y="21" width="9.5" height="5" rx="1.5" fill="#18D8C3"/>
          </svg>
          <div>
            <div className="ni-sb-logo-name">NEXORA</div>
            <div className="ni-sb-logo-sub">Warehouse</div>
          </div>
        </div>
        <div className="ni-sb-nav">
          <a className="ni-nav-a" href={`/branch/${branch}/dashboard`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            Dashboard
          </a>
          <a className="ni-nav-a">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Sales
          </a>
          <a className="ni-nav-a">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
            </svg>
            Returns
          </a>
          <a className="ni-nav-a active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            Inventory
          </a>
          <a className="ni-nav-a">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
            </svg>
            Purchase
          </a>
          <a className="ni-nav-a">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M9 21V9"/>
            </svg>
            Orders &amp; POs
          </a>
          <a className="ni-nav-a" href={`/branch/${branch}/procurement/pr`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            PR Management
          </a>
          <a className="ni-nav-a">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="1" y="3" width="15" height="13"/>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
              <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            GRN &amp; Receipts
          </a>
          <a className="ni-nav-a">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Suppliers
          </a>
          <a className="ni-nav-a">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Reports
          </a>
          <a className="ni-nav-a">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            Alerts
            <span className="ni-nav-badge">8</span>
          </a>
          <a className="ni-nav-a">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="8" width="18" height="12" rx="2"/>
              <path d="M12 2v4"/><circle cx="12" cy="6" r="2" fill="currentColor" stroke="none"/>
            </svg>
            Agents Hub
          </a>
          <a className="ni-nav-a">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </a>
        </div>
      </aside>

      {/* ══ MAIN AREA ══ */}
      <div className="ni-main-area">

        {/* TOPBAR */}
        <div className="ni-topbar">
          <div>
            <div className="ni-tb-title">Inventory Intelligence</div>
            <div className="ni-tb-sub">{branchLabel} Central Warehouse · BLR-01</div>
          </div>
          <div className="ni-tb-sep" />
          {criticalCount + lowCount > 0 && (
            <div className="ni-tb-badge alert">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <path d="M12 9v4"/><path d="M12 17h.01"/>
              </svg>
              {criticalCount} Critical · {lowCount} Low Stock
            </div>
          )}
          {okCount + overstockCount > 0 && (
            <div className="ni-tb-badge ok">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {okCount} OK / {overstockCount} Overstock
            </div>
          )}
          <div className="ni-tb-spacer" />
          <div className="ni-tb-dt">
            <strong>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong>
            {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <button className="ni-back" onClick={() => router.push(`/branch/${branch}/dashboard`)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Branch Dashboard
          </button>
        </div>

        {/* BODY */}
        <div className="ni-body">

          {/* KPI STRIP */}
          <div className="ni-kpis">
            <div className="ni-kpi">
              <div className="ni-kpi-ico" style={{ background: "rgba(255,107,53,.1)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <div>
                <div className="ni-kpi-label">Total SKUs</div>
                <div className="ni-kpi-val">{loading ? <Skel w={40} h={28} /> : stock.length}</div>
                <div className="ni-kpi-sub">{branchLabel} warehouse</div>
              </div>
            </div>
            <div className="ni-kpi">
              <div className="ni-kpi-ico" style={{ background: "rgba(239,68,68,.1)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <path d="M12 9v4"/><path d="M12 17h.01"/>
                </svg>
              </div>
              <div>
                <div className="ni-kpi-label">Critical Stock</div>
                <div className={`ni-kpi-val${criticalCount > 0 ? " critical" : ""}`}>
                  {loading ? <Skel w={32} h={28} /> : criticalCount}
                </div>
                <div className="ni-kpi-sub">Below reorder point</div>
              </div>
            </div>
            <div className="ni-kpi">
              <div className="ni-kpi-ico" style={{ background: "rgba(255,184,0,.1)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFB800" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4"/><path d="M12 16h.01"/>
                </svg>
              </div>
              <div>
                <div className="ni-kpi-label">Low Stock</div>
                <div className={`ni-kpi-val${lowCount > 0 ? " low" : ""}`}>
                  {loading ? <Skel w={32} h={28} /> : lowCount}
                </div>
                <div className="ni-kpi-sub">Action recommended</div>
              </div>
            </div>
            <div className="ni-kpi">
              <div className="ni-kpi-ico" style={{ background: "rgba(34,197,94,.1)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <div className="ni-kpi-label">OK / Overstock</div>
                <div className="ni-kpi-val ok">
                  {loading ? <Skel w={40} h={28} /> : okCount + overstockCount}
                </div>
                <div className="ni-kpi-sub">{okCount} OK · {overstockCount} Overstock</div>
              </div>
            </div>
          </div>

          {/* STOCK TABLE CARD */}
          <div className="ni-card">
            <div className="ni-card-header">
              <div>
                <div className="ni-card-title">Stock Levels — {branchLabel} Warehouse</div>
                <div className="ni-card-sub">Live inventory. CRITICAL = at or below reorder point.</div>
              </div>
              <div className="ni-filters">
                {(["ALL", "CRITICAL", "LOW", "OK", "OVERSTOCK"] as const).map(f => (
                  <button
                    key={f}
                    className={`ni-filter-btn${filterStatus === f ? " active" : ""}`}
                    onClick={() => setFilterStatus(f)}
                  >
                    {f === "ALL" ? `All (${stock.length})` : `${f.charAt(0) + f.slice(1).toLowerCase()} (${
                      f === "CRITICAL" ? criticalCount :
                      f === "LOW" ? lowCount :
                      f === "OK" ? okCount :
                      overstockCount
                    })`}
                  </button>
                ))}
              </div>
            </div>
            <div className="ni-table-wrap">
              <table className="ni-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Qty on Hand</th>
                    <th>Reserved</th>
                    <th>Reorder Pt.</th>
                    <th>Safety Stock</th>
                    <th>Max Stock</th>
                    <th>Avg Daily</th>
                    <th>Utilisation</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 10 }).map((_, j) => (
                          <td key={j}><Skel w={j === 1 ? 140 : 60} h={14} /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <div className="ni-empty">
                          {stock.length === 0
                            ? <>No inventory records found for {branchLabel} warehouse.<br/>Add products via the Product Master to populate inventory.</>
                            : `No ${filterStatus.toLowerCase()} items found.`
                          }
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map(row => {
                      const cls = STATUS_CLS[row.stock_status] ?? "ok"
                      const pct = row.max_stock > 0 ? Math.min(Math.round(row.quantity / row.max_stock * 100), 100) : 0
                      return (
                        <tr key={row.sku}>
                          <td><span className="ni-sku">{row.sku}</span></td>
                          <td>
                            <div className="ni-product-name">{row.name}</div>
                            <div className="ni-category">{row.category} · {row.brand}</div>
                          </td>
                          <td><span className={`ni-qty ${cls}`}>{row.quantity}</span></td>
                          <td style={{ color: "var(--muted)", fontSize: 12 }}>{row.reserved_qty}</td>
                          <td style={{ fontWeight: 700, fontSize: 12 }}>{row.reorder_point}</td>
                          <td style={{ fontSize: 12, color: "var(--muted)" }}>{row.reorder_qty}</td>
                          <td style={{ fontSize: 12, color: "var(--muted)" }}>{row.max_stock}</td>
                          <td style={{ fontSize: 12, color: "var(--muted)" }}>{row.avg_daily_sales}</td>
                          <td>
                            <div className="ni-util-wrap">
                              <div className="ni-util-bar">
                                <div className="ni-util-fill" style={{ width: `${pct}%`, background: BAR_COLOR[cls] ?? "#22C55E" }} />
                              </div>
                              <span className="ni-util-pct">{pct}%</span>
                            </div>
                          </td>
                          <td><span className={`ni-badge ${cls}`}>{row.stock_status}</span></td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ANALYSIS PANEL */}
          {analysis && (() => {
            const parsed = parseAnalysis(analysis.analysis)
            const reorderSec = parsed.find(s => slug(s.title) === "reorder")
            const overstockSec = parsed.find(s => slug(s.title) === "overstock")
            const transferSec = parsed.find(s => slug(s.title) === "transfer")
            const summarySec  = parsed.find(s => slug(s.title) === "summary")
            return (
              <div className="ni-analysis-panel">
                <div className="ni-ap-head">
                  <div>
                    <div className="ni-ap-title">🤖 AI Inventory Analysis Report — {branchLabel}</div>
                    <div className="ni-ap-meta">Powered by llama-3.1-8b-instant (Groq) via LangGraph · Ran at {analysis.ran_at}</div>
                  </div>
                  <div className="ni-ap-badges">
                    <div className="ni-ap-badge">{reorderSec ? reorderSec.lines.length : 0} Reorder Alerts</div>
                    <div className="ni-ap-badge">{overstockSec ? overstockSec.lines.length : 0} Overstock Items</div>
                    <div className="ni-ap-badge">{transferSec ? transferSec.lines.length : 0} Transfer Opp.</div>
                  </div>
                </div>
                <div className="ni-ap-sections">
                  {buildApSections(parsed)}
                </div>
                {summarySec && (
                  <div className="ni-ap-summary">
                    <div className="ni-aps-title">Summary — Inventory Health: <span style={{ color: "#EF4444", fontWeight: 900 }}>
                      {analysis.low_stock_count > 3 ? "HIGH RISK" : analysis.low_stock_count > 1 ? "MODERATE RISK" : "LOW RISK"}
                    </span></div>
                    <div className="ni-aps-body">
                      {summarySec.lines.map((l, i) => <span key={i}>{l} </span>)}
                    </div>
                    {reorderSec && reorderSec.lines.slice(0, 3).map((item, i) => (
                      <div className="ni-aps-action" key={i}>
                        <div className="ni-aps-pnum">{i + 1}</div>
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

        </div>{/* /ni-body */}

        {/* ACTION BAR */}
        <div className="ni-action-bar">
          <div className={`ni-action-bar-left${hasLowStock && !analysis ? " warn" : ""}`}>
            {analysis ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Analysis complete — {analysis.low_stock_count} items need reordering · Generate PR to proceed
              </>
            ) : hasLowStock ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <path d="M12 9v4"/><path d="M12 17h.01"/>
                </svg>
                {criticalCount} critical, {lowCount} low stock — run AI analysis to generate reorder recommendations
              </>
            ) : null}
          </div>
          <div className="ni-action-bar-right">
            <button className="ni-btn ni-btn-secondary" onClick={fetchStock} disabled={loading}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
              </svg>
              Refresh
            </button>
            <button
              className="ni-btn ni-btn-primary"
              onClick={() => { setModalOpen(true); setModalDone(false); startModalAnimation(); runAnalysis(); }}
              disabled={analyzing || loading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
              </svg>
              Run Inventory Analysis
            </button>
            <button
              className={`ni-btn ni-btn-success${analysis && analysis.low_stock_count > 0 ? " enabled" : ""}`}
              disabled={!analysis || analysis.low_stock_count === 0}
              onClick={() => router.push(`/branch/${branch}/procurement/pr`)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              Generate PR
            </button>
          </div>
        </div>

      </div>{/* /ni-main-area */}

      {/* ══ AGENT MODAL ══ */}
      {modalOpen && (
        <div className="ni-modal-overlay">
          <div className="ni-agent-modal">

            {/* Complete overlay */}
            {modalDone && (
              <div className="ni-complete-overlay">
                <div className="ni-co-ico">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div className="ni-co-title">Analysis Complete!</div>
                <div className="ni-co-sub">
                  Inventory Agent finished · {analysis?.low_stock_count ?? 0} reorder alert{(analysis?.low_stock_count ?? 0) !== 1 ? "s" : ""} found
                </div>
                <div className="ni-co-stats">
                  <div className="ni-co-stat">
                    <div className="ni-co-stat-val">{analysis?.low_stock_count ?? 0}</div>
                    <div className="ni-co-stat-lbl">Reorder Alerts</div>
                  </div>
                  <div className="ni-co-stat">
                    <div className="ni-co-stat-val">{stock.filter(r => r.stock_status === "OVERSTOCK").length}</div>
                    <div className="ni-co-stat-lbl">Overstock Items</div>
                  </div>
                  <div className="ni-co-stat">
                    <div className="ni-co-stat-val" style={{ color: "#38BDF8" }}>4</div>
                    <div className="ni-co-stat-lbl">DB Queries Run</div>
                  </div>
                </div>
                <button className="ni-btn-view" onClick={closeModal}>View Analysis Results</button>
              </div>
            )}

            {/* Road section */}
            <div className="ni-road-section">
              <div className="ni-road-title-row">
                <h3>
                  <img
                    src="https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781838831/looryflaticon_kppja8.png"
                    style={{ width: 28, height: "auto", verticalAlign: "middle", marginRight: 4, filter: "drop-shadow(0 2px 8px rgba(255,107,53,.4))" }}
                    alt=""
                  />
                  Inventory Agent Running
                  <span className="ni-agent-name-badge">inventory_agent</span>
                </h3>
                <div className="ni-prog-pct">{progPct}<span>%</span></div>
              </div>
              <div className="ni-road-strip">
                <div className="ni-road-bg" />
                <div className="ni-road-edge-top" />
                <div className="ni-road-lines" />
                <div className="ni-road-edge-bot" />
                <div className={`ni-truck-container${truckStopped ? " stopped" : ""}`}>
                  <img
                    src="https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781838831/looryflaticon_kppja8.png"
                    alt="Nexora Delivery Truck"
                  />
                </div>
              </div>
            </div>

            {/* Global progress bar */}
            <div className="ni-global-prog">
              <div className="ni-global-prog-fill" style={{ width: `${progPct}%` }} />
            </div>

            {/* Body */}
            <div className="ni-modal-body">

              {/* Steps column */}
              <div className="ni-steps-col">
                {MODAL_STEPS.map((step, i) => {
                  const state = stepStates[step.id] ?? "pending"
                  return (
                    <div className={`ni-step-item ${state}`} key={step.id}>
                      {i < MODAL_STEPS.length - 1 && <div className="ni-step-connector" />}
                      <div className="ni-step-ico-wrap">{step.emoji}</div>
                      <div className="ni-step-info">
                        <div className="ni-step-title">{step.title}</div>
                        <div className="ni-step-sub">{step.sub}</div>
                        <div className="ni-step-meta">
                          <span className={`ni-step-tag ${state}`}>
                            {state === "done" ? "✓ Done" : state === "active" ? "Running…" : "Pending"}
                          </span>
                          {state === "done" && (
                            <span className="ni-step-dur">
                              {((step.doneMs - step.startMs) / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Live log */}
              <div className="ni-log-col">
                <div className="ni-log-header">
                  <div className="ni-log-dot" style={{ background: "#EF4444" }} />
                  <div className="ni-log-dot" style={{ background: "#FFB800" }} />
                  <div className="ni-log-dot" style={{ background: "#22C55E" }} />
                  <div className="ni-log-hdr-title">nexora-inventory-agent — live log</div>
                  {!modalDone && (
                    <>
                      <div className="ni-log-live-dot" />
                      <div className="ni-log-live-txt">LIVE</div>
                    </>
                  )}
                </div>
                <div className="ni-log-body" ref={logBodyRef}>
                  {logLines.map((line, i) => (
                    <span key={i} className={`ni-log-line ${line.cls}`}>{line.txt}</span>
                  ))}
                </div>
              </div>

            </div>{/* /ni-modal-body */}

            {/* Footer */}
            <div className="ni-modal-footer">
              <div className="ni-mf-elapsed">{elapsedFormatted}</div>
              <div className="ni-mf-status">{mfStatus}</div>
              <button className="ni-btn-cancel-modal" onClick={closeModal}>Cancel</button>
            </div>

          </div>{/* /ni-agent-modal */}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "#2D1500", color: "#FFF8EF", padding: "10px 20px",
          borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999,
          boxShadow: "0 4px 16px rgba(139,70,20,.3)",
        }}>
          {toast}
        </div>
      )}

    </div>
  )
}
