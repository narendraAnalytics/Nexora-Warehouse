"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import "../../../../inventory/inventory.css"

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

const WAREHOUSE_IDS: Record<string, string> = {
  bangalore: "531e5c42-e4a1-4db0-a35c-a434f3b94344",
}

function Skel({ w, h }: { w: number; h: number }) {
  return <span className="ni-skel" style={{ display: "inline-block", width: w, height: h }} />
}

export default function BranchInventoryPage() {
  const router = useRouter()
  const params = useParams()
  const branch = (params?.branch as string) ?? "bangalore"
  const branchLabel = branch.charAt(0).toUpperCase() + branch.slice(1)

  const [stock,     setStock]     = useState<StockRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis,  setAnalysis]  = useState<AnalysisResult | null>(null)
  const [toast,     setToast]     = useState("")

  const warehouseId = WAREHOUSE_IDS[branch.toLowerCase()] ?? WAREHOUSE_IDS.bangalore

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

  const criticalCount  = stock.filter(r => r.stock_status === "CRITICAL").length
  const lowCount       = stock.filter(r => r.stock_status === "LOW").length
  const okCount        = stock.filter(r => r.stock_status === "OK").length
  const overstockCount = stock.filter(r => r.stock_status === "OVERSTOCK").length
  const hasLowStock    = criticalCount + lowCount > 0

  return (
    <div className="nexora-inventory">
      {/* Topbar */}
      <div className="ni-topbar">
        <div className="ni-topbar-left">
          <button className="ni-back" onClick={() => router.push(`/branch/${branch}/dashboard`)}>
            ← Branch Dashboard
          </button>
          <div className="ni-topbar-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            Inventory Intelligence
          </div>
          <span className="ni-topbar-scope">{branchLabel}</span>
        </div>
        <div className="ni-topbar-right">
          <button className="ni-btn ni-btn-secondary" onClick={fetchStock} disabled={loading}>
            {loading ? <span className="ni-spinner dark" /> : "↻"} Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="ni-body">

        {/* KPI strip */}
        <div className="ni-kpis">
          <div className="ni-kpi">
            <div className="ni-kpi-label">Total Products</div>
            <div className="ni-kpi-val">
              {loading ? <Skel w={40} h={28} /> : stock.length}
            </div>
          </div>
          <div className="ni-kpi">
            <div className="ni-kpi-label">Critical</div>
            <div className={`ni-kpi-val${criticalCount > 0 ? " critical" : ""}`}>
              {loading ? <Skel w={32} h={28} /> : criticalCount}
            </div>
          </div>
          <div className="ni-kpi">
            <div className="ni-kpi-label">Low Stock</div>
            <div className={`ni-kpi-val${lowCount > 0 ? " low" : ""}`}>
              {loading ? <Skel w={32} h={28} /> : lowCount}
            </div>
          </div>
          <div className="ni-kpi">
            <div className="ni-kpi-label">OK / Overstock</div>
            <div className="ni-kpi-val ok">
              {loading ? <Skel w={40} h={28} /> : `${okCount} / ${overstockCount}`}
            </div>
          </div>
        </div>

        {/* Stock table */}
        <div className="ni-card">
          <div className="ni-card-header">
            <div>
              <div className="ni-card-title">Stock Levels — {branchLabel} Warehouse</div>
              <div className="ni-card-sub">Live data from inventory table. CRITICAL = at or below reorder point.</div>
            </div>
          </div>
          <div className="ni-table-wrap">
            <table className="ni-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Current Stock</th>
                  <th>Reorder Point</th>
                  <th>Safety Stock (Reorder Qty)</th>
                  <th>Max Stock</th>
                  <th>Avg Daily Sales</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j}><Skel w={j === 1 ? 140 : 60} h={14} /></td>
                      ))}
                    </tr>
                  ))
                ) : stock.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="ni-empty">
                        No inventory records found for {branchLabel} warehouse.<br/>
                        Add products via the Product Master to populate inventory.
                      </div>
                    </td>
                  </tr>
                ) : (
                  stock.map(row => {
                    const cls = STATUS_CLS[row.stock_status] ?? "ok"
                    return (
                      <tr key={row.sku}>
                        <td><span className="ni-sku">{row.sku}</span></td>
                        <td>
                          <div className="ni-product-name">{row.name}</div>
                          <div className="ni-category">{row.category} · {row.brand}</div>
                        </td>
                        <td><span className={`ni-qty ${cls}`}>{row.quantity}</span></td>
                        <td>{row.reorder_point}</td>
                        <td>{row.reorder_qty}</td>
                        <td>{row.max_stock}</td>
                        <td>{row.avg_daily_sales}</td>
                        <td><span className={`ni-badge ${cls}`}>● {row.stock_status}</span></td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Analysis panel */}
        {analysis && (
          <div className="ni-analysis-panel">
            <div className="ni-analysis-header">
              <div className="ni-analysis-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                </svg>
                Inventory Analysis Report — {branchLabel}
              </div>
              <div className="ni-analysis-meta">
                {analysis.low_stock_count} reorder alert{analysis.low_stock_count !== 1 ? "s" : ""} · ran at {analysis.ran_at}
              </div>
            </div>
            <div
              className="ni-analysis-body"
              dangerouslySetInnerHTML={{
                __html: analysis.analysis
                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                  .replace(/^#{1,3} (.+)$/gm, "<strong>$1</strong>")
                  .replace(/\n/g, "<br/>"),
              }}
            />
          </div>
        )}

      </div>

      {/* Sticky action bar */}
      <div className="ni-action-bar">
        <div className="ni-action-bar-left">
          {hasLowStock && !analyzing && !analysis && (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <path d="M12 9v4"/><path d="M12 17h.01"/>
              </svg>
              {criticalCount} critical, {lowCount} low stock — run analysis to generate PR
            </>
          )}
          {analysis && (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Analysis complete — {analysis.low_stock_count} items need reordering
            </>
          )}
        </div>
        <div className="ni-action-bar-right">
          <button
            className="ni-btn ni-btn-primary"
            onClick={runAnalysis}
            disabled={analyzing || loading}
          >
            {analyzing ? (
              <><span className="ni-spinner" /> Running Analysis…</>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
                </svg>
                Run Inventory Analysis
              </>
            )}
          </button>
          <button
            className="ni-btn ni-btn-success"
            disabled={!analysis || analysis.low_stock_count === 0}
            onClick={() => router.push(`/branch/${branch}/procurement/pr`)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            Generate PR
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "#0f172a", color: "#e2e8f0", padding: "10px 20px",
          borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 9999,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
