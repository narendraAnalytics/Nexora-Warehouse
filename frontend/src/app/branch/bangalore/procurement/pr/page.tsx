"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import "./blr-pr.css"

interface PRItem {
  sku:                 string
  name:                string
  category:            string
  brand:               string
  current_qty:         number
  reorder_point:       number
  agent_suggested_qty: number
  manager_qty:         number
  unit_cost:           number
  unit_price:          number
  line_total:          number
  comment:             string
  is_manual?:          boolean
}

interface NewRow {
  sku: string; name: string; category: string
  manager_qty: string; unit_cost: string
}

interface PRResult {
  id:                    string
  pr_number:             string
  workflow_id:           string
  status:                string
  total_estimated_value: number
  approval_level:        string
  approver_role:         string
  escalation_deadline:   string
}

const WAREHOUSE_IDS: Record<string, string> = {
  bangalore: "531e5c42-e4a1-4db0-a35c-a434f3b94344",
}

function formatINR(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`
  if (val >= 100000)   return `₹${(val / 100000).toFixed(2)}L`
  if (val >= 1000)     return `₹${(val / 1000).toFixed(1)}K`
  return `₹${Math.round(val).toLocaleString("en-IN")}`
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    WAREHOUSE_MANAGER:  "Warehouse Manager",
    OPERATIONS_HEAD:    "Operations Head",
    FINANCE_CONTROLLER: "Finance Controller",
    CEO:                "CEO",
    CEO_AND_FINANCE:    "CEO + Finance Controller",
  }
  return map[role] ?? role
}

function approverFromTotal(total: number): string {
  if (total <= 500000)   return "Warehouse Manager"
  if (total <= 2500000)  return "Operations Head"
  if (total <= 5000000)  return "Finance Controller"
  if (total <= 10000000) return "CEO"
  return "CEO + Finance Controller"
}

function statusCls(s: string) {
  return s === "APPROVED" ? "approved" : s === "REJECTED" ? "rejected" : s === "CHANGES_REQUESTED" ? "changes" : "pending"
}

const BLANK_NEW_ROW: NewRow = { sku: "", name: "", category: "", manager_qty: "", unit_cost: "" }

export default function BranchPRPage() {
  const router  = useRouter()
  const params  = useParams()
  const branch  = (params?.branch as string) ?? "bangalore"
  const wid     = WAREHOUSE_IDS[branch.toLowerCase()] ?? WAREHOUSE_IDS.bangalore

  const [items,      setItems]      = useState<PRItem[]>([])
  const [notes,      setNotes]      = useState("")
  const [pr,         setPr]         = useState<PRResult | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [toast,      setToast]      = useState("")
  const [analysisAt, setAnalysisAt] = useState("")
  const [addingRow,  setAddingRow]  = useState(false)
  const [newRow,     setNewRow]     = useState<NewRow>(BLANK_NEW_ROW)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500) }

  // Load reorder_alerts from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("blr_pr_analysis")
      if (!raw) return
      const analysis = JSON.parse(raw) as { reorder_alerts?: Record<string, unknown>[]; ran_at?: string }
      const alerts = Array.isArray(analysis?.reorder_alerts) ? analysis.reorder_alerts : []
      if (alerts.length === 0) return
      setAnalysisAt(analysis.ran_at ?? new Date().toLocaleTimeString())
      setItems(alerts.map(a => {
        const unit_cost           = Number(a.unit_cost ?? 0)
        const agent_suggested_qty = Number(a.reorder_qty ?? a.agent_suggested_qty ?? 0)
        const manager_qty         = agent_suggested_qty
        return {
          sku:                 String(a.sku ?? ""),
          name:                String(a.name ?? ""),
          category:            String(a.category ?? ""),
          brand:               String(a.brand ?? ""),
          current_qty:         Number(a.quantity ?? a.current_qty ?? 0),
          reorder_point:       Number(a.reorder_point ?? 0),
          agent_suggested_qty,
          manager_qty,
          unit_cost,
          unit_price:          Number(a.unit_price ?? 0),
          line_total:          parseFloat((unit_cost * manager_qty).toFixed(2)),
          comment:             "",
        }
      }))
    } catch { /* sessionStorage unavailable */ }
  }, [])

  const updateQty = (idx: number, val: string) => {
    const qty = Math.max(0, parseInt(val) || 0)
    setItems(prev => prev.map((it, i) =>
      i === idx ? { ...it, manager_qty: qty, line_total: parseFloat((it.unit_cost * qty).toFixed(2)) } : it
    ))
  }

  const updateComment = (idx: number, val: string) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, comment: val } : it))

  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx))

  const confirmAddRow = () => {
    const qty  = Math.max(0, parseInt(newRow.manager_qty) || 0)
    const cost = parseFloat(newRow.unit_cost) || 0
    if (!newRow.name.trim()) { showToast("Product name required"); return }
    setItems(prev => [...prev, {
      sku:                 newRow.sku.trim() || "MANUAL",
      name:                newRow.name.trim(),
      category:            newRow.category.trim() || "Other",
      brand:               "",
      current_qty:         0,
      reorder_point:       0,
      agent_suggested_qty: 0,
      manager_qty:         qty,
      unit_cost:           cost,
      unit_price:          cost,
      line_total:          parseFloat((cost * qty).toFixed(2)),
      comment:             "",
      is_manual:           true,
    }])
    setNewRow(BLANK_NEW_ROW)
    setAddingRow(false)
  }

  const total = items.reduce((s, it) => s + it.line_total, 0)

  const generatePR = async () => {
    if (items.length === 0) { showToast("No items to generate PR for"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/procurement/pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouse_id:   wid,
          reorder_alerts: items.map(it => ({
            sku:             it.sku,
            name:            it.name,
            category:        it.category,
            brand:           it.brand,
            quantity:        it.current_qty,
            reorder_point:   it.reorder_point,
            reorder_qty:     it.agent_suggested_qty,
            manager_qty:     it.manager_qty,
            unit_cost:       it.unit_cost,
            unit_price:      it.unit_price,
            manager_comment: it.comment,
          })),
          requested_by: "branch_manager",
          notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "PR generation failed")
      setPr(data)
      showToast(`${data.pr_number} generated successfully`)
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
      await fetch(`/api/procurement/pr/${pr.id}/resubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acted_by: "branch_manager", acted_by_role: "BRANCH_MANAGER", notes: "Submitted for approval" }),
      })
      showToast("PR submitted for approval")
    } catch {
      showToast("PR is already in the approval queue")
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

  return (
    <div className="nexora-pr">

      {/* ── Topbar ── */}
      <div className="pr-topbar">
        <span className="pr-tb-logo">NEXORA</span>
        <div className="pr-tb-sep" />
        <div>
          <div className="pr-tb-title">Procurement · Bangalore</div>
          <div className="pr-tb-sub">Purchase Requisition</div>
        </div>
        <div className="pr-tb-spacer" />
        <button className="pr-back" onClick={() => router.push(`/branch/${branch}/inventory`)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Inventory
        </button>
      </div>

      {/* ── Body ── */}
      <div className="pr-body">

        {/* AI Source Card */}
        <div className="pr-source-card">
          <div className="pr-source-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <div className="pr-source-info">
            <div className="pr-source-title">Generated by Inventory Intelligence Agent</div>
            <div className="pr-source-sub">AI-powered reorder analysis · Human review required before submission</div>
            <div className="pr-source-pills">
              <span className="pr-pill">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Analysis: {analysisAt || today}
              </span>
              <span className="pr-pill">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>
                {items.length} Product{items.length !== 1 ? "s" : ""} Suggested
              </span>
              <span className={`pr-pill ${total > 0 ? "green" : ""}`}>
                Est. Value: {formatINR(total)}
              </span>
              {total > 0 && (
                <span className="pr-pill indigo">
                  Approver: {approverFromTotal(total)}
                </span>
              )}
              {pr && <span className={`pr-status ${statusCls(pr.status)}`}>{pr.status}</span>}
            </div>
          </div>
        </div>

        {/* Success Banner */}
        {pr && (
          <div className="pr-success-banner">
            <div className="pr-success-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div className="pr-success-title">{pr.pr_number} · Purchase Requisition Created</div>
              <div className="pr-success-meta">
                <span className="pr-success-kv"><strong>Workflow:</strong> {pr.workflow_id}</span>
                <span className="pr-success-kv"><strong>Approval:</strong> {pr.approval_level} — {roleLabel(pr.approver_role)}</span>
                <span className="pr-success-kv"><strong>Value:</strong> {formatINR(pr.total_estimated_value)}</span>
                {pr.escalation_deadline && (
                  <span className="pr-success-kv"><strong>Deadline:</strong> {new Date(pr.escalation_deadline).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}</span>
                )}
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
              <div className="pr-table-head-spacer" />
              {!pr && (
                <button className="pr-add-row-btn" onClick={() => setAddingRow(true)}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Item
                </button>
              )}
            </div>

            {items.length === 0 && !addingRow ? (
              <div className="pr-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".35"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                No reorder alerts — run Inventory Analysis first
              </div>
            ) : (
              <table className="pr-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>#</th>
                    <th>Product</th>
                    <th className="center" style={{ width: 66 }}>Current<br/>Stock</th>
                    <th className="center" style={{ width: 72 }}>Agent<br/>Qty 🔒</th>
                    <th className="center" style={{ width: 80 }}>Manager<br/>Qty ✏</th>
                    <th className="right"  style={{ width: 90 }}>Unit Cost</th>
                    <th className="right"  style={{ width: 96 }}>Line Total</th>
                    <th style={{ width: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={`${it.sku}-${i}`}>
                      <td style={{ color: "var(--muted)", fontSize: 10 }}>{i + 1}</td>
                      <td>
                        <div className="pr-prod-name">{it.name}</div>
                        <div className="pr-prod-meta">
                          {it.sku}{it.brand ? ` · ${it.brand}` : ""} · {it.category}
                          {it.is_manual && <span style={{ color: "var(--amber)", marginLeft: 4, fontSize: 9, fontWeight: 700 }}>MANUAL</span>}
                        </div>
                        <textarea
                          className="pr-prod-comment"
                          rows={1}
                          placeholder="Comment (optional)…"
                          value={it.comment ?? ""}
                          disabled={!!pr}
                          onChange={e => updateComment(i, e.target.value)}
                        />
                      </td>
                      <td className="center">
                        <span style={{ fontSize: 12, fontWeight: 700, color: it.current_qty <= it.reorder_point ? "var(--red)" : "var(--text)" }}>
                          {it.current_qty}
                        </span>
                        {it.reorder_point > 0 && (
                          <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 1 }}>min {it.reorder_point}</div>
                        )}
                      </td>
                      <td className="center">
                        <span className="pr-agent-qty">{it.agent_suggested_qty || "—"}</span>
                      </td>
                      <td className="center">
                        <input
                          type="number"
                          min={1}
                          title={`Manager quantity for ${it.name}`}
                          aria-label={`Manager quantity for ${it.name}`}
                          className={`pr-qty-input${it.manager_qty !== it.agent_suggested_qty && !pr ? " pr-qty-changed" : ""}`}
                          value={it.manager_qty ?? ""}
                          disabled={!!pr}
                          onChange={e => updateQty(i, e.target.value)}
                        />
                      </td>
                      <td className="right pr-unit-cost">
                        {it.unit_cost > 0 ? `₹${it.unit_cost.toLocaleString("en-IN")}` : <span style={{ color: "var(--muted)" }}>—</span>}
                      </td>
                      <td className="right pr-line-total">
                        {it.line_total > 0 ? formatINR(it.line_total) : <span style={{ color: "var(--muted)", fontWeight: 500 }}>—</span>}
                      </td>
                      <td>
                        <button className="pr-remove-btn" disabled={!!pr} onClick={() => removeItem(i)} title="Remove item">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Add item row */}
                  {addingRow && (
                    <tr className="pr-add-item-row">
                      <td style={{ color: "var(--o1)", fontSize: 10, fontWeight: 700 }}>+</td>
                      <td>
                        <input className="pr-new-input" placeholder="Product name *" value={newRow.name} onChange={e => setNewRow(r => ({ ...r, name: e.target.value }))} />
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          <input className="pr-new-input" placeholder="SKU" style={{ width: "50%" }} value={newRow.sku} onChange={e => setNewRow(r => ({ ...r, sku: e.target.value }))} />
                          <input className="pr-new-input" placeholder="Category" style={{ width: "50%" }} value={newRow.category} onChange={e => setNewRow(r => ({ ...r, category: e.target.value }))} />
                        </div>
                      </td>
                      <td className="center" style={{ color: "var(--muted)", fontSize: 11 }}>—</td>
                      <td className="center" style={{ color: "var(--muted)", fontSize: 11 }}>—</td>
                      <td className="center">
                        <input type="number" min={1} title="Quantity to order" aria-label="Quantity to order" className="pr-qty-input" placeholder="Qty" value={newRow.manager_qty} onChange={e => setNewRow(r => ({ ...r, manager_qty: e.target.value }))} />
                      </td>
                      <td className="right">
                        <input type="number" min={0} title="Unit cost in rupees" aria-label="Unit cost in rupees" className="pr-qty-input" placeholder="₹ Cost" style={{ width: 80 }} value={newRow.unit_cost} onChange={e => setNewRow(r => ({ ...r, unit_cost: e.target.value }))} />
                      </td>
                      <td className="right" style={{ color: "var(--muted)", fontSize: 11 }}>
                        {newRow.manager_qty && newRow.unit_cost ? formatINR(parseFloat(newRow.unit_cost) * parseInt(newRow.manager_qty)) : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="pr-add-confirm-btn" onClick={confirmAddRow}>Add</button>
                          <button className="pr-remove-btn" title="Cancel adding item" aria-label="Cancel adding item" onClick={() => { setAddingRow(false); setNewRow(BLANK_NEW_ROW) }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
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
              {pr ? (
                <>
                  <div className="pr-summary-row">
                    <span className="pr-summary-label">PR Number</span>
                    <span className="pr-summary-val mono">{pr.pr_number}</span>
                  </div>
                  <div className="pr-summary-row">
                    <span className="pr-summary-label">Workflow</span>
                    <span className="pr-summary-val mono" style={{ fontSize: 10 }}>{pr.workflow_id}</span>
                  </div>
                  <div className="pr-summary-row">
                    <span className="pr-summary-label">Level</span>
                    <span className="pr-summary-val">{pr.approval_level}</span>
                  </div>
                  <div className="pr-summary-row">
                    <span className="pr-summary-label">Approver</span>
                    <span className="pr-summary-val role">{roleLabel(pr.approver_role)}</span>
                  </div>
                </>
              ) : total > 0 ? (
                <div className="pr-summary-row">
                  <span className="pr-summary-label">Approver*</span>
                  <div>
                    <span className="pr-approval-badge">{approverFromTotal(total)}</span>
                    <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 4 }}>*estimate based on value</div>
                  </div>
                </div>
              ) : null}
              <div className="pr-summary-row">
                <span className="pr-summary-label">Requested By</span>
                <span className="pr-summary-val" style={{ fontSize: 11 }}>Branch Manager</span>
              </div>
              <div className="pr-summary-row">
                <span className="pr-summary-label">Date</span>
                <span className="pr-summary-val" style={{ fontSize: 11 }}>{today}</span>
              </div>
            </div>

            {pr?.escalation_deadline && (
              <div className="pr-deadline-card">
                <div className="pr-deadline-label">HITL Escalation Deadline</div>
                <div className="pr-deadline-val">
                  {new Date(pr.escalation_deadline).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="pr-notes-card">
          <div className="pr-notes-label">Notes for Approver</div>
          <textarea
            className="pr-notes-input"
            placeholder="Add context or instructions for the approver…"
            value={notes ?? ""}
            disabled={!!pr}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

      </div>{/* /pr-body */}

      {/* Action Bar */}
      <div className="pr-action-bar">
        <button className="pr-btn ghost" onClick={() => router.push(`/branch/${branch}/inventory`)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div className="pr-spacer" />
        {!pr ? (
          <button className="pr-btn primary" disabled={loading || items.length === 0} onClick={generatePR}>
            {loading
              ? <span className="pr-dot" />
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            }
            Generate PR
          </button>
        ) : (
          <button className="pr-btn success" onClick={() => router.push(`/branch/${branch}/procurement/pr/${pr!.id}`)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View PR Details
          </button>
        )}
      </div>

      {toast && <div className="pr-toast">{toast}</div>}
    </div>
  )
}
