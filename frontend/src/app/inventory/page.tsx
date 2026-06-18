"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import "./inventory.css"

interface BranchSummary {
  warehouse_id: string
  name:         string
  city:         string
  total:        number
  critical:     number
  low:          number
  ok:           number
  overstock:    number
}

interface Aggregated {
  total:    number
  critical: number
  low:      number
  ok:       number
  overstock:number
}

interface StockRow {
  sku:           string
  name:          string
  category:      string
  brand:         string
  warehouse_name:string
  warehouse_city:string
  quantity:      number
  reserved_qty:  number
  reorder_point: number
  reorder_qty:   number
  max_stock:     number
  avg_daily_sales:number
  stock_status: "CRITICAL" | "LOW" | "OK" | "OVERSTOCK"
}

const STATUS_CLS: Record<string, string> = {
  CRITICAL: "critical",
  LOW:      "low",
  OK:       "ok",
  OVERSTOCK:"overstock",
}

function healthClass(b: BranchSummary) {
  if (b.critical > 0) return "critical"
  if (b.low > 0)      return "low"
  if (b.total === 0)  return "empty"
  return "ok"
}

function Skel({ w, h }: { w: number; h: number }) {
  return <span className="ni-skel" style={{ display: "inline-block", width: w, height: h }} />
}

