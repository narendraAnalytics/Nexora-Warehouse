"""
Phase 23 — Procurement API: Purchase Requisition lifecycle endpoints.
prefix=/procurement registered in main.py
"""
import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from schemas.pr_schemas import (
    PRGenerateRequest,
    PRApprovalRequest,
    PRResponse,
    PRListItem,
    PRDetailResponse,
    PRApprovalHistoryRow,
    PRItem,
)
from tools.pr_tools import (
    create_purchase_requisition,
    update_pr_status,
    log_agent_event,
    get_pr_finance_analysis,
    get_best_supplier_for_pr,
    create_po_from_pr,
)

router = APIRouter()


def _row_to_pr_response(row: dict) -> dict:
    items = row.get("items", [])
    if isinstance(items, str):
        items = json.loads(items)
    deadline = row.get("escalation_deadline")
    return {
        "id":                    str(row["id"]),
        "pr_number":             row["pr_number"],
        "workflow_id":           row["workflow_id"],
        "warehouse_id":          str(row["warehouse_id"]),
        "status":                row["status"],
        "total_estimated_value": float(row.get("total_estimated_value") or 0),
        "approval_level":        row.get("approval_level") or "",
        "approver_role":         row.get("approver_role") or "",
        "items":                 items,
        "notes":                 row.get("notes") or "",
        "escalation_deadline":   deadline.isoformat() if deadline else "",
        "created_at":            row["created_at"].isoformat() if hasattr(row.get("created_at"), "isoformat") else str(row.get("created_at", "")),
    }


@router.post("/pr/generate", tags=["Procurement"])
async def generate_pr(body: PRGenerateRequest, request: Request):
    """Generate a Purchase Requisition from inventory analysis reorder alerts."""
    pool = request.app.state.pool
    try:
        row = await create_purchase_requisition(
            warehouse_id=body.warehouse_id,
            reorder_alerts=body.reorder_alerts,
            requested_by=body.requested_by,
            inventory_analysis={},
            notes=body.notes,
            pool=pool,
        )
        result = _row_to_pr_response(row)
        await log_agent_event(
            workflow_id=row["workflow_id"],
            agent_name="procurement_api",
            event_type="PR_GENERATED",
            payload={"pr_number": row["pr_number"], "items_count": len(result["items"])},
            pool=pool,
            pr_id=str(row["id"]),
        )
        return JSONResponse(content=result, status_code=201)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pr", tags=["Procurement"])
async def list_prs(request: Request, warehouse_id: str | None = None, status: str | None = None):
    """List PRs filtered by warehouse_id and/or status."""
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        query = """
            SELECT id, pr_number, workflow_id, warehouse_id, status,
                   total_estimated_value, approval_level, approver_role,
                   requested_by, escalation_deadline, created_at
            FROM purchase_requisitions
            WHERE ($1::uuid IS NULL OR warehouse_id = $1::uuid)
              AND ($2::text IS NULL OR status = $2)
            ORDER BY created_at DESC
            LIMIT 100
        """
        rows = await conn.fetch(query, warehouse_id, status)

    result = []
    for r in rows:
        deadline = r["escalation_deadline"]
        result.append({
            "id":                    str(r["id"]),
            "pr_number":             r["pr_number"],
            "workflow_id":           r["workflow_id"],
            "warehouse_id":          str(r["warehouse_id"]),
            "status":                r["status"],
            "total_estimated_value": float(r.get("total_estimated_value") or 0),
            "approval_level":        r.get("approval_level") or "",
            "approver_role":         r.get("approver_role") or "",
            "requested_by":          r.get("requested_by") or "",
            "escalation_deadline":   deadline.isoformat() if deadline else "",
            "created_at":            r["created_at"].isoformat(),
        })
    return result


