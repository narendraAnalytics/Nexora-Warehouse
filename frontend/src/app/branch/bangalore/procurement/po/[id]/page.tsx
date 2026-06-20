"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import "./blr-po.css"

interface POItem {
  sku:       string
  name:      string
  category:  string
  quantity:  number
  unit_cost: number
  line_total: number
}

interface PODetail {
  id:                   string
  po_number:            string
  pr_id:                string
  supplier_id:          string
  supplier_name:        string
  supplier_city:        string
  supplier_reliability: number
  supplier_risk:        number
  warehouse_id:         string
  status:               string
  total_amount:         number
  expected_date:        string
  items:                POItem[]
  ai_reasoning:         string
  created_at:           string
}

interface Supplier {
  id:                string
  name:              string
  city:              string
  categories:        string[]
  reliability_score: number
  risk_score:        number
  avg_lead_days:     number
  payment_terms:     string
  contact_person:    string | null
}

function formatINR(val: number): string {
  if (val >= 1e7) return `₹${(val / 1e7).toFixed(2)} Cr`
  if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)}L`
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`
  return `₹${Math.round(val).toLocaleString("en-IN")}`
}

function riskChipClass(risk: number): string {
  if (risk >= 5) return "risk-high"
  if (risk >= 3) return "risk-med"
  return "risk-low"
}

