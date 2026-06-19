"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import "./blr-pr.css"

interface PRItem {
  sku:           string
  name:          string
  category:      string
  current_qty:   number
  reorder_point: number
  suggested_qty: number
  unit_cost:     number
  line_total:    number
}

interface PRResult {
  id:                    string
  pr_number:             string
  workflow_id:           string
  warehouse_id:          string
  status:                string
  total_estimated_value: number
  approval_level:        string
  approver_role:         string
  items:                 PRItem[]
  escalation_deadline:   string
  created_at:            string
  notes:                 string
}

const WAREHOUSE_IDS: Record<string, string> = {
  bangalore: "531e5c42-e4a1-4db0-a35c-a434f3b94344",
}

function formatINR(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000)   return `₹${(val / 100000).toFixed(2)}L`
  if (val >= 1000)     return `₹${(val / 1000).toFixed(1)}K`
  return `₹${val.toFixed(0)}`
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    WAREHOUSE_MANAGER: "Warehouse Manager",
    OPERATIONS_HEAD:   "Operations Head",
    FINANCE_CONTROLLER:"Finance Controller",
    CEO:               "CEO",
    CEO_AND_FINANCE:   "CEO + Finance Controller",
  }
  return map[role] ?? role
}

function statusCls(status: string): string {
  const map: Record<string, string> = {
    PENDING:           "pending",
    APPROVED:          "approved",
    REJECTED:          "rejected",
    CHANGES_REQUESTED: "changes",
    RESUBMITTED:       "resubmit",
  }
  return map[status] ?? "pending"
}

