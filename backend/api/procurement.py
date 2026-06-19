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


@router.post("/pr/{pr_id}/approve", tags=["Procurement"])
async def approve_pr(pr_id: str, body: PRApprovalRequest, request: Request):
    pool = request.app.state.pool
    try:
        result = await update_pr_status(pr_id, "APPROVED", body.acted_by, body.acted_by_role, body.notes, pool)
        return result
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
