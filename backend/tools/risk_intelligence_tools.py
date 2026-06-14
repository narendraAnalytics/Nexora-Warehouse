"""
Risk Intelligence tools — async @tool functions with asyncpg pool injected via closure.
Read-only: cross-domain risk aggregation across suppliers, inventory, orders, and finance.
All tools join multiple tables to produce unified risk signals.
"""
import json

import asyncpg
from langchain_core.tools import tool


def create_risk_intelligence_tools(pool: asyncpg.Pool) -> list:
    """Return the 4 risk intelligence tools with pool captured in closure."""

    @tool
    async def get_risk_dashboard() -> str:
        """Get a top-level risk dashboard — aggregate risk counts and values across all domains.

        Single call to get the full risk picture: how many suppliers are high-risk,
        how many POs are overdue, how many orders are delayed, how many SKUs face imminent
        stockout. Use this first to decide which domains need deeper investigation.

        Returns JSON with risk counts and INR values per risk category.
        """
        try:
            row = await pool.fetchrow(
                """
                SELECT
                    -- Supplier risk
                    COUNT(DISTINCT s.id) FILTER (
                        WHERE s.risk_score >= 7.0 AND s.is_active
                    )                                                           AS critical_suppliers,
                    COUNT(DISTINCT s.id) FILTER (
                        WHERE s.risk_score >= 5.0 AND s.risk_score < 7.0 AND s.is_active
                    )                                                           AS high_risk_suppliers,

                    -- Overdue POs (capital stuck with suppliers)
                    COUNT(DISTINCT po.id) FILTER (
                        WHERE po.status NOT IN ('received', 'cancelled')
                          AND po.expected_date < CURRENT_DATE
                    )                                                           AS overdue_pos,
                    ROUND(COALESCE(SUM(po.total_amount) FILTER (
                        WHERE po.status NOT IN ('received', 'cancelled')
                          AND po.expected_date < CURRENT_DATE
                    ), 0), 2)::FLOAT                                            AS overdue_po_value_inr,

                    -- Delayed orders (revenue at risk)
                    COUNT(DISTINCT o.id) FILTER (
                        WHERE o.status NOT IN ('fulfilled', 'cancelled')
                          AND o.due_date < CURRENT_DATE
                    )                                                           AS delayed_orders,
                    ROUND(COALESCE(SUM(o.total_amount) FILTER (
                        WHERE o.status NOT IN ('fulfilled', 'cancelled')
                          AND o.due_date < CURRENT_DATE
                    ), 0), 2)::FLOAT                                            AS delayed_order_value_inr,

                    -- Stockout risk (SKUs below reorder with no open PO)
                    COUNT(DISTINCT i.id) FILTER (
                        WHERE i.quantity <= i.reorder_point
                          AND NOT EXISTS (
                              SELECT 1 FROM purchase_orders po2
                              JOIN products p2 ON p2.id = i.product_id
                              WHERE po2.warehouse_id = i.warehouse_id
                                AND po2.status IN ('draft', 'pending', 'approved')
                          )
                    )                                                           AS uncovered_stockouts,

                    -- Capital locked in overstock
                    ROUND(COALESCE(SUM(
                        (i.quantity - i.max_stock) * p.unit_cost
                    ) FILTER (
                        WHERE i.max_stock > 0 AND i.quantity > i.max_stock
                    ), 0), 2)::FLOAT                                            AS overstock_capital_inr

                FROM suppliers  s
                FULL OUTER JOIN purchase_orders po ON po.supplier_id = s.id
                FULL OUTER JOIN orders          o  ON TRUE
                FULL OUTER JOIN inventory       i  ON TRUE
                FULL OUTER JOIN products        p  ON p.id = i.product_id
                """
            )
            if not row:
                return json.dumps({"status": "no_data", "message": "No risk data available."})
            return json.dumps(dict(row))
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_supply_chain_risks() -> str:
        """Get supply chain risk signals — combines supplier scores, overdue POs, and uncovered stockouts.

        Surfaces three risk types in one call:
        1. High-risk suppliers (risk_score >= 5.0) with active purchase orders
        2. Overdue purchase orders with days overdue and capital at risk
        3. Products in stockout with no open PO — imminent out-of-stock events

        Returns JSON with three keys: high_risk_suppliers, overdue_purchase_orders, uncovered_stockouts.
        """
        try:
            suppliers = await pool.fetch(
                """
                SELECT
                    s.id::TEXT,
                    s.name,
                    s.city,
                    ROUND(s.risk_score, 2)::FLOAT        AS risk_score,
                    ROUND(s.reliability_score, 2)::FLOAT AS reliability_score,
                    s.avg_lead_days,
                    COUNT(po.id) FILTER (
                        WHERE po.status IN ('draft', 'pending', 'approved')
                    )                                    AS open_pos,
                    ROUND(COALESCE(SUM(po.total_amount) FILTER (
                        WHERE po.status IN ('draft', 'pending', 'approved')
                    ), 0), 2)::FLOAT                     AS open_po_value_inr
                FROM suppliers s
                LEFT JOIN purchase_orders po ON po.supplier_id = s.id
                WHERE s.is_active = TRUE
                  AND s.risk_score >= 5.0
                GROUP BY s.id, s.name, s.city, s.risk_score, s.reliability_score, s.avg_lead_days
                ORDER BY s.risk_score DESC
                """
            )

            overdue_pos = await pool.fetch(
                """
                SELECT
                    po.po_number,
                    s.name                                AS supplier,
                    ROUND(s.risk_score, 2)::FLOAT         AS supplier_risk_score,
                    w.city                                AS warehouse,
                    po.status,
                    po.expected_date::TEXT                AS expected_date,
                    (CURRENT_DATE - po.expected_date)     AS days_overdue,
                    ROUND(po.total_amount, 2)::FLOAT      AS total_amount
                FROM purchase_orders po
                JOIN suppliers  s ON s.id = po.supplier_id
                JOIN warehouses w ON w.id = po.warehouse_id
                WHERE po.status NOT IN ('received', 'cancelled')
                  AND po.expected_date < CURRENT_DATE
                ORDER BY days_overdue DESC
                """
            )

            uncovered = await pool.fetch(
                """
                SELECT
                    p.sku, p.name, p.category,
                    w.city                                AS warehouse,
                    i.quantity,
                    i.reorder_point,
                    (i.reorder_point - i.quantity)        AS deficit,
                    CASE WHEN i.avg_daily_sales > 0
                         THEN ROUND(i.quantity / i.avg_daily_sales, 1)::FLOAT
                    END                                   AS days_remaining
                FROM inventory i
                JOIN products   p ON p.id = i.product_id
                JOIN warehouses w ON w.id = i.warehouse_id
                WHERE i.quantity <= i.reorder_point
                  AND NOT EXISTS (
                      SELECT 1 FROM purchase_orders po2
                      JOIN products p2 ON p2.id = i.product_id
                      WHERE po2.warehouse_id = i.warehouse_id
                        AND po2.status IN ('draft', 'pending', 'approved')
                  )
                ORDER BY days_remaining ASC NULLS FIRST
                LIMIT 20
                """
            )

            return json.dumps({
                "high_risk_suppliers": [dict(r) for r in suppliers],
                "overdue_purchase_orders": [dict(r) for r in overdue_pos],
                "uncovered_stockouts": [dict(r) for r in uncovered],
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_operational_risks() -> str:
        """Get operational risk signals — delayed orders, overdue deliveries, and branch health.

        Surfaces three risk types:
        1. Delayed customer orders (past due_date, not fulfilled)
        2. Overdue in-transit deliveries (estimated_eta passed, not delivered)
        3. Branch inventory health (% SKUs understocked per warehouse)

        Returns JSON with three keys: delayed_orders, overdue_deliveries, branch_health.
        """
        try:
            delayed = await pool.fetch(
                """
                SELECT
                    o.order_number,
                    o.customer_name,
                    w.city                                AS warehouse,
                    o.status,
                    o.priority,
                    ROUND(o.total_amount, 2)::FLOAT       AS total_amount,
                    o.due_date::TEXT                      AS due_date,
                    (CURRENT_DATE - o.due_date)           AS days_overdue,
                    d.status                              AS delivery_status,
                    d.estimated_eta::TEXT                 AS estimated_eta
                FROM orders o
                JOIN warehouses  w ON w.id = o.warehouse_id
                LEFT JOIN deliveries d ON d.order_id = o.id
                WHERE o.status NOT IN ('fulfilled', 'cancelled')
                  AND o.due_date < CURRENT_DATE
                ORDER BY days_overdue DESC, o.total_amount DESC
                """
            )

            deliveries = await pool.fetch(
                """
                SELECT
                    d.id::TEXT          AS delivery_id,
                    o.order_number,
                    o.priority,
                    w.city              AS from_warehouse,
                    d.vehicle_number,
                    d.driver_name,
                    d.route,
                    d.estimated_eta::TEXT AS estimated_eta,
                    ROUND(
                        EXTRACT(EPOCH FROM (NOW() - d.estimated_eta)) / 3600, 1
                    )::FLOAT            AS hours_overdue
                FROM deliveries d
                JOIN orders     o ON o.id = d.order_id
                JOIN warehouses w ON w.id = o.warehouse_id
                WHERE d.status IN ('dispatched', 'in_transit')
                  AND d.estimated_eta < NOW()
                ORDER BY hours_overdue DESC
                """
            )

            branch_health = await pool.fetch(
                """
                SELECT
                    w.city                                  AS warehouse,
                    COUNT(i.id)                             AS total_skus,
                    COUNT(i.id) FILTER (
                        WHERE i.quantity < i.reorder_point
                    )                                       AS understocked,
                    ROUND(
                        100.0 * COUNT(i.id) FILTER (
                            WHERE i.quantity < i.reorder_point
                        ) / NULLIF(COUNT(i.id), 0), 1
                    )::FLOAT                                AS understocked_pct,
                    COUNT(i.id) FILTER (
                        WHERE i.max_stock > 0
                          AND i.quantity > i.max_stock
                    )                                       AS overstocked
                FROM warehouses w
                LEFT JOIN inventory i ON i.warehouse_id = w.id
                WHERE w.is_active = TRUE
                GROUP BY w.id, w.city
                ORDER BY understocked_pct DESC
                """
            )

            return json.dumps({
                "delayed_orders": [dict(r) for r in delayed],
                "overdue_deliveries": [dict(r) for r in deliveries],
                "branch_health": [dict(r) for r in branch_health],
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_financial_risk_exposure() -> str:
        """Get total financial exposure across all risk categories in INR.

        Aggregates:
        - Open PO value (committed spend not yet received)
        - Overdue PO value (capital stuck with late suppliers)
        - Delayed order revenue (customer revenue at risk)
        - Overstock capital locked (cash tied up in excess inventory)
        - Uncovered stockout potential lost sales (reorder_qty × unit_price for uncovered items)

        Returns JSON with per-category INR values and a total_risk_exposure_inr summary.
        """
        try:
            row = await pool.fetchrow(
                """
                WITH po_exposure AS (
                    SELECT
                        ROUND(COALESCE(SUM(total_amount) FILTER (
                            WHERE status IN ('draft', 'pending', 'approved')
                        ), 0), 2) AS open_po_value,
                        ROUND(COALESCE(SUM(total_amount) FILTER (
                            WHERE status NOT IN ('received', 'cancelled')
                              AND expected_date < CURRENT_DATE
                        ), 0), 2) AS overdue_po_value
                    FROM purchase_orders
                ),
                order_exposure AS (
                    SELECT
                        ROUND(COALESCE(SUM(total_amount) FILTER (
                            WHERE status NOT IN ('fulfilled', 'cancelled')
                              AND due_date < CURRENT_DATE
                        ), 0), 2) AS delayed_order_value
                    FROM orders
                ),
                inventory_exposure AS (
                    SELECT
                        ROUND(COALESCE(SUM(
                            (i.quantity - i.max_stock) * p.unit_cost
                        ) FILTER (
                            WHERE i.max_stock > 0 AND i.quantity > i.max_stock
                        ), 0), 2) AS overstock_capital,
                        ROUND(COALESCE(SUM(
                            i.reorder_qty * p.unit_price
                        ) FILTER (
                            WHERE i.quantity <= i.reorder_point
                              AND NOT EXISTS (
                                  SELECT 1 FROM purchase_orders po2
                                  WHERE po2.warehouse_id = i.warehouse_id
                                    AND po2.status IN ('draft', 'pending', 'approved')
                              )
                        ), 0), 2) AS potential_lost_sales
                    FROM inventory i
                    JOIN products p ON p.id = i.product_id
                )
                SELECT
                    po_exposure.open_po_value::FLOAT,
                    po_exposure.overdue_po_value::FLOAT,
                    order_exposure.delayed_order_value::FLOAT,
                    inventory_exposure.overstock_capital::FLOAT,
                    inventory_exposure.potential_lost_sales::FLOAT,
                    (
                        po_exposure.overdue_po_value +
                        order_exposure.delayed_order_value +
                        inventory_exposure.potential_lost_sales
                    )::FLOAT                              AS total_risk_exposure_inr
                FROM po_exposure, order_exposure, inventory_exposure
                """
            )
            if not row:
                return json.dumps({"status": "no_data", "message": "No financial data available."})
            return json.dumps(dict(row))
        except Exception as e:
            return json.dumps({"error": str(e)})

    return [
        get_risk_dashboard,
        get_supply_chain_risks,
        get_operational_risks,
        get_financial_risk_exposure,
    ]
