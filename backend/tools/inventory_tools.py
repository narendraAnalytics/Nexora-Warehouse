"""
Inventory Intelligence tools — async @tool functions with asyncpg pool injected via closure.
"""
import json

import asyncpg
from langchain_core.tools import tool


def create_inventory_tools(pool: asyncpg.Pool) -> list:
    """Return the 4 inventory analysis tools with pool captured in closure."""

    @tool
    async def get_stock_levels(warehouse_id: str) -> str:
        """Get current stock levels for all products in a warehouse.

        Args:
            warehouse_id: UUID of the warehouse to query.

        Returns JSON list with sku, name, category, quantity, reorder_point, max_stock, avg_daily_sales,
        and stock_pct (percentage of max capacity used).
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    p.sku, p.name, p.category, p.brand,
                    i.quantity, i.reserved_qty, i.reorder_point,
                    i.reorder_qty, i.max_stock,
                    ROUND(i.avg_daily_sales, 2)::FLOAT       AS avg_daily_sales,
                    CASE WHEN i.max_stock > 0
                         THEN ROUND(100.0 * i.quantity / i.max_stock, 1)::FLOAT
                    END                                       AS stock_pct
                FROM inventory i
                JOIN products p ON p.id = i.product_id
                WHERE i.warehouse_id = $1::uuid
                ORDER BY i.quantity ASC
                """,
                warehouse_id,
            )
            if not rows:
                return json.dumps({"status": "no_data", "message": f"No inventory found for warehouse {warehouse_id}"})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_reorder_alerts(warehouse_id: str) -> str:
        """Find products that need to be reordered — quantity at or below reorder_point.

        Args:
            warehouse_id: UUID of the warehouse to check.

        Returns JSON list of products sorted by deficit (largest gap first), with days_remaining estimate.
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    p.sku, p.name, p.category,
                    i.quantity, i.reorder_point, i.reorder_qty,
                    (i.reorder_point - i.quantity)           AS deficit,
                    CASE WHEN i.avg_daily_sales > 0
                         THEN ROUND(i.quantity / i.avg_daily_sales, 1)::FLOAT
                    END                                       AS days_remaining
                FROM inventory i
                JOIN products p ON p.id = i.product_id
                WHERE i.warehouse_id = $1::uuid
                  AND i.quantity <= i.reorder_point
                ORDER BY deficit DESC
                """,
                warehouse_id,
            )
            if not rows:
                return json.dumps({"status": "ok", "message": "No reorder alerts — all products above reorder point."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_overstock_alerts(warehouse_id: str) -> str:
        """Find products that are overstocked — quantity at or above max_stock.

        Args:
            warehouse_id: UUID of the warehouse to check.

        Returns JSON list of overstocked products with excess quantity and capacity_pct.
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    p.sku, p.name, p.category,
                    i.quantity, i.max_stock,
                    (i.quantity - i.max_stock)               AS excess,
                    ROUND(100.0 * i.quantity / i.max_stock, 1)::FLOAT AS capacity_pct
                FROM inventory i
                JOIN products p ON p.id = i.product_id
                WHERE i.warehouse_id = $1::uuid
                  AND i.max_stock > 0
                  AND i.quantity >= i.max_stock
                ORDER BY excess DESC
                """,
                warehouse_id,
            )
            if not rows:
                return json.dumps({"status": "ok", "message": "No overstock alerts — all products within max stock limits."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_transfer_opportunities() -> str:
        """Find cross-branch transfer opportunities to balance inventory across all Nexora warehouses.

        Identifies products overstocked in one branch (quantity > max_stock) and understocked in another
        (quantity < reorder_point). Returns up to 15 suggestions sorted by largest surplus first.
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    p.sku, p.name, p.category,
                    w_from.name                              AS from_warehouse,
                    w_from.city                              AS from_city,
                    i_from.quantity                          AS from_qty,
                    i_from.max_stock                         AS from_max,
                    (i_from.quantity - i_from.max_stock)     AS surplus,
                    w_to.name                                AS to_warehouse,
                    w_to.city                                AS to_city,
                    i_to.quantity                            AS to_qty,
                    i_to.reorder_point                       AS to_reorder,
                    (i_to.reorder_point - i_to.quantity)     AS deficit,
                    LEAST(
                        i_from.quantity - i_from.max_stock,
                        i_to.reorder_point - i_to.quantity
                    )                                        AS suggested_transfer_qty
                FROM inventory i_from
                JOIN inventory i_to
                    ON  i_from.product_id    = i_to.product_id
                    AND i_from.warehouse_id != i_to.warehouse_id
                JOIN products   p       ON p.id       = i_from.product_id
                JOIN warehouses w_from  ON w_from.id  = i_from.warehouse_id
                JOIN warehouses w_to    ON w_to.id    = i_to.warehouse_id
                WHERE i_from.max_stock   > 0
                  AND i_from.quantity    > i_from.max_stock
                  AND i_to.reorder_point > 0
                  AND i_to.quantity      < i_to.reorder_point
                  AND w_from.is_active   = TRUE
                  AND w_to.is_active     = TRUE
                ORDER BY surplus DESC
                LIMIT 15
                """,
            )
            if not rows:
                return json.dumps({"status": "balanced", "message": "No transfer opportunities — inventory is balanced across all branches."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    return [get_stock_levels, get_reorder_alerts, get_overstock_alerts, get_transfer_opportunities]
