"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import "./blr-pr-detail.css"

// ── Types ──────────────────────────────────────────────────────────────────
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
  manager_comment:     string
}

interface HistoryRow {
  id:           string
  action:       string
  acted_by:     string | null
  acted_by_role: string | null
  notes:        string | null
  created_at:   string
}

interface PRDetail {
  id:                    string
  pr_number:             string
  workflow_id:           string
  warehouse_id:          string
  status:                string
  total_estimated_value: number
  approval_level:        string
  approver_role:         string
  requested_by:          string
  approved_by:           string | null
  approved_by_role:      string | null
  rejection_reason:      string | null
  notes:                 string
  items:                 PRItem[]
  inventory_analysis:    Record<string, unknown>
  escalation_deadline:   string
  created_at:            string
  approval_history:      HistoryRow[]
}

interface FinanceAnalysis {
  pr_value:           number
  monthly_avg_spend:  number
  total_spend_3m:     number
  impact_pct:         number | null
  recommendation:     string
  approval_level:     string
  finance_records:    number
}

type ModalAction = "approve" | "reject" | "changes" | "resubmit" | null

// ── Helpers ────────────────────────────────────────────────────────────────
function formatINR(val: number): string {
  if (val >= 1e7) return `₹${(val / 1e7).toFixed(2)} Cr`
  if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)}L`
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`
  return `₹${Math.round(val).toLocaleString("en-IN")}`
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function deadlineInfo(d: string): { label: string; urgent: boolean } {
  const ms = new Date(d).getTime() - Date.now()
  const hrs = Math.max(0, Math.floor(ms / 3600000))
  if (hrs < 1) return { label: "< 1h remaining", urgent: true }
  if (hrs < 24) return { label: `${hrs}h remaining`, urgent: true }
  const days = Math.floor(hrs / 24)
  return { label: `${days}d ${hrs % 24}h remaining`, urgent: false }
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    SUBMITTED: "Submitted",
    PENDING: "Pending Review",
    FINANCE_APPROVED: "Finance Approved",
    APPROVED: "Final Approved",
    REJECTED: "Rejected",
    CHANGES_REQUESTED: "Changes Requested",
    RESUBMITTED: "Resubmitted",
  }
  return map[action] ?? action
}

function tlDotIcon(action: string): string {
  if (action === "APPROVED" || action === "FINANCE_APPROVED") return "✓"
  if (action === "REJECTED") return "✗"
  if (action === "CHANGES_REQUESTED") return "↩"
  if (action === "RESUBMITTED") return "↑"
  return "·"
}

function recChipClass(rec: string): string {
  if (rec.startsWith("HIGH")) return "HIGH"
  if (rec.startsWith("MODERATE")) return "MODERATE"
  if (rec.startsWith("LOW")) return "LOW"
  return "UNKNOWN"
}

