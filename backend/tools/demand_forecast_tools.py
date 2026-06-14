"""
Demand Forecast tools — async @tool functions with asyncpg pool injected via closure.
Primary demand signal: inventory.avg_daily_sales (populated by operations team).
Thresholds: REORDER_THRESHOLD_DAYS=7 (critical), OVERSTOCK_THRESHOLD_DAYS=90 (excess).
"""
import json

import asyncpg
from langchain_core.tools import tool

from constants import REORDER_THRESHOLD_DAYS, OVERSTOCK_THRESHOLD_DAYS


def create_demand_forecast_tools(pool: asyncpg.Pool) -> list:
    """Return the 4 demand analysis tools with pool captured in closure."""

    @tool
    async def get_demand_velocity(warehouse_id: str) -> str:
        """Get demand velocity for all products in a warehouse — ranked by avg daily sales.

        Args:
            warehouse_id: UUID of the warehouse to analyse.

        Returns JSON list with sku, name, category, avg_daily_sales, quantity, days_of_stock,
        and stock_status (critical / low / healthy / excess).
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    p.sku, p.name, p.category, p.brand,
                    ROUND(i.avg_daily_sales, 2)::FLOAT          AS avg_daily_sales,
                    i.quantity,
                    CASE WHEN i.avg_daily_sales > 0
                         THEN ROUND(i.quantity / i.avg_daily_sales, 1)::FLOAT
                    END                                          AS days_of_stock,
                    CASE
                        WHEN i.avg_daily_sales > 0
                             AND i.quantity / i.avg_daily_sales < $2
                             THEN 'critical'
                        WHEN i.avg_daily_sales > 0
                             AND i.quantity / i.avg_daily_sales < 30
                             THEN 'low'
                        WHEN i.avg_daily_sales = 0
                             OR i.quantity / NULLIF(i.avg_daily_sales, 0) > $3
                             THEN 'excess'
                        ELSE 'healthy'
                    END                                          AS stock_status
                FROM inventory i
                JOIN products p ON p.id = i.product_id
                WHERE i.warehouse_id = $1::uuid
                ORDER BY avg_daily_sales DESC
                """,
                warehouse_id,
                float(REORDER_THRESHOLD_DAYS),
                float(OVERSTOCK_THRESHOLD_DAYS),
            )
            if not rows:
                return json.dumps({"status": "no_data", "message": f"No inventory found for warehouse {warehouse_id}"})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_stockout_risk(warehouse_id: str) -> str:
        """Find products at stockout risk — less than 7 days of stock remaining at current demand rate.

        Args:
            warehouse_id: UUID of the warehouse to check.

        Returns JSON list sorted by urgency (fewest days first), with units_needed_30_days projection.
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    p.sku, p.name, p.category, p.brand,
                    i.quantity,
                    ROUND(i.avg_daily_sales, 2)::FLOAT          AS avg_daily_sales,
                    ROUND(i.quantity / i.avg_daily_sales, 1)::FLOAT AS days_of_stock,
                    CEIL(i.avg_daily_sales * 30)::INTEGER        AS units_needed_30_days,
                    i.reorder_qty
                FROM inventory i
                JOIN products p ON p.id = i.product_id
                WHERE i.warehouse_id = $1::uuid
                  AND i.avg_daily_sales > 0
                  AND (i.quantity / i.avg_daily_sales) < $2
                ORDER BY days_of_stock ASC
                """,
                warehouse_id,
                float(REORDER_THRESHOLD_DAYS),
            )
            if not rows:
                return json.dumps({"status": "ok", "message": f"No stockout risk — all products have more than {REORDER_THRESHOLD_DAYS} days of stock."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_slow_movers(warehouse_id: str) -> str:
        """Find slow-moving products — more than 90 days of stock or zero demand. Dead stock risk.

        Args:
            warehouse_id: UUID of the warehouse to check.

        Returns JSON list sorted by highest days_of_stock first, including capital_locked estimate.
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    p.sku, p.name, p.category, p.brand,
                    i.quantity,
                    ROUND(i.avg_daily_sales, 2)::FLOAT          AS avg_daily_sales,
                    CASE WHEN i.avg_daily_sales > 0
                         THEN ROUND(i.quantity / i.avg_daily_sales, 1)::FLOAT
                    END                                          AS days_of_stock,
                    ROUND((i.quantity * p.unit_cost)::NUMERIC, 2)::FLOAT AS capital_locked
                FROM inventory i
                JOIN products p ON p.id = i.product_id
                WHERE i.warehouse_id = $1::uuid
                  AND i.quantity > 0
                  AND (
                      i.avg_daily_sales = 0
                      OR (i.quantity / i.avg_daily_sales) > $2
                  )
                ORDER BY days_of_stock DESC NULLS FIRST
                """,
                warehouse_id,
                float(OVERSTOCK_THRESHOLD_DAYS),
            )
            if not rows:
                return json.dumps({"status": "ok", "message": f"No slow movers — all stocked products have demand within {OVERSTOCK_THRESHOLD_DAYS} days."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_category_demand_comparison(category: str) -> str:
        """Compare demand velocity for a product category across all 5 Nexora branches.

        Useful for identifying which branches have high demand vs excess stock for the same category,
        enabling demand-driven rebalancing decisions.

        Args:
            category: Product category name (e.g. 'TVs', 'Mobiles & Tablets', 'Gaming Consoles',
                      'Networking Equipment', 'Accessories & Peripherals').

        Returns JSON list per branch: total_daily_demand, avg_daily_demand_per_sku, total_stock, days_cover.
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    w.name                                       AS warehouse,
                    w.city,
                    COUNT(DISTINCT i.product_id)::INTEGER        AS product_count,
                    ROUND(SUM(i.avg_daily_sales), 2)::FLOAT      AS total_daily_demand,
                    ROUND(AVG(i.avg_daily_sales), 2)::FLOAT      AS avg_daily_demand_per_sku,
                    SUM(i.quantity)::INTEGER                     AS total_stock,
                    ROUND(
                        SUM(i.quantity) / NULLIF(SUM(i.avg_daily_sales), 0),
                        1
                    )::FLOAT                                     AS days_cover
                FROM inventory i
                JOIN products   p ON p.id  = i.product_id
                JOIN warehouses w ON w.id  = i.warehouse_id
                WHERE p.category ILIKE $1
                  AND w.is_active = TRUE
                GROUP BY w.name, w.city
                ORDER BY total_daily_demand DESC
                """,
                category,
            )
            if not rows:
                return json.dumps({"status": "no_data", "message": f"No demand data found for category '{category}'."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    return [get_demand_velocity, get_stockout_risk, get_slow_movers, get_category_demand_comparison]