export default function BranchPODetailPage() {
  const router = useRouter()
  const params = useParams()
  const poId = params?.id as string

  const [po, setPO] = useState<PODetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingGrn, setCreatingGrn] = useState(false)
  const [existingGrnId, setExistingGrnId] = useState<string | null>(null)
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("")
  const [changingSupplier, setChangingSupplier] = useState(false)
  const [supplierToast, setSupplierToast] = useState("")

  useEffect(() => {
    if (!poId) return
    Promise.all([
      fetch(`/api/procurement/po/${poId}`).then(r => r.json()),
      fetch(`/api/procurement/grn?po_id=${poId}`).then(r => r.json()),
      fetch(`/api/procurement/suppliers`).then(r => r.json()),
    ])
      .then(([poData, grns, suppliers]: [PODetail, { id: string }[], Supplier[]]) => {
        setPO(poData)
        setSelectedSupplierId(poData.supplier_id)
        if (Array.isArray(grns) && grns.length > 0) setExistingGrnId(grns[0].id)
        if (Array.isArray(suppliers)) setAllSuppliers(suppliers)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [poId])

  async function handleUpdateSupplier() {
    if (!po || selectedSupplierId === po.supplier_id) return
    setChangingSupplier(true)
    try {
      const res = await fetch(`/api/procurement/po/${poId}/supplier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: selectedSupplierId }),
      })
      const data = await res.json()
      if (!res.ok) { setSupplierToast(data.detail ?? "Failed to update supplier"); return }
      setPO(prev => prev ? { ...prev, supplier_id: selectedSupplierId, supplier_name: data.supplier_name } : prev)
      setSupplierToast(`Supplier updated to ${data.supplier_name}`)
      setTimeout(() => setSupplierToast(""), 3000)
    } catch {
      setSupplierToast("Failed to update supplier")
      setTimeout(() => setSupplierToast(""), 3000)
    } finally {
      setChangingSupplier(false)
    }
  }

  async function handleCreateGRN() {
    setCreatingGrn(true)
    try {
      const res = await fetch(`/api/procurement/po/${poId}/grn`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) { alert(data.detail ?? "Failed to create GRN"); return }
      router.push(`/branch/bangalore/procurement/grn/${data.id}`)
    } finally {
      setCreatingGrn(false)
    }
  }

  if (loading) {
    return (
      <div className="nexora-po">
        <div className="po-loading"><div className="po-spinner"/><span>Loading Purchase Order...</span></div>
      </div>
    )
  }
  if (!po) {
    return (
      <div className="nexora-po">
        <div className="po-loading">Purchase Order not found.</div>
      </div>
    )
  }

  const nextSteps = [
    { step: 1, label: "Send to Supplier",      sub: "PO dispatched for fulfillment",   active: true,             color: "#18D8C3", done: false },
    { step: 2, label: "Supplier Confirmation", sub: "Supplier accepts or negotiates",   active: false,            color: "#FF6B35", done: false },
    { step: 3, label: "Goods Receipt (GRN)",   sub: "Warehouse receives & inspects",    active: !existingGrnId,   color: "#22C55E", done: !!existingGrnId },
  ]

  return (
    <div className="nexora-po">

      {/* ── Topbar ── */}
      <div className="po-topbar">
        <div className="po-logo">NEXORA</div>
        <div className="po-sep"/>
        <div className="po-title">Purchase Order</div>
        <div className="po-spacer"/>
        <button
          className="po-back"
          onClick={() => router.push(`/branch/bangalore/procurement/pr/${po.pr_id}`)}
          title="Back to PR"
          aria-label="Back to PR"
        >
          ← Back to PR
        </button>
        <button
          className="po-back"
          onClick={() => router.push("/branch/bangalore/dashboard")}
          title="Branch Dashboard"
          aria-label="Branch Dashboard"
          style={{ marginLeft: 6 }}
        >
          Dashboard
        </button>
      </div>

      {/* ── Body ── */}
      <div className="po-body">

        {/* ── Main column ── */}
        <div className="po-main">

          {/* Supplier selection card */}
          <div className="po-card">
            <div className="po-sec-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Select Supplier</span>
              {!existingGrnId && selectedSupplierId !== po.supplier_id && (
                <button
                  onClick={handleUpdateSupplier}
                  disabled={changingSupplier}
                  style={{
                    padding: "5px 14px", borderRadius: 7, border: "none",
                    background: changingSupplier ? "var(--border)" : "#18D8C3",
                    color: changingSupplier ? "var(--muted)" : "#0a1628",
                    fontWeight: 800, fontSize: 11, cursor: changingSupplier ? "not-allowed" : "pointer",
                  }}
                  title="Confirm supplier change" aria-label="Confirm supplier change"
                >
                  {changingSupplier ? "Updating…" : "Confirm Change"}
                </button>
              )}
            </div>
            {supplierToast && (
              <div style={{ margin: "0 0 10px", padding: "8px 12px", borderRadius: 8, background: "rgba(24,216,195,.12)", color: "#18D8C3", fontSize: 12, fontWeight: 600 }}>
                {supplierToast}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allSuppliers.length === 0 ? (
                <div className="po-supplier-card">
                  <div className="po-supplier-name">{po.supplier_name}</div>
                  <div className="po-supplier-city">📍 {po.supplier_city}</div>
                  <div className="po-chip-row">
                    <span className="po-chip reliability">★ Reliability {po.supplier_reliability.toFixed(1)}/10</span>
                    <span className={`po-chip ${riskChipClass(po.supplier_risk)}`}>⚠ Risk {po.supplier_risk.toFixed(1)}/10</span>
                    <span className="po-chip lead">AI Recommended</span>
                  </div>
                  <div className="po-reasoning">{po.ai_reasoning}</div>
                </div>
              ) : (
                allSuppliers.map(s => {
                  const isSelected = s.id === selectedSupplierId
                  const isAiPick = s.id === po.supplier_id
                  const canChange = !existingGrnId && po.status === "draft"
                  return (
                    <div
                      key={s.id}
                      onClick={() => canChange && setSelectedSupplierId(s.id)}
                      style={{
                        padding: "12px 14px", borderRadius: 10,
                        border: isSelected ? "1.5px solid #18D8C3" : "1.5px solid var(--border)",
                        background: isSelected ? "rgba(24,216,195,.06)" : "var(--card-bg)",
                        cursor: canChange ? "pointer" : "default",
                        transition: "border-color .15s, background .15s",
                        display: "flex", flexDirection: "column", gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                          border: `2px solid ${isSelected ? "#18D8C3" : "var(--border)"}`,
                          background: isSelected ? "#18D8C3" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {isSelected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0a1628" }}/>}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", flex: 1 }}>{s.name}</div>
                        {isAiPick && (
                          <span style={{ fontSize: 9, fontWeight: 800, color: "#18D8C3", border: "1px solid rgba(24,216,195,.3)", borderRadius: 5, padding: "2px 6px", letterSpacing: ".4px" }}>
                            AI PICK
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", paddingLeft: 24 }}>📍 {s.city} · {s.avg_lead_days}d lead · {s.payment_terms}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 24 }}>
                        <span className="po-chip reliability">★ {s.reliability_score.toFixed(1)}/10 reliability</span>
                        <span className={`po-chip ${riskChipClass(s.risk_score)}`}>⚠ {s.risk_score.toFixed(1)}/10 risk</span>
                      </div>
                      {isAiPick && isSelected && (
                        <div className="po-reasoning" style={{ marginTop: 4 }}>{po.ai_reasoning}</div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            {existingGrnId && (
              <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
                Supplier locked — GRN already created
              </div>
            )}
          </div>

          {/* Summary row */}
          <div className="po-summary-row">
            <div className="po-sum-card">
              <div className="po-sum-label">Total Amount</div>
              <div className="po-sum-value">{formatINR(po.total_amount)}</div>
              <div className="po-sum-sub">INR estimated</div>
            </div>
            <div className="po-sum-card">
              <div className="po-sum-label">Items</div>
              <div className="po-sum-value">{po.items.length}</div>
              <div className="po-sum-sub">SKUs in this PO</div>
            </div>
            <div className="po-sum-card">
              <div className="po-sum-label">Expected Delivery</div>
              <div className="po-sum-value" style={{ fontSize: 13 }}>
                {po.expected_date ? new Date(po.expected_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </div>
              <div className="po-sum-sub">from supplier</div>
            </div>
            <div className="po-sum-card">
              <div className="po-sum-label">Status</div>
              <div className="po-sum-value" style={{ fontSize: 13, textTransform: "capitalize" }}>{po.status}</div>
              <div className="po-sum-sub">draft PO</div>
            </div>
          </div>

          {/* Items table */}
          <div className="po-card">
            <div className="po-sec-head">Line Items</div>
            <div className="po-table-wrap">
              <table className="po-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Qty</th>
                    <th>Unit Cost</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item, i) => (
                    <tr key={i}>
                      <td className="po-sku">{item.sku}</td>
                      <td style={{ fontWeight: 600, maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</td>
                      <td style={{ fontSize: 11, color: "var(--muted)" }}>{item.category}</td>
                      <td style={{ fontWeight: 700 }}>{item.quantity}</td>
                      <td>{formatINR(item.unit_cost)}</td>
                      <td style={{ fontWeight: 700 }}>{formatINR(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: "right", padding: "12px 10px 0", fontSize: 13, fontWeight: 800, color: "var(--text)" }}>
              Total: {formatINR(po.total_amount)}
            </div>
          </div>

        </div>{/* /po-main */}

        {/* ── Sidebar ── */}
        <div className="po-side">

          {/* PO number + status */}
          <div className="po-card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Purchase Order</div>
            <div className="po-num">{po.po_number}</div>
            <div style={{ marginTop: 8 }}>
              <span className={`po-badge ${po.status}`}>{po.status.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--light)", marginTop: 8 }}>
              Created {new Date(po.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>

          {/* What happens next */}
          <div className="po-card">
            <div className="po-sec-head">What Happens Next</div>
            <div className="po-next-steps">
              {nextSteps.map(s => (
                <div key={s.step} style={{ display: "flex", gap: 10, alignItems: "flex-start", opacity: (s.active || s.done) ? 1 : 0.4 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: s.done ? "#22C55E" : s.active ? s.color : "var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, color: "#fff", fontSize: 10, fontWeight: 800,
                  }}>{s.done ? "✓" : s.step}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{s.sub}</div>
                  </div>
                  {s.active && !s.done && (
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: s.color, flexShrink: 0, marginTop: 8,
                      animation: "po-pulse 1.5s ease-in-out infinite",
                    }}/>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              {existingGrnId ? (
                <button
                  onClick={() => router.push(`/branch/bangalore/procurement/grn/${existingGrnId}`)}
                  style={{
                    width: "100%", padding: "9px 0", borderRadius: 8, border: "none",
                    background: "#18D8C3", color: "#0a1628", fontWeight: 800, fontSize: 12, cursor: "pointer",
                  }}
                  title="View GRN" aria-label="View GRN"
                >
                  View GRN →
                </button>
              ) : (
                <button
                  onClick={handleCreateGRN}
                  disabled={creatingGrn}
                  style={{
                    width: "100%", padding: "9px 0", borderRadius: 8, border: "none",
                    background: creatingGrn ? "var(--border)" : "#18D8C3",
                    color: creatingGrn ? "var(--muted)" : "#0a1628",
                    fontWeight: 800, fontSize: 12, cursor: creatingGrn ? "not-allowed" : "pointer",
                  }}
                  title="Create GRN" aria-label="Create GRN"
                >
                  {creatingGrn ? "Creating GRN…" : "▶ Create GRN"}
                </button>
              )}
            </div>
          </div>

          {/* PR link */}
          <div className="po-card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 10, fontWeight: 600 }}>
              This PO was generated from
            </div>
            <button
              onClick={() => router.push(`/branch/bangalore/procurement/pr/${po.pr_id}`)}
              style={{
                background: "rgba(255,107,53,.1)", border: "1px solid rgba(255,107,53,.2)",
                borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 700,
                color: "var(--o2)", cursor: "pointer", width: "100%",
              }}
              title="View source PR"
              aria-label="View source PR"
            >
              ← View Source PR
            </button>
          </div>

        </div>{/* /po-side */}
      </div>{/* /po-body */}

    </div>
  )
}
