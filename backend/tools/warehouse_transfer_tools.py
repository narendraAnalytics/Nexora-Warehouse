"""
Warehouse Transfer tools — async @tool functions with asyncpg pool injected via closure.
One write tool: create_draft_transfer inserts into stock_transfers with status='pending'.
All transfers require human approval (Phase 15 HITL) before dispatch.
"""
import json
from datetime import datetime, timezone
from uuid import uuid4

import asyncpg
from langchain_core.tools import tool


def create_warehouse_transfer_tools(pool: asyncpg.Pool) -> list:
    """Return the 4 warehouse transfer tools with pool captured in closure."""

    @tool
    async def get_warehouse_inventory_summary() -> str:
        """Get a per-branch inventory health summary across all 5 Nexora warehouses.

        For each warehouse, shows: total SKUs, understocked count (below reorder_point),
        overstocked count (above max_stock), healthy count, and overall health score.
        Use this first to identify which branches need attention before drilling down.

        Returns JSON list of warehouse summaries sorted by understocked count descending.
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    w.id::TEXT                                       AS warehouse_id,
                    w.name                                           AS warehouse,
                    w.city,
                    COUNT(i.id)                                      AS total_skus,
                    COUNT(i.id) FILTER (
                        WHERE i.quantity < i.reorder_point
                    )                                                AS understocked,
                    COUNT(i.id) FILTER (
                        WHERE i.max_stock > 0
                          AND i.quantity > i.max_stock
                    )                                                AS overstocked,
                    COUNT(i.id) FILTER (
                        WHERE i.quantity >= i.reorder_point
                          AND (i.max_stock = 0 OR i.quantity <= i.max_stock)
                    )                                                AS healthy,
                    ROUND(
                        100.0 * COUNT(i.id) FILTER (
                            WHERE i.quantity >= i.reorder_point
                              AND (i.max_stock = 0 OR i.quantity <= i.max_stock)
                        ) / NULLIF(COUNT(i.id), 0),
                        1
                    )::FLOAT                                         AS health_pct
                FROM warehouses w
                LEFT JOIN inventory i ON i.warehouse_id = w.id
                WHERE w.is_active = TRUE
                GROUP BY w.id, w.name, w.city
                ORDER BY understocked DESC, overstocked DESC
                """
            )
            if not rows:
                return json.dumps({"status": "no_data", "message": "No warehouse data found."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_rebalance_candidates(category: str = "") -> str:
        """Find products suitable for cross-branch transfer to balance inventory.

        Identifies products where one warehouse has surplus (above max_stock) and another
        has deficit (below reorder_point) for the same SKU. Returns full UUIDs for both
        warehouses and the product so the agent can call create_draft_transfer directly.

        Includes has_open_transfer flag to prevent duplicate transfer creation.

        Args:
            category: Optional product category filter (e.g. 'TVs'). Leave empty for all categories.

        Returns JSON list sorted by surplus DESC, with from/to warehouse IDs, product SKU, and suggested_qty.
        """
        try:
            if category:
                rows = await pool.fetch(
                    """
                    SELECT
                        p.sku, p.name, p.category,
                        w_from.id::TEXT                              AS from_warehouse_id,
                        w_from.name                                  AS from_warehouse,
                        w_from.city                                  AS from_city,
                        i_from.quantity                              AS from_qty,
                        i_from.max_stock                             AS from_max_stock,
                        (i_from.quantity - i_from.max_stock)         AS surplus,
                        w_to.id::TEXT                                AS to_warehouse_id,
                        w_to.name                                    AS to_warehouse,
                        w_to.city                                    AS to_city,
                        i_to.quantity                                AS to_qty,
                        i_to.reorder_point                           AS to_reorder_point,
                        (i_to.reorder_point - i_to.quantity)         AS deficit,
                        LEAST(
                            i_from.quantity - i_from.max_stock,
                            i_to.reorder_point - i_to.quantity
                        )                                            AS suggested_qty,
                        EXISTS (
                            SELECT 1 FROM stock_transfers st
                            WHERE st.from_warehouse_id = w_from.id
                              AND st.to_warehouse_id   = w_to.id
                              AND st.product_id        = p.id
                              AND st.status IN ('pending', 'approved', 'dispatched')
                        )                                            AS has_open_transfer
                    FROM inventory i_from
                    JOIN inventory  i_to    ON  i_from.product_id    = i_to.product_id
                                            AND i_from.warehouse_id != i_to.warehouse_id
                    JOIN products   p       ON  p.id = i_from.product_id
                    JOIN warehouses w_from  ON  w_from.id = i_from.warehouse_id
                    JOIN warehouses w_to    ON  w_to.id   = i_to.warehouse_id
                    WHERE i_from.max_stock   > 0
                      AND i_from.quantity    > i_from.max_stock
                      AND i_to.reorder_point > 0
                      AND i_to.quantity      < i_to.reorder_point
                      AND w_from.is_active   = TRUE
                      AND w_to.is_active     = TRUE
                      AND p.category         ILIKE $1
                    ORDER BY surplus DESC
                    LIMIT 20
                    """,
                    f"%{category}%",
                )
            else:
                rows = await pool.fetch(
                    """
                    SELECT
                        p.sku, p.name, p.category,
                        w_from.id::TEXT                              AS from_warehouse_id,
                        w_from.name                                  AS from_warehouse,
                        w_from.city                                  AS from_city,
                        i_from.quantity                              AS from_qty,
                        i_from.max_stock                             AS from_max_stock,
                        (i_from.quantity - i_from.max_stock)         AS surplus,
                        w_to.id::TEXT                                AS to_warehouse_id,
                        w_to.name                                    AS to_warehouse,
                        w_to.city                                    AS to_city,
                        i_to.quantity                                AS to_qty,
                        i_to.reorder_point                           AS to_reorder_point,
                        (i_to.reorder_point - i_to.quantity)         AS deficit,
                        LEAST(
                            i_from.quantity - i_from.max_stock,
                            i_to.reorder_point - i_to.quantity
                        )                                            AS suggested_qty,
                        EXISTS (
                            SELECT 1 FROM stock_transfers st
                            WHERE st.from_warehouse_id = w_from.id
                              AND st.to_warehouse_id   = w_to.id
                              AND st.product_id        = p.id
                              AND st.status IN ('pending', 'approved', 'dispatched')
                        )                                            AS has_open_transfer
                    FROM inventory i_from
                    JOIN inventory  i_to    ON  i_from.product_id    = i_to.product_id
                                            AND i_from.warehouse_id != i_to.warehouse_id
                    JOIN products   p       ON  p.id = i_from.product_id
                    JOIN warehouses w_from  ON  w_from.id = i_from.warehouse_id
                    JOIN warehouses w_to    ON  w_to.id   = i_to.warehouse_id
                    WHERE i_from.max_stock   > 0
                      AND i_from.quantity    > i_from.max_stock
                      AND i_to.reorder_point > 0
                      AND i_to.quantity      < i_to.reorder_point
                      AND w_from.is_active   = TRUE
                      AND w_to.is_active     = TRUE
                    ORDER BY surplus DESC
                    LIMIT 20
                    """
                )
            if not rows:
                return json.dumps({
                    "status": "balanced",
                    "message": "No rebalance candidates — inventory is well-distributed across branches.",
                })
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_pending_transfers() -> str:
        """Get all stock transfers currently in pending, approved, or dispatched status.

        Use before creating new transfers to avoid duplicating in-flight movements.
        Returns transfers with from/to warehouse, product, quantity, status, and age in days.
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    st.transfer_number,
                    w_from.city                              AS from_city,
                    w_to.city                                AS to_city,
                    p.sku, p.name, p.category,
                    st.quantity,
                    st.status,
                    st.initiated_by,
                    st.ai_reasoning,
                    (CURRENT_DATE - st.created_at::DATE)     AS age_days,
                    st.dispatched_at::TEXT                   AS dispatched_at,
                    st.created_at::TEXT                      AS created_at
                FROM stock_transfers st
                JOIN warehouses w_from ON w_from.id = st.from_warehouse_id
                JOIN warehouses w_to   ON w_to.id   = st.to_warehouse_id
                JOIN products   p      ON p.id       = st.product_id
                WHERE st.status IN ('pending', 'approved', 'dispatched')
                ORDER BY st.created_at DESC
                """
            )
            if not rows:
                return json.dumps({"status": "clear", "message": "No pending stock transfers."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def create_draft_transfer(
        from_warehouse_id: str,
        to_warehouse_id: str,
        product_sku: str,
        quantity: int,
        ai_reasoning: str,
    ) -> str:
        """Create a draft stock transfer between two warehouses. Requires human approval before dispatch.

        Looks up product by SKU, validates both warehouses exist, then inserts a stock transfer
        with status='pending' and initiated_by='agent'. Returns transfer_number.

        Args:
            from_warehouse_id: UUID of the source (surplus) warehouse.
            to_warehouse_id: UUID of the destination (deficit) warehouse.
            product_sku: Product SKU to transfer (from get_rebalance_candidates).
            quantity: Number of units to transfer — use suggested_qty from rebalance candidates.
            ai_reasoning: Explanation of why this transfer is recommended.

        Returns JSON with transfer_number, from/to cities, product, quantity, status.
        """
        try:
            product = await pool.fetchrow(
                "SELECT id, name FROM products WHERE sku = $1 AND is_active = TRUE",
                product_sku,
            )
            if not product:
                return json.dumps({"error": f"Product SKU '{product_sku}' not found or inactive."})

            w_from = await pool.fetchrow(
                "SELECT city FROM warehouses WHERE id = $1::uuid AND is_active = TRUE",
                from_warehouse_id,
            )
            w_to = await pool.fetchrow(
                "SELECT city FROM warehouses WHERE id = $1::uuid AND is_active = TRUE",
                to_warehouse_id,
            )
            if not w_from:
                return json.dumps({"error": f"Source warehouse '{from_warehouse_id}' not found."})
            if not w_to:
                return json.dumps({"error": f"Destination warehouse '{to_warehouse_id}' not found."})

            transfer_number = f"TRF-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"

            row = await pool.fetchrow(
                """
                INSERT INTO stock_transfers
                    (transfer_number, from_warehouse_id, to_warehouse_id,
                     product_id, quantity, status, initiated_by, ai_reasoning)
                VALUES ($1, $2::uuid, $3::uuid, $4, $5, 'pending', 'agent', $6)
                RETURNING transfer_number, quantity, status
                """,
                transfer_number,
                from_warehouse_id,
                to_warehouse_id,
                product["id"],
                quantity,
                ai_reasoning,
            )
            return json.dumps({
                "created": True,
                "transfer_number": row["transfer_number"],
                "product": product["name"],
                "sku": product_sku,
                "quantity": row["quantity"],
                "from": w_from["city"],
                "to": w_to["city"],
                "status": row["status"],
                "note": "Draft transfer created — awaiting manager approval before dispatch.",
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    return [
        get_warehouse_inventory_summary,
        get_rebalance_candidates,
        get_pending_transfers,
        create_draft_transfer,
    ]