export default function BranchPRPage() {
  const router = useRouter()
  const params = useParams()
  const branch = (params?.branch as string) ?? "bangalore"

  const warehouseId = WAREHOUSE_IDS[branch.toLowerCase()] ?? WAREHOUSE_IDS.bangalore

  // Items pre-filled from sessionStorage (reorder_alerts from inventory analysis)
  const [items,    setItems]    = useState<PRItem[]>([])
  const [notes,    setNotes]    = useState("")
  const [pr,       setPr]       = useState<PRResult | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [toast,    setToast]    = useState("")
  const [hasData,  setHasData]  = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3500)
  }

  // Load reorder_alerts from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("blr_pr_analysis")
      if (!raw) return
      const analysis = JSON.parse(raw)
      const alerts: object[] = Array.isArray(analysis?.reorder_alerts) ? analysis.reorder_alerts : []
      if (alerts.length === 0) return

      const built: PRItem[] = (alerts as Record<string, unknown>[]).map((a) => {
        const unit_cost    = Number(a.unit_cost ?? 0)
        const suggested_qty = Number(a.reorder_qty ?? a.suggested_qty ?? 0)
        return {
          sku:           String(a.sku ?? ""),
          name:          String(a.name ?? ""),
          category:      String(a.category ?? ""),
          current_qty:   Number(a.quantity ?? a.current_qty ?? 0),
          reorder_point: Number(a.reorder_point ?? 0),
          suggested_qty,
          unit_cost,
          line_total:    parseFloat((unit_cost * suggested_qty).toFixed(2)),
        }
      })
      setItems(built)
      setHasData(true)
    } catch {
      // sessionStorage not available
    }
  }, [])

  const updateQty = (idx: number, val: string) => {
    const qty = Math.max(0, parseInt(val) || 0)
    setItems(prev => prev.map((it, i) =>
      i === idx
        ? { ...it, suggested_qty: qty, line_total: parseFloat((it.unit_cost * qty).toFixed(2)) }
        : it
    ))
  }

  const total = items.reduce((s, it) => s + it.line_total, 0)

  const generatePR = async () => {
    if (items.length === 0) { showToast("No items to generate PR for"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/procurement/pr", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_id:   warehouseId,
          reorder_alerts: items.map(it => ({
            sku:           it.sku,
            name:          it.name,
            category:      it.category,
            quantity:      it.current_qty,
            reorder_point: it.reorder_point,
            reorder_qty:   it.suggested_qty,
            unit_cost:     it.unit_cost,
          })),
          requested_by: "branch_manager",
          notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Failed to generate PR")
      setPr(data)
      showToast(`PR ${data.pr_number} generated successfully`)
      sessionStorage.removeItem("blr_pr_analysis")
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "PR generation failed")
    } finally {
      setLoading(false)
    }
  }

  const submitForApproval = async () => {
    if (!pr) return
    setLoading(true)
    try {
      const res = await fetch(`/api/procurement/pr/${pr.id}/resubmit`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acted_by: "branch_manager", acted_by_role: "BRANCH_MANAGER", notes: "Submitted for approval" }),
      })
      if (!res.ok) {
        // PENDING can't resubmit — that's fine, it's already in approval queue
        showToast("PR is already submitted for approval")
      } else {
        showToast("PR submitted for approval")
      }
    } catch {
      showToast("Submit failed")
    } finally {
      setLoading(false)
    }
  }

  const now = new Date()
  const dateStr = now.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })

  return (
    <div className="nexora-pr">

      {/* Topbar */}
      <div className="pr-topbar">
        <span className="pr-tb-logo">NEXORA</span>
        <div className="pr-tb-sep" />
        <div>
          <div className="pr-tb-title">Procurement · Bangalore</div>
          <div className="pr-tb-sub">Purchase Requisition</div>
        </div>
        <div className="pr-tb-spacer" />
        <button className="pr-back" onClick={() => router.push(`/branch/${branch}/inventory`)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Inventory
        </button>
      </div>

      {/* Body */}
      <div className="pr-body">

        {/* PR Header Card */}
        <div className="pr-header-card">
          <div className="pr-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <div className="pr-header-info">
            <div className="pr-header-title">
              {pr ? "Purchase Requisition Generated" : "AI-Generated Purchase Requisition"}
            </div>
            <div className="pr-header-sub">
              {pr
                ? "Review and submit for approval"
                : `${items.length} item${items.length !== 1 ? "s" : ""} from inventory analysis · ${dateStr}`}
            </div>
          </div>
          {pr && (
            <div className="pr-meta">
              <span className="pr-num">{pr.pr_number}</span>
              <span className="pr-wf">| {pr.workflow_id}</span>
              <span className={`pr-status ${statusCls(pr.status)}`}>{pr.status}</span>
            </div>
          )}
        </div>

        {/* Success Banner (after generation) */}
        {pr && (
          <div className="pr-success-banner">
            <div className="pr-success-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <div className="pr-success-title">{pr.pr_number} created — PENDING approval</div>
              <div className="pr-success-sub">
                Requires {roleLabel(pr.approver_role)} · Deadline: {pr.escalation_deadline ? new Date(pr.escalation_deadline).toLocaleString("en-IN") : "48 hours"}
              </div>
            </div>
          </div>
        )}

        {/* Main Layout */}
        <div className="pr-layout">

          {/* Items Table */}
          <div className="pr-table-card">
            <div className="pr-table-head">
              <div className="pr-table-head-dot" />
              Reorder Items ({items.length})
            </div>
            {items.length === 0 ? (
              <div className="pr-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".4">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                No reorder alerts — run inventory analysis first
              </div>
            ) : (
              <table className="pr-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th style={{ textAlign: "right" }}>Current</th>
                    <th style={{ textAlign: "right" }}>Reorder Pt.</th>
                    <th style={{ textAlign: "center" }}>Qty to Order</th>
                    <th style={{ textAlign: "right" }}>Unit Cost</th>
                    <th style={{ textAlign: "right" }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.sku}>
                      <td style={{ color: "var(--muted)", fontSize: 11 }}>{i + 1}</td>
                      <td>
                        <div className="pr-name">{it.name}</div>
                        <div className="pr-sku">{it.sku} · {it.category}</div>
                      </td>
                      <td className="pr-num-cell">
                        <span className="pr-current">{it.current_qty}</span>
                      </td>
                      <td className="pr-num-cell">
                        <span className="pr-reorder">{it.reorder_point}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="number"
                          min={1}
                          className="pr-qty-input"
                          value={it.suggested_qty ?? ""}
                          disabled={!!pr}
                          onChange={e => updateQty(i, e.target.value)}
                        />
                      </td>
                      <td className="pr-num-cell" style={{ color: "var(--muted)" }}>
                        ₹{it.unit_cost.toLocaleString("en-IN")}
                      </td>
                      <td className="pr-line-total">
                        {formatINR(it.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Sidebar */}
          <div className="pr-sidebar">
            <div className="pr-summary-card">
              <div className="pr-summary-head">PR Summary</div>
              <div className="pr-summary-row">
                <span className="pr-summary-label">Items</span>
                <span className="pr-summary-val">{items.length}</span>
              </div>
              <div className="pr-summary-row">
                <span className="pr-summary-label">Est. Value</span>
                <span className="pr-summary-val big">{formatINR(pr ? pr.total_estimated_value : total)}</span>
              </div>
              {pr && (
                <>
                  <div className="pr-summary-row">
                    <span className="pr-summary-label">Approval Level</span>
                    <span className="pr-summary-val">{pr.approval_level}</span>
                  </div>
                  <div className="pr-summary-row">
                    <span className="pr-summary-label">Requires</span>
                    <span className="pr-summary-val approver">{roleLabel(pr.approver_role)}</span>
                  </div>
                </>
              )}
              {!pr && total > 0 && (
                <div className="pr-summary-row">
                  <span className="pr-summary-label">Approver*</span>
                  <span className="pr-summary-val" style={{ fontSize: 11, color: "var(--muted)" }}>
                    {total <= 500000 ? "Warehouse Manager"
                      : total <= 2500000 ? "Operations Head"
                      : total <= 5000000 ? "Finance Controller"
                      : total <= 10000000 ? "CEO"
                      : "CEO + Finance"}
                  </span>
                </div>
              )}
            </div>

            {pr?.escalation_deadline && (
              <div className="pr-deadline-card">
                <div className="pr-deadline-label">HITL Deadline</div>
                <div className="pr-deadline-val">
                  {new Date(pr.escalation_deadline).toLocaleString("en-IN", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="pr-notes-card">
          <div className="pr-notes-label">Notes (optional)</div>
          <textarea
            className="pr-notes-input"
            placeholder="Add any notes for the approver…"
            value={notes ?? ""}
            disabled={!!pr}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

      </div>{/* /pr-body */}

      {/* Action Bar */}
      <div className="pr-action-bar">
        <button className="pr-btn ghost" onClick={() => router.push(`/branch/${branch}/inventory`)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <div className="pr-spacer" />
        {!pr ? (
          <button
            className="pr-btn primary"
            disabled={loading || items.length === 0}
            onClick={generatePR}
          >
            {loading ? (
              <span className="pr-loading-dot" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            )}
            Generate PR
          </button>
        ) : (
          <button
            className="pr-btn success"
            disabled={loading}
            onClick={submitForApproval}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="22 2 11 13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Submit for Approval
          </button>
        )}
      </div>

      {toast && <div className="pr-toast">{toast}</div>}
    </div>
  )
}