@router.get("/pr/{pr_id}", tags=["Procurement"])
async def get_pr(pr_id: str, request: Request):
    """Get a single PR with full detail and approval history."""
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT id, pr_number, workflow_id, warehouse_id, status,
                   total_estimated_value, approval_level, approver_role,
                   requested_by, approved_by, approved_by_role, rejection_reason,
                   notes, inventory_analysis, items, escalation_deadline, created_at
            FROM purchase_requisitions WHERE id = $1
        """, pr_id)
        if not row:
            raise HTTPException(status_code=404, detail="PR not found")

        history_rows = await conn.fetch("""
            SELECT id, action, acted_by, acted_by_role, notes, created_at
            FROM pr_approval_history WHERE pr_id = $1 ORDER BY created_at ASC
        """, pr_id)

    items = row["items"]
    if isinstance(items, str):
        items = json.loads(items)
    inv_analysis = row["inventory_analysis"]
    if isinstance(inv_analysis, str):
        inv_analysis = json.loads(inv_analysis)
    deadline = row["escalation_deadline"]

    history = [
        {
            "id":           str(h["id"]),
            "action":       h["action"],
            "acted_by":     h.get("acted_by"),
            "acted_by_role": h.get("acted_by_role"),
            "notes":        h.get("notes"),
            "created_at":   h["created_at"].isoformat(),
        }
        for h in history_rows
    ]

    return {
        "id":                    str(row["id"]),
        "pr_number":             row["pr_number"],
        "workflow_id":           row["workflow_id"],
        "warehouse_id":          str(row["warehouse_id"]),
        "status":                row["status"],
        "total_estimated_value": float(row.get("total_estimated_value") or 0),
        "approval_level":        row.get("approval_level") or "",
        "approver_role":         row.get("approver_role") or "",
        "requested_by":          row.get("requested_by") or "",
        "approved_by":           row.get("approved_by"),
        "approved_by_role":      row.get("approved_by_role"),
        "rejection_reason":      row.get("rejection_reason"),
        "notes":                 row.get("notes") or "",
        "items":                 items,
        "inventory_analysis":    inv_analysis,
        "escalation_deadline":   deadline.isoformat() if deadline else "",
        "created_at":            row["created_at"].isoformat(),
        "approval_history":      history,
    }


@router.get("/pr/{pr_id}/finance-analysis", tags=["Procurement"])
async def finance_analysis(pr_id: str, request: Request):
    """Finance Agent budget impact analysis for a PR — used by Finance Controller and CEO panels."""
    pool = request.app.state.pool
    try:
        return await get_pr_finance_analysis(pr_id, pool)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/pr/{pr_id}/approve", tags=["Procurement"])
async def approve_pr(pr_id: str, body: PRApprovalRequest, request: Request):
    """
    Role-aware approval:
    - L5 PRs (CEO_AND_FINANCE): Finance Controller → FINANCE_APPROVED, then CEO → APPROVED
    - L1–L4 PRs: correct single approver → APPROVED directly
    """
    pool = request.app.state.pool
    try:
        async with pool.acquire() as conn:
            pr = await conn.fetchrow(
                "SELECT status, approval_level FROM purchase_requisitions WHERE id = $1", pr_id
            )
        if not pr:
            raise HTTPException(status_code=404, detail="PR not found")

        current_status = pr["status"]
        approval_level = pr["approval_level"]
        role = body.acted_by_role.upper()

        if approval_level == "L5":
            if current_status == "PENDING" and role == "FINANCE_CONTROLLER":
                new_status = "FINANCE_APPROVED"
            elif current_status in ("PENDING", "RESUBMITTED") and role == "FINANCE_CONTROLLER":
                new_status = "FINANCE_APPROVED"
            elif current_status == "FINANCE_APPROVED" and role == "CEO":
                new_status = "APPROVED"
            else:
                raise HTTPException(
                    status_code=403,
                    detail=f"Cannot approve: current status={current_status}, your role={role}, approval_level={approval_level}. "
                           f"L5 PRs require Finance Controller first (PENDING→FINANCE_APPROVED), then CEO (FINANCE_APPROVED→APPROVED).",
                )
        else:
            new_status = "APPROVED"

        result = await update_pr_status(pr_id, new_status, body.acted_by, body.acted_by_role, body.notes, pool)
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pr/{pr_id}/reject", tags=["Procurement"])
async def reject_pr(pr_id: str, body: PRApprovalRequest, request: Request):
    pool = request.app.state.pool
    try:
        result = await update_pr_status(pr_id, "REJECTED", body.acted_by, body.acted_by_role, body.notes, pool)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pr/{pr_id}/request-changes", tags=["Procurement"])
async def request_changes(pr_id: str, body: PRApprovalRequest, request: Request):
    pool = request.app.state.pool
    try:
        result = await update_pr_status(pr_id, "CHANGES_REQUESTED", body.acted_by, body.acted_by_role, body.notes, pool)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pr/{pr_id}/resubmit", tags=["Procurement"])
async def resubmit_pr(pr_id: str, body: PRApprovalRequest, request: Request):
    pool = request.app.state.pool
    try:
        result = await update_pr_status(pr_id, "RESUBMITTED", body.acted_by, body.acted_by_role, body.notes, pool)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Phase 25: PO Generation ────────────────────────────────────────────────


def _row_to_po_response(row: dict) -> dict:
    items = row.get("items", [])
    if isinstance(items, str):
        items = json.loads(items)
    created = row.get("created_at")
    return {
        "id":                   str(row["id"]),
        "po_number":            row["po_number"],
        "pr_id":                str(row.get("pr_id") or ""),
        "supplier_id":          str(row.get("supplier_id") or ""),
        "supplier_name":        row.get("supplier_name") or "",
        "supplier_city":        row.get("supplier_city") or "",
        "supplier_reliability": float(row.get("supplier_reliability") or 0),
        "supplier_risk":        float(row.get("supplier_risk") or 0),
        "warehouse_id":         str(row.get("warehouse_id") or ""),
        "status":               row.get("status") or "draft",
        "total_amount":         float(row.get("total_amount") or 0),
        "expected_date":        str(row.get("expected_date") or ""),
        "items":                items,
        "ai_reasoning":         row.get("ai_reasoning") or "",
        "created_at":           created.isoformat() if hasattr(created, "isoformat") else str(created or ""),
    }


@router.post("/pr/{pr_id}/generate-po", tags=["Procurement"])
async def generate_po(pr_id: str, request: Request):
    """
    Phase 25 — Supplier Risk Agent + PO Generation.
    Evaluates suppliers for the PR's categories, picks the best,
    creates a draft PO linked to the PR. Idempotent — returns existing PO if already generated.
    """
    pool = request.app.state.pool
    try:
        # Check PR status
        async with pool.acquire() as conn:
            pr_row = await conn.fetchrow(
                "SELECT status, workflow_id FROM purchase_requisitions WHERE id = $1", pr_id
            )
        if not pr_row:
            raise HTTPException(status_code=404, detail="PR not found")
        if pr_row["status"] != "APPROVED":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot generate PO: PR status is '{pr_row['status']}'. Must be APPROVED.",
            )

        # Idempotency — return existing PO if already created
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                """
                SELECT po.id::TEXT, po.po_number, po.supplier_id::TEXT, po.warehouse_id::TEXT,
                       po.status, po.total_amount::FLOAT, po.expected_date::TEXT,
                       po.ai_reasoning, po.pr_id::TEXT, po.items, po.created_at,
                       s.name AS supplier_name, s.city AS supplier_city,
                       s.reliability_score::FLOAT AS supplier_reliability,
                       s.risk_score::FLOAT        AS supplier_risk
                FROM purchase_orders po
                JOIN suppliers s ON s.id = po.supplier_id
                WHERE po.pr_id = $1::uuid
                LIMIT 1
                """,
                pr_id,
            )
        if existing:
            return _row_to_po_response(dict(existing))

        # Run Supplier Risk Agent (deterministic)
        supplier = await get_best_supplier_for_pr(pr_id, pool)

        # Create draft PO
        po_row = await create_po_from_pr(pr_id, supplier, pool)

        # Log agent event
        await log_agent_event(
            workflow_id=pr_row["workflow_id"] or "",
            agent_name="supplier_risk_agent",
            event_type="SUPPLIER_RISK_AGENT_COMPLETED",
            payload={
                "po_number":       po_row["po_number"],
                "supplier":        supplier["name"],
                "reliability":     supplier["reliability_score"],
                "risk":            supplier["risk_score"],
                "total_amount":    po_row["total_amount"],
            },
            pool=pool,
            pr_id=pr_id,
        )

        return _row_to_po_response(po_row)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/po", tags=["Procurement"])
async def list_pos(request: Request, warehouse_id: str | None = None, pr_id: str | None = None):
    """List POs filtered by warehouse_id and/or pr_id."""
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT po.id::TEXT, po.po_number, po.supplier_id::TEXT, po.warehouse_id::TEXT,
                   po.status, po.total_amount::FLOAT, po.expected_date::TEXT,
                   po.ai_reasoning, po.pr_id::TEXT, po.items, po.created_at,
                   s.name AS supplier_name, s.city AS supplier_city,
                   s.reliability_score::FLOAT AS supplier_reliability,
                   s.risk_score::FLOAT        AS supplier_risk
            FROM purchase_orders po
            JOIN suppliers s ON s.id = po.supplier_id
            WHERE ($1::uuid IS NULL OR po.warehouse_id = $1::uuid)
              AND ($2::uuid IS NULL OR po.pr_id = $2::uuid)
            ORDER BY po.created_at DESC
            LIMIT 50
            """,
            warehouse_id,
            pr_id,
        )
    return [_row_to_po_response(dict(r)) for r in rows]


@router.get("/po/{po_id}", tags=["Procurement"])
async def get_po(po_id: str, request: Request):
    """Get full PO detail."""
    pool = request.app.state.pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT po.id::TEXT, po.po_number, po.supplier_id::TEXT, po.warehouse_id::TEXT,
                   po.status, po.total_amount::FLOAT, po.expected_date::TEXT,
                   po.ai_reasoning, po.pr_id::TEXT, po.items, po.created_at,
                   s.name AS supplier_name, s.city AS supplier_city,
                   s.reliability_score::FLOAT AS supplier_reliability,
                   s.risk_score::FLOAT        AS supplier_risk
            FROM purchase_orders po
            JOIN suppliers s ON s.id = po.supplier_id
            WHERE po.id = $1::uuid
            """,
            po_id,
        )
    if not row:
        raise HTTPException(status_code=404, detail="PO not found")
    return _row_to_po_response(dict(row))