export default function InventoryPage() {
  const router = useRouter()

  const [aggregated, setAggregated]     = useState<Aggregated | null>(null)
  const [branches,   setBranches]       = useState<BranchSummary[]>([])
  const [loading,    setLoading]        = useState(true)

  const [selectedBranch, setSelectedBranch] = useState<BranchSummary | null>(null)
  const [drillStock,     setDrillStock]     = useState<StockRow[]>([])
  const [drillLoading,   setDrillLoading]   = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/inventory/all-branches")
      const data = await res.json()
      setAggregated(data.aggregated)
      setBranches(Array.isArray(data.branches) ? data.branches : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const selectBranch = async (b: BranchSummary) => {
    if (selectedBranch?.warehouse_id === b.warehouse_id) {
      setSelectedBranch(null)
      setDrillStock([])
      return
    }
    setSelectedBranch(b)
    setDrillStock([])
    setDrillLoading(true)
    try {
      const res  = await fetch(`/api/inventory/stock?warehouse_id=${b.warehouse_id}`)
      const data = await res.json()
      setDrillStock(Array.isArray(data) ? data : [])
    } finally {
      setDrillLoading(false)
    }
  }

  const totalBranches = branches.filter(b => b.total > 0).length

  return (
    <div className="nexora-inventory">
      {/* Topbar */}
      <div className="ni-topbar">
        <div className="ni-topbar-left">
          <button className="ni-back" onClick={() => router.push("/dashboard")}>
            ← Dashboard
          </button>
          <div className="ni-topbar-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            Inventory Intelligence
          </div>
          <span className="ni-topbar-scope">All Branches</span>
        </div>
        <div className="ni-topbar-right">
          <button className="ni-btn ni-btn-secondary" onClick={fetchAll} disabled={loading}>
            {loading ? <span className="ni-spinner dark" /> : "↻"} Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="ni-body">

        {/* KPI strip */}
        <div className="ni-kpis">
          <div className="ni-kpi">
            <div className="ni-kpi-label">Total SKUs (Network)</div>
            <div className="ni-kpi-val">
              {loading ? <Skel w={40} h={28} /> : (aggregated?.total ?? 0)}
            </div>
          </div>
          <div className="ni-kpi">
            <div className="ni-kpi-label">Critical (All Branches)</div>
            <div className={`ni-kpi-val${(aggregated?.critical ?? 0) > 0 ? " critical" : ""}`}>
              {loading ? <Skel w={32} h={28} /> : (aggregated?.critical ?? 0)}
            </div>
          </div>
          <div className="ni-kpi">
            <div className="ni-kpi-label">Low Stock (All Branches)</div>
            <div className={`ni-kpi-val${(aggregated?.low ?? 0) > 0 ? " low" : ""}`}>
              {loading ? <Skel w={32} h={28} /> : (aggregated?.low ?? 0)}
            </div>
          </div>
          <div className="ni-kpi">
            <div className="ni-kpi-label">OK / Overstock</div>
            <div className="ni-kpi-val ok">
              {loading ? <Skel w={48} h={28} /> : `${aggregated?.ok ?? 0} / ${aggregated?.overstock ?? 0}`}
            </div>
          </div>
        </div>

        {/* Info note */}
        <div className="ni-info-note">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Read-only view — {totalBranches} of 5 branches stocked. Purchase Requests are generated by branch managers from their branch dashboard.
        </div>

        {/* Branch cards grid */}
        <div className="ni-branches-header">
          <div className="ni-card-title">Branch Stock Health</div>
          <div className="ni-card-sub">Click a branch to drill into its stock levels</div>
        </div>

        <div className="ni-branches-grid">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="ni-branch-card loading">
                <Skel w={120} h={16} />
                <Skel w={80}  h={12} />
                <Skel w={160} h={32} />
              </div>
            ))
          ) : branches.length === 0 ? (
            <div className="ni-empty" style={{ gridColumn: "1/-1" }}>
              No active warehouses found.
            </div>
          ) : (
            branches.map(b => {
              const hcls     = healthClass(b)
              const isActive = selectedBranch?.warehouse_id === b.warehouse_id
              return (
                <div
                  key={b.warehouse_id}
                  className={`ni-branch-card${isActive ? " selected" : ""}${b.total === 0 ? " empty" : ""}`}
                  onClick={() => selectBranch(b)}
                >
                  <div className="ni-branch-card-top">
                    <div className="ni-branch-city">{b.city}</div>
                    <div className={`ni-branch-health-dot ${hcls}`} />
                  </div>
                  <div className="ni-branch-name">{b.name}</div>
                  {b.total === 0 ? (
                    <div className="ni-branch-empty-label">No stock data</div>
                  ) : (
                    <div className="ni-branch-stats">
                      <div className="ni-branch-stat critical">
                        <span className="ni-branch-stat-val">{b.critical}</span>
                        <span className="ni-branch-stat-label">Critical</span>
                      </div>
                      <div className="ni-branch-stat low">
                        <span className="ni-branch-stat-val">{b.low}</span>
                        <span className="ni-branch-stat-label">Low</span>
                      </div>
                      <div className="ni-branch-stat ok">
                        <span className="ni-branch-stat-val">{b.ok}</span>
                        <span className="ni-branch-stat-label">OK</span>
                      </div>
                      <div className="ni-branch-stat overstock">
                        <span className="ni-branch-stat-val">{b.overstock}</span>
                        <span className="ni-branch-stat-label">Overstock</span>
                      </div>
                    </div>
                  )}
                  {b.total > 0 && (
                    <div className="ni-branch-total">{b.total} SKUs · {isActive ? "hide ↑" : "view →"}</div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Drill-in panel */}
        {selectedBranch && (
          <div className="ni-drill-panel">
            <div className="ni-card-header" style={{ padding: "16px 22px 14px" }}>
              <div>
                <div className="ni-card-title">
                  Stock Levels — {selectedBranch.city} Warehouse
                  <span className="ni-topbar-scope" style={{ marginLeft: 10 }}>Read-only</span>
                </div>
                <div className="ni-card-sub">CRITICAL = at or below reorder point</div>
              </div>
              <button className="ni-btn ni-btn-secondary" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => { setSelectedBranch(null); setDrillStock([]) }}>
                ✕ Close
              </button>
            </div>

            <div className="ni-table-wrap">
              <table className="ni-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Reorder Point</th>
                    <th>Safety Stock</th>
                    <th>Max Stock</th>
                    <th>Avg Daily Sales</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {drillLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j}><Skel w={j === 1 ? 140 : 60} h={14} /></td>
                        ))}
                      </tr>
                    ))
                  ) : drillStock.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="ni-empty">No inventory records for this warehouse.</div>
                      </td>
                    </tr>
                  ) : (
                    drillStock.map(row => {
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
        )}

      </div>
    </div>
  )
}
