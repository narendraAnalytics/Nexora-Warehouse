"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import "./blr-grn.css"

interface GRNItem {
  sku:        string
  name:       string
  category:   string
  quantity:   number
  unit_cost:  number
  line_total: number
}

interface GRNDetail {
  id:                   string
  grn_number:           string
  po_id:                string
  po_number:            string
  warehouse_id:         string
  received_by:          string
  status:               string
  items:                GRNItem[]
  total_received_value: number
  notes:                string | null
  received_at:          string
  created_at:           string
  supplier_name:        string
  supplier_city:        string
}

interface PaymentResult {
  id:             string
  payment_number: string
  amount:         number
  status:         string
}

function formatINR(val: number): string {
  if (val >= 1e7) return `₹${(val / 1e7).toFixed(2)} Cr`
  if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)}L`
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`
  return `₹${Math.round(val).toLocaleString("en-IN")}`
}

export default function BranchGRNDetailPage() {
  const router = useRouter()
  const params = useParams()
  const grnId = params?.id as string

  const [grn, setGRN] = useState<GRNDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [payment, setPayment] = useState<PaymentResult | null>(null)

  useEffect(() => {
    if (!grnId) return
    fetch(`/api/procurement/grn/${grnId}`)
      .then(r => r.json())
      .then((d: GRNDetail) => {
        setGRN(d)
        // Check for existing payment (GET — do NOT POST on load)
        return fetch(`/api/procurement/payment?grn_id=${grnId}`)
      })
      .then(r => r.json())
      .then((payments: PaymentResult[]) => {
        if (Array.isArray(payments) && payments.length > 0) setPayment(payments[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [grnId])

  async function handleRecordPayment() {
    setRecordingPayment(true)
    try {
      const res = await fetch(`/api/procurement/grn/${grnId}/payment`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) { alert(data.detail ?? "Failed to record payment"); return }
      setPayment(data)
    } finally {
      setRecordingPayment(false)
    }
  }

  if (loading) {
    return (
      <div className="nexora-grn">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", gap: 12 }}>
          <div style={{ width: 20, height: 20, border: "2px solid #18D8C3", borderTopColor: "transparent", borderRadius: "50%", animation: "grn-pulse 1s linear infinite" }} />
          <span style={{ color: "#8899aa", fontSize: 13 }}>Loading Goods Receipt…</span>
        </div>
      </div>
    )
  }
  if (!grn) {
    return (
      <div className="nexora-grn">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#8899aa" }}>
          GRN not found.
        </div>
      </div>
    )
  }

  const nextSteps = [
    { step: 1, label: "Goods Receipt",      sub: "Items received & inspected",    done: true,          active: false, color: "#22C55E" },
    { step: 2, label: "Record Payment",     sub: "Confirm supplier payment",       done: !!payment,     active: !payment, color: "#18D8C3" },
    { step: 3, label: "Finance Verification", sub: "Finance records updated",      done: false,         active: false, color: "#A855F7" },
  ]

  return (
    <div className="nexora-grn">

      {/* ── Topbar ── */}
      <div className="grn-topbar">
        <div className="grn-logo">NEXORA</div>
        <div className="grn-sep" />
        <div className="grn-title">Goods Receipt</div>
        <div className="grn-spacer" />
        <button
          className="grn-back"
          onClick={() => router.push(`/branch/bangalore/procurement/po/${grn.po_id}`)}
          title="Back to PO" aria-label="Back to PO"
        >
          ← Back to PO
        </button>
        <button
          className="grn-back"
          onClick={() => router.push("/branch/bangalore/dashboard")}
          title="Branch Dashboard" aria-label="Branch Dashboard"
          style={{ marginLeft: 6 }}
        >
          Dashboard
        </button>
      </div>

      {/* ── Body ── */}
      <div className="grn-body">

        {/* ── Main column ── */}
        <div className="grn-main">

          {/* Supplier card */}
          <div className="grn-card">
            <div className="grn-sec-head">Supplier</div>
            <div>
              <div className="grn-supplier-name">{grn.supplier_name}</div>
              <div className="grn-supplier-city">📍 {grn.supplier_city}</div>
            </div>
            <div className="grn-chip-row">
              <span className="grn-chip grn-tag">Goods Receipt Note</span>
              <span className="grn-chip completed">✓ Received</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              PO Reference: <span style={{ color: "var(--teal)", fontWeight: 700, fontFamily: "monospace" }}>{grn.po_number}</span>
            </div>
          </div>

          {/* Summary row */}
          <div className="grn-summary-row">
            <div className="grn-sum-card">
              <div className="grn-sum-label">Total Value</div>
              <div className="grn-sum-value">{formatINR(grn.total_received_value)}</div>
              <div className="grn-sum-sub">INR received</div>
            </div>
            <div className="grn-sum-card">
              <div className="grn-sum-label">Items</div>
              <div className="grn-sum-value">{grn.items.length}</div>
              <div className="grn-sum-sub">SKUs received</div>
            </div>
            <div className="grn-sum-card">
              <div className="grn-sum-label">Received On</div>
              <div className="grn-sum-value" style={{ fontSize: 13 }}>
                {grn.received_at ? new Date(grn.received_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </div>
              <div className="grn-sum-sub">date received</div>
            </div>
            <div className="grn-sum-card">
              <div className="grn-sum-label">Status</div>
              <div className="grn-sum-value" style={{ fontSize: 13, textTransform: "capitalize" }}>{grn.status}</div>
              <div className="grn-sum-sub">receipt status</div>
            </div>
          </div>

          {/* Items table */}
          <div className="grn-card">
            <div className="grn-sec-head">Received Line Items</div>
            <div className="grn-table-wrap">
              <table className="grn-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Qty Received</th>
                    <th>Unit Cost</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {grn.items.map((item, i) => (
                    <tr key={i}>
                      <td className="grn-sku">{item.sku}</td>
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
              Total: {formatINR(grn.total_received_value)}
            </div>
          </div>

        </div>{/* /grn-main */}

        {/* ── Sidebar ── */}
        <div className="grn-side">

          {/* GRN number + status */}
          <div className="grn-card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>
              Goods Receipt Note
            </div>
            <div className="grn-num">{grn.grn_number}</div>
            <div style={{ marginTop: 8 }}>
              <span className={`grn-badge ${payment ? "paid" : "completed"}`}>
                {payment ? "PAID" : "COMPLETED"}
              </span>
            </div>
            <div style={{ fontSize: 10, color: "var(--light)", marginTop: 8 }}>
              Received {new Date(grn.received_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>

          {/* What happens next */}
          <div className="grn-card">
            <div className="grn-sec-head">What Happens Next</div>
            <div className="grn-next-steps">
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
                      animation: "grn-pulse 1.5s ease-in-out infinite",
                    }} />
                  )}
                </div>
              ))}
            </div>

            {/* Payment button / success chip */}
            {payment ? (
              <div className="grn-pay-success">
                ✓ Payment Recorded — <span style={{ fontFamily: "monospace" }}>{payment.payment_number}</span>
              </div>
            ) : (
              <button
                className="grn-pay-btn"
                onClick={handleRecordPayment}
                disabled={recordingPayment}
                title="Record Payment" aria-label="Record Payment"
              >
                {recordingPayment ? "Recording…" : "▶ Record Payment"}
              </button>
            )}
          </div>

          {/* PO link */}
          <div className="grn-card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 10, fontWeight: 600 }}>
              This GRN was generated from
            </div>
            <button
              onClick={() => router.push(`/branch/bangalore/procurement/po/${grn.po_id}`)}
              style={{
                background: "rgba(24,216,195,.1)", border: "1px solid rgba(24,216,195,.2)",
                borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 700,
                color: "var(--teal)", cursor: "pointer", width: "100%",
              }}
              title="View source PO" aria-label="View source PO"
            >
              ← View Source PO
            </button>
          </div>

        </div>{/* /grn-side */}
      </div>{/* /grn-body */}

    </div>
  )
}
