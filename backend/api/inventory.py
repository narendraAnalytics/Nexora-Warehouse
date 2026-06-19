"""
Inventory API — Phase 22 (Inventory Module)
Exposes GET /inventory/stock and POST /inventory/analyze
"""
import json

from fastapi import APIRouter, HTTPException, Query, Request
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

router = APIRouter()

BANGALORE_UUID = "531e5c42-e4a1-4db0-a35c-a434f3b94344"


class InventoryAnalyzeRequest(BaseModel):
    warehouse_id: str = BANGALORE_UUID


@router.post("/analyze")
async def analyze_inventory(body: InventoryAnalyzeRequest, request: Request):
    """Run the Inventory Intelligence Agent for a warehouse and return analysis + reorder alerts."""
    graph = request.app.state.inventory_graph
    pool  = request.app.state.pool

    task = (
        f"Analyze inventory for warehouse_id={body.warehouse_id}. "
        "Check stock levels, identify all reorder alerts, overstock alerts, and transfer opportunities. "
        "Produce a structured report with priority actions."
    )

    initial_state = {
        "messages": [HumanMessage(content=task)],
        "warehouse_id": body.warehouse_id,
    }

    try:
        result = await graph.ainvoke(initial_state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    analysis_text = result["messages"][-1].content

    # Fetch structured reorder alerts directly from DB for frontend badge/button logic
    try:
        async with pool.acquire() as conn:
            alert_rows = await conn.fetch(
                """
                SELECT
                    p.sku, p.name, p.category, p.brand,
                    p.unit_cost, p.unit_price,
                    i.quantity, i.reorder_point, i.reorder_qty,
                    ROUND(i.avg_daily_sales, 2)::FLOAT AS avg_daily_sales,
                    (i.reorder_point - i.quantity) AS deficit
                FROM inventory i
                JOIN products p ON p.id = i.product_id
                WHERE i.warehouse_id = $1::uuid
                  AND i.quantity <= i.reorder_point
                ORDER BY deficit DESC
                """,
                body.warehouse_id,
            )
            reorder_alerts = [dict(r) for r in alert_rows]
    except Exception:
        reorder_alerts = []

    # Log to agent_logs for dashboard alerts feed
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO agent_logs (agent_name, action, output_summary, status)
                VALUES ($1, $2, $3, $4)
                """,
                "inventory_agent",
                "inventory_analysis",
                f"Inventory analysis complete — {len(reorder_alerts)} reorder alert(s) detected for warehouse {body.warehouse_id}",
                "success",
            )
    except Exception:
        pass

    return {
        "warehouse_id": body.warehouse_id,
        "analysis":     analysis_text,
        "reorder_alerts": reorder_alerts,
        "low_stock_count": len(reorder_alerts),
    }


@router.get("/stock")
async def get_stock_levels(
    request: Request,
    warehouse_id: str = Query(default=BANGALORE_UUID),
):
    """Get current stock levels with status flags for all products in a warehouse."""
    pool = request.app.state.pool
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT
                    p.sku,
                    p.name,
                    p.category,
                    p.brand,
                    w.name  AS warehouse_name,
                    w.city  AS warehouse_city,
                    i.quantity,
                    i.reserved_qty,
                    i.reorder_point,
                    i.reorder_qty,
                    i.max_stock,
                    ROUND(i.avg_daily_sales, 2)::FLOAT AS avg_daily_sales,
                    CASE
                        WHEN i.quantity <= i.reorder_point             THEN 'CRITICAL'
                        WHEN i.quantity <= (i.reorder_point * 1.5)     THEN 'LOW'
                        WHEN i.max_stock > 0
                         AND i.quantity >= i.max_stock                 THEN 'OVERSTOCK'
                        ELSE 'OK'
                    END AS stock_status
                FROM inventory i
                JOIN products   p ON p.id = i.product_id
                JOIN warehouses w ON w.id = i.warehouse_id
                WHERE i.warehouse_id = $1::uuid
                  AND p.is_active = TRUE
                ORDER BY i.quantity ASC
                """,
                warehouse_id,
            )
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