// ── Panel: determines which approval panel to show ────────────────────────
function approvalPanel(status: string, approverRole: string): "finance" | "ceo" | "both" | "resubmit" | "none" {
  const isL5 = approverRole === "CEO_AND_FINANCE"
  if (status === "PENDING") {
    if (isL5) return "finance"
    return "ceo"
  }
  if (status === "FINANCE_APPROVED") return "ceo"
  if (status === "CHANGES_REQUESTED" || status === "RESUBMITTED") return "resubmit"
  return "none"
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function BranchPRDetailPage() {
  const router = useRouter()
  const params = useParams()
  const prId = params?.id as string

  const [pr, setPR] = useState<PRDetail | null>(null)
  const [finance, setFinance] = useState<FinanceAnalysis | null>(null)
  const [loadingPR, setLoadingPR] = useState(true)
  const [loadingFin, setLoadingFin] = useState(false)
  const [modal, setModal] = useState<ModalAction>(null)
  const [modalNotes, setModalNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState("")

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3200)
  }

  const fetchPR = useCallback(async () => {
    if (!prId) return
    setLoadingPR(true)
    try {
      const res = await fetch(`/api/procurement/pr/${prId}`)
      if (!res.ok) throw new Error("Not found")
      const data: PRDetail = await res.json()
      setPR(data)
    } catch {
      showToast("Failed to load PR")
    } finally {
      setLoadingPR(false)
    }
  }, [prId])

  const fetchFinance = useCallback(async () => {
    if (!prId) return
    setLoadingFin(true)
    try {
      const res = await fetch(`/api/procurement/pr/${prId}/finance-analysis`)
      if (res.ok) setFinance(await res.json())
    } catch {
      // non-fatal
    } finally {
      setLoadingFin(false)
    }
  }, [prId])

  useEffect(() => {
    fetchPR()
    fetchFinance()
  }, [fetchPR, fetchFinance])

  // ── Action submission ──────────────────────────────────────────────────
  async function handleAction(action: ModalAction) {
    if (!action || !pr) return
    setSubmitting(true)
    try {
      const urlAction = action === "changes" ? "request-changes" : action
      let body: Record<string, string> = { acted_by: "ceo", acted_by_role: "CEO", notes: modalNotes }

      if (action === "approve") {
        const p = approvalPanel(pr.status, pr.approver_role)
        if (p === "finance") {
          body = { acted_by: "finance_controller", acted_by_role: "FINANCE_CONTROLLER", notes: modalNotes }
        }
      } else if (action === "reject") {
        const p = approvalPanel(pr.status, pr.approver_role)
        if (p === "finance") {
          body = { acted_by: "finance_controller", acted_by_role: "FINANCE_CONTROLLER", notes: modalNotes }
        }
      } else if (action === "changes") {
        const p = approvalPanel(pr.status, pr.approver_role)
        if (p === "finance") {
          body = { acted_by: "finance_controller", acted_by_role: "FINANCE_CONTROLLER", notes: modalNotes }
        }
      } else if (action === "resubmit") {
        body = { acted_by: pr.requested_by || "branch_manager", acted_by_role: "BRANCH_MANAGER", notes: modalNotes }
      }

      const res = await fetch(`/api/procurement/pr/${pr.id}/${urlAction}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.detail ?? "Action failed")
      } else {
        const msgs: Record<string, string> = {
          approve: "Approved successfully",
          reject: "Rejected",
          "request-changes": "Changes requested",
          resubmit: "Resubmitted for review",
        }
        showToast(msgs[urlAction] ?? "Done")
        setModal(null)
        setModalNotes("")
        await fetchPR()
      }
    } catch {
      showToast("Network error")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  if (loadingPR) {
    return (
      <div className="nexora-pr-detail">
        <div className="prd-loading"><div className="prd-spinner"/><span>Loading PR...</span></div>
      </div>
    )
  }
  if (!pr) {
    return (
      <div className="nexora-pr-detail">
        <div className="prd-loading">PR not found.</div>
      </div>
    )
  }

  const panel = approvalPanel(pr.status, pr.approver_role)
  const dl = deadlineInfo(pr.escalation_deadline)
  const totalValue = pr.total_estimated_value

  return (
    <div className="nexora-pr-detail">

      {/* ── Topbar ── */}
      <div className="prd-topbar">
        <div className="prd-logo">NEXORA</div>
        <div className="prd-sep"/>
        <div>
          <div className="prd-title">Purchase Requisition</div>
        </div>
        <div className="prd-spacer"/>
        <button className="prd-back" onClick={() => router.push("/branch/bangalore/procurement/pr")} title="Back to PR list" aria-label="Back to PR list">
          ← Back to PRs
        </button>
        <button className="prd-back" onClick={() => router.push("/dashboard")} title="Go to CEO Dashboard" aria-label="Go to CEO Dashboard" style={{ marginLeft: 6 }}>
          Dashboard
        </button>
      </div>

      {/* ── Body ── */}
      <div className="prd-body">

        {/* ── Main column ── */}
        <div className="prd-main">

          {/* Header card */}
          <div className="prd-card">
            <div className="prd-header-row">
              <div style={{ flex: 1 }}>
                <div className="prd-pr-num">{pr.pr_number}</div>
                <div className="prd-wf-id">Workflow: {pr.workflow_id} · Requested by: {pr.requested_by}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className={`prd-status-badge ${pr.status}`}>{pr.status.replace("_", " ")}</span>
                <span className={`prd-deadline${dl.urgent ? " urgent" : ""}`}>
                  {dl.urgent ? "⚠ " : "⏱ "}{dl.label}
                </span>
              </div>
            </div>

            {/* Summary row */}
            <div className="prd-summary-row" style={{ marginTop: 14 }}>
              <div className="prd-sum-card">
                <div className="prd-sum-label">Total Value</div>
                <div className="prd-sum-value">{formatINR(totalValue)}</div>
                <div className="prd-sum-sub">INR estimated</div>
              </div>
              <div className="prd-sum-card">
                <div className="prd-sum-label">Approval Level</div>
                <div className="prd-sum-value">{pr.approval_level}</div>
                <div className="prd-sum-sub">{pr.approver_role.replace(/_/g, " ")}</div>
              </div>
              <div className="prd-sum-card">
                <div className="prd-sum-label">Items</div>
                <div className="prd-sum-value">{pr.items.length}</div>
                <div className="prd-sum-sub">SKUs to reorder</div>
              </div>
              <div className="prd-sum-card">
                <div className="prd-sum-label">Created</div>
                <div className="prd-sum-value" style={{ fontSize: 12 }}>{fmtDate(pr.created_at)}</div>
                <div className="prd-sum-sub">Bangalore branch</div>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="prd-card">
            <div className="prd-sec-head">Requested Items</div>
            <div className="prd-table-wrap">
              <table className="prd-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Current Stock</th>
                    <th>Reorder Point</th>
                    <th>AI Suggested</th>
                    <th>Manager Qty</th>
                    <th>Unit Cost</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pr.items.map((item, i) => (
                    <tr key={i}>
                      <td className="prd-sku">{item.sku}</td>
                      <td style={{ fontWeight: 600, maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</td>
                      <td style={{ fontSize: 11, color: "var(--muted)" }}>{item.category}</td>
                      <td className={item.current_qty <= item.reorder_point ? "prd-stock-low" : ""}>{item.current_qty}</td>
                      <td>{item.reorder_point}</td>
                      <td style={{ color: "var(--indigo)", fontWeight: 600 }}>{item.agent_suggested_qty}</td>
                      <td className={item.manager_qty !== item.agent_suggested_qty ? "prd-qty-changed" : ""}>{item.manager_qty}</td>
                      <td>{formatINR(item.unit_cost)}</td>
                      <td style={{ fontWeight: 700 }}>{formatINR(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: "right", padding: "12px 10px 0", fontSize: 13, fontWeight: 800, color: "var(--text)" }}>
              Total: {formatINR(totalValue)}
            </div>
          </div>

          {/* Approval History */}
          <div className="prd-card">
            <div className="prd-sec-head">Approval Timeline</div>
            <div className="prd-timeline">
              {pr.approval_history.map((h, i) => (
                <div key={i} className="prd-tl-item">
                  <div className="prd-tl-dot-col">
                    <div className={`prd-tl-dot ${h.action}`}>{tlDotIcon(h.action)}</div>
                    <div className="prd-tl-line"/>
                  </div>
                  <div className="prd-tl-body">
                    <div className="prd-tl-action">{actionLabel(h.action)}</div>
                    {h.acted_by && (
                      <div className="prd-tl-by">{h.acted_by} · {h.acted_by_role?.replace(/_/g, " ")}</div>
                    )}
                    {h.notes && <div className="prd-tl-note">&ldquo;{h.notes}&rdquo;</div>}
                    <div className="prd-tl-time">{fmtDate(h.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>{/* /prd-main */}

        {/* ── Sidebar ── */}
        <div className="prd-side">

          {/* Finance Agent Analysis */}
          <div className="prd-card">
            <div className="prd-sec-head">Finance Analysis</div>
            {loadingFin ? (
              <div className="prd-loading" style={{ height: 100 }}><div className="prd-spinner"/></div>
            ) : finance ? (
              <>
                <div className="prd-finance-grid">
                  <div className="prd-fin-metric">
                    <div className="prd-fin-label">PR Value</div>
                    <div className="prd-fin-val">{formatINR(finance.pr_value)}</div>
                    <div className="prd-fin-sub">this requisition</div>
                  </div>
                  <div className="prd-fin-metric">
                    <div className="prd-fin-label">Monthly Avg Spend</div>
                    <div className="prd-fin-val">{finance.monthly_avg_spend > 0 ? formatINR(finance.monthly_avg_spend) : "—"}</div>
                    <div className="prd-fin-sub">3-month average</div>
                  </div>
                  <div className="prd-fin-metric">
                    <div className="prd-fin-label">Budget Impact</div>
                    <div className="prd-fin-val">{finance.impact_pct != null ? `${finance.impact_pct}%` : "—"}</div>
                    <div className="prd-fin-sub">of monthly avg</div>
                  </div>
                  <div className="prd-fin-metric">
                    <div className="prd-fin-label">3-Month Spend</div>
                    <div className="prd-fin-val">{formatINR(finance.total_spend_3m)}</div>
                    <div className="prd-fin-sub">{finance.finance_records} records</div>
                  </div>
                </div>
                <span className={`prd-rec-chip ${recChipClass(finance.recommendation)}`}>
                  {recChipClass(finance.recommendation)} IMPACT
                </span>
                <div className="prd-rec-text">{finance.recommendation}</div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Finance data unavailable.</div>
            )}
          </div>

          {/* Finance Controller Approval Panel */}
          {(panel === "finance") && (
            <div className="prd-card">
              <div className="prd-sec-head">Finance Controller Review</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
                This PR (₹{(pr.total_estimated_value / 1e7).toFixed(2)} Cr) requires Finance Controller approval first before it reaches the CEO.
              </div>
              <div className="prd-actions">
                <button className="prd-action-btn approve" onClick={() => setModal("approve")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Approve — Send to CEO
                </button>
                <button className="prd-action-btn changes" onClick={() => setModal("changes")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                  Request Changes
                </button>
                <button className="prd-action-btn reject" onClick={() => setModal("reject")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  Reject PR
                </button>
              </div>
            </div>
          )}

          {/* CEO Final Approval Panel */}
          {(panel === "ceo") && (
            <div className="prd-card">
              <div className="prd-sec-head">CEO Final Approval</div>
              {pr.status === "FINANCE_APPROVED" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 11, background: "rgba(34,197,94,.08)", padding: "7px 10px", borderRadius: 8, color: "#15803d", fontWeight: 600 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Finance Controller has approved
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
                {pr.status === "FINANCE_APPROVED"
                  ? "Finance analysis is complete. Your final approval converts this PR to APPROVED and triggers the Supplier Risk Agent."
                  : "Your approval is required for this requisition value."}
              </div>
              <div className="prd-actions">
                <button className="prd-action-btn approve" onClick={() => setModal("approve")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Final Approve
                </button>
                <button className="prd-action-btn changes" onClick={() => setModal("changes")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                  Request Changes
                </button>
                <button className="prd-action-btn reject" onClick={() => setModal("reject")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  Reject PR
                </button>
              </div>
            </div>
          )}

          {/* Resubmit Panel */}
          {panel === "resubmit" && (
            <div className="prd-card">
              <div className="prd-sec-head">Resubmit PR</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
                Changes were requested. Review the feedback in the timeline and resubmit when ready.
              </div>
              <div className="prd-actions">
                <button className="prd-action-btn resubmit" onClick={() => setModal("resubmit")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                  Resubmit for Review
                </button>
              </div>
            </div>
          )}

          {/* APPROVED — next-steps workflow */}
          {pr.status === "APPROVED" && (
            <div className="prd-card">
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div className="prd-status-badge APPROVED" style={{ fontSize: 13, padding: "8px 18px", display: "inline-flex" }}>
                  ✓ CEO Approved
                </div>
                {pr.approved_by && (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                    by {pr.approved_by} · {pr.approved_by_role?.replace(/_/g, " ")}
                  </div>
                )}
              </div>
              <div className="prd-sec-head">What Happens Next</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { step: 1, label: "Supplier Risk Agent", sub: "Evaluating best suppliers for PO",  active: true,  color: "#18D8C3" },
                  { step: 2, label: "Procurement Agent",   sub: "Generate Purchase Order",            active: false, color: "#FF6B35" },
                  { step: 3, label: "Send to Supplier",    sub: "PO dispatched for fulfillment",      active: false, color: "#6366F1" },
                  { step: 4, label: "GRN & Payment",       sub: "Goods receipt + invoice settlement", active: false, color: "#22C55E" },
                ].map(s => (
                  <div key={s.step} style={{ display: "flex", gap: 10, alignItems: "flex-start", opacity: s.active ? 1 : 0.4 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: s.active ? s.color : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontSize: 10, fontWeight: 800 }}>{s.step}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{s.label}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}>{s.sub}</div>
                    </div>
                    {s.active && <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, flexShrink: 0, marginTop: 8, animation: "prd-pulse 1.5s ease-in-out infinite" }}/>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REJECTED badge */}
          {pr.status === "REJECTED" && (
            <div className="prd-card" style={{ textAlign: "center", padding: 20 }}>
              <div className="prd-status-badge REJECTED" style={{ fontSize: 13, padding: "8px 18px", display: "inline-flex" }}>✗ Rejected</div>
              {pr.rejection_reason && (
                <div style={{ fontSize: 11, color: "var(--red)", marginTop: 8, fontStyle: "italic" }}>
                  &ldquo;{pr.rejection_reason}&rdquo;
                </div>
              )}
            </div>
          )}

        </div>{/* /prd-side */}
      </div>{/* /prd-body */}

      {/* ── Action Modal ── */}
      {modal && (
        <div className="prd-modal-bg" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="prd-modal">
            <div className="prd-modal-title">
              {modal === "approve" && "Confirm Approval"}
              {modal === "reject" && "Confirm Rejection"}
              {modal === "changes" && "Request Changes"}
              {modal === "resubmit" && "Resubmit PR"}
            </div>
            <div className="prd-modal-sub">
              {modal === "approve" && panel === "finance" && "You are approving as Finance Controller. This will send the PR to the CEO for final approval."}
              {modal === "approve" && panel !== "finance" && "You are giving final CEO approval. This PR will move to APPROVED status."}
              {modal === "reject" && "Provide a reason for rejection. This action cannot be undone."}
              {modal === "changes" && "Describe what changes are needed. The requester will be asked to resubmit."}
              {modal === "resubmit" && "Add notes about the changes made before resubmitting."}
            </div>
            <textarea
              value={modalNotes}
              onChange={e => setModalNotes(e.target.value)}
              placeholder={modal === "approve" ? "Optional approval note…" : "Add your notes here…"}
              title="Action notes"
              aria-label="Action notes"
            />
            <div className="prd-modal-btns">
              <button className="prd-modal-cancel" onClick={() => setModal(null)} disabled={submitting}>Cancel</button>
              <button
                className={`prd-modal-confirm ${modal}`}
                onClick={() => handleAction(modal)}
                disabled={submitting || (modal === "reject" && !modalNotes.trim())}
              >
                {submitting ? "Processing…" : modal === "approve" ? "Confirm Approval" : modal === "reject" ? "Confirm Reject" : modal === "changes" ? "Send Request" : "Resubmit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && <div className="prd-toast">{toast}</div>}

    </div>
  )
}
