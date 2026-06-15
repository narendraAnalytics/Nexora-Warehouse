"""
CEO Agent Tools — cross-cutting KPI aggregation, risk summary, operations pulse,
and executive decision logging for the Nexora CEO briefing system.
"""
import json
from datetime import date

import asyncpg
from langchain_core.tools import tool


def create_ceo_tools(pool: asyncpg.Pool) -> list:
    """Return list of CEO tools bound to the given asyncpg pool."""

    @tool
    async def get_executive_kpis() -> dict:
        """Fetch top-level executive KPIs: revenue, orders, stockouts, open POs, overdue orders."""
        try:
            async with pool.acquire() as conn:
                # Revenue today and yesterday
                revenue_rows = await conn.fetch("""
                    SELECT
                        SUM(CASE WHEN recorded_date = CURRENT_DATE THEN amount ELSE 0 END)
                            AS revenue_today,
                        SUM(CASE WHEN recorded_date = CURRENT_DATE - INTERVAL '1 day' THEN amount ELSE 0 END)
                            AS revenue_yesterday,
                        SUM(CASE WHEN DATE_TRUNC('month', recorded_date) = DATE_TRUNC('month', CURRENT_DATE)
                                 THEN amount ELSE 0 END)
                            AS revenue_month_to_date
                    FROM finance_records
                    WHERE record_type = 'revenue'
                      AND recorded_date >= CURRENT_DATE - INTERVAL '31 days'
                """)
                rev = revenue_rows[0] if revenue_rows else {}

                # Order counts by status
                order_rows = await conn.fetch("""
                    SELECT status, COUNT(*) AS count
                    FROM orders
                    GROUP BY status
                """)
                orders_by_status = {r["status"]: r["count"] for r in order_rows}

                # Overdue orders
                overdue_count = await conn.fetchval("""
                    SELECT COUNT(*)
                    FROM orders
                    WHERE due_date < CURRENT_DATE
                      AND status NOT IN ('fulfilled', 'cancelled')
                """)

                # Stockout risk: items at or below reorder point, per warehouse
                stockout_rows = await conn.fetch("""
                    SELECT w.name AS warehouse, COUNT(*) AS at_risk_items
                    FROM inventory i
                    JOIN warehouses w ON w.id = i.warehouse_id
                    WHERE i.quantity <= i.reorder_point
                    GROUP BY w.name
                    ORDER BY at_risk_items DESC
                """)
                stockout_by_branch = [
                    {"warehouse": r["warehouse"], "at_risk_items": r["at_risk_items"]}
                    for r in stockout_rows
                ]
                total_stockout_items = sum(r["at_risk_items"] for r in stockout_by_branch)

                # Open PO value
                open_po_value = await conn.fetchval("""
                    SELECT COALESCE(SUM(total_amount), 0)
                    FROM purchase_orders
                    WHERE status IN ('draft', 'approved', 'ordered')
                """)

                # Fulfilled orders today
                fulfilled_today = await conn.fetchval("""
                    SELECT COUNT(*) FROM orders
                    WHERE DATE(fulfilled_at) = CURRENT_DATE
                """)

            return {
                "revenue": {
                    "today_inr": float(rev.get("revenue_today") or 0),
                    "yesterday_inr": float(rev.get("revenue_yesterday") or 0),
                    "month_to_date_inr": float(rev.get("revenue_month_to_date") or 0),
                },
                "orders": {
                    "by_status": orders_by_status,
                    "overdue_count": overdue_count,
                    "fulfilled_today": fulfilled_today,
                },
                "stockout_risk": {
                    "total_at_risk_items": total_stockout_items,
                    "by_branch": stockout_by_branch,
                },
                "open_po_value_inr": float(open_po_value or 0),
                "as_of_date": date.today().isoformat(),
            }
        except Exception as e:
            return {"error": str(e)}

    @tool
    async def get_risk_summary() -> dict:
        """Fetch cross-domain risk summary: high-risk suppliers, overdue POs, delayed deliveries."""
        try:
            async with pool.acquire() as conn:
                # High-risk suppliers
                supplier_rows = await conn.fetch("""
                    SELECT name, risk_score, reliability_score, city
                    FROM suppliers
                    WHERE risk_score >= 7.5 AND is_active = TRUE
                    ORDER BY risk_score DESC
                    LIMIT 10
                """)
                high_risk_suppliers = [
                    {
                        "name": r["name"],
                        "risk_score": float(r["risk_score"]),
                        "reliability_score": float(r["reliability_score"]),
                        "city": r["city"],
                    }
                    for r in supplier_rows
                ]

                # Overdue POs (approved/ordered but past expected date)
                overdue_po_rows = await conn.fetch("""
                    SELECT
                        po.po_number,
                        s.name AS supplier,
                        w.name AS warehouse,
                        po.total_amount,
                        po.expected_date,
                        (CURRENT_DATE - po.expected_date) AS days_overdue
                    FROM purchase_orders po
                    JOIN suppliers s ON s.id = po.supplier_id
                    JOIN warehouses w ON w.id = po.warehouse_id
                    WHERE po.status IN ('approved', 'ordered')
                      AND po.expected_date < CURRENT_DATE
                    ORDER BY days_overdue DESC
                    LIMIT 10
                """)
                overdue_pos = [
                    {
                        "po_number": r["po_number"],
                        "supplier": r["supplier"],
                        "warehouse": r["warehouse"],
                        "amount_inr": float(r["total_amount"]),
                        "days_overdue": r["days_overdue"],
                    }
                    for r in overdue_po_rows
                ]
                overdue_po_value = sum(r["amount_inr"] for r in overdue_pos)

                # Delayed deliveries (in-transit past ETA)
                delayed_rows = await conn.fetch("""
                    SELECT
                        d.id,
                        d.vehicle_number,
                        d.route,
                        d.estimated_eta,
                        EXTRACT(EPOCH FROM (NOW() - d.estimated_eta))/3600 AS hours_overdue
                    FROM deliveries d
                    WHERE d.status = 'in_transit'
                      AND d.estimated_eta < NOW()
                    ORDER BY hours_overdue DESC
                    LIMIT 10
                """)
                delayed_deliveries = [
                    {
                        "vehicle": r["vehicle_number"],
                        "route": r["route"],
                        "hours_overdue": round(float(r["hours_overdue"]), 1),
                    }
                    for r in delayed_rows
                ]

            return {
                "high_risk_suppliers": high_risk_suppliers,
                "high_risk_supplier_count": len(high_risk_suppliers),
                "overdue_purchase_orders": overdue_pos,
                "overdue_po_count": len(overdue_pos),
                "overdue_po_value_inr": overdue_po_value,
                "delayed_deliveries": delayed_deliveries,
                "delayed_delivery_count": len(delayed_deliveries),
            }
        except Exception as e:
            return {"error": str(e)}

    @tool
    async def get_operations_pulse() -> dict:
        """Fetch operational health: fulfillment rate, dispatch queue, branch stock health."""
        try:
            async with pool.acquire() as conn:
                # Fulfillment rate per branch (last 7 days)
                fulfillment_rows = await conn.fetch("""
                    SELECT
                        w.name AS warehouse,
                        COUNT(*) AS total_orders,
                        COUNT(*) FILTER (WHERE o.status = 'fulfilled') AS fulfilled_orders,
                        ROUND(
                            100.0 * COUNT(*) FILTER (WHERE o.status = 'fulfilled') / NULLIF(COUNT(*), 0),
                            1
                        ) AS fulfillment_rate_pct
                    FROM orders o
                    JOIN warehouses w ON w.id = o.warehouse_id
                    WHERE o.created_at >= NOW() - INTERVAL '7 days'
                    GROUP BY w.name
                    ORDER BY fulfillment_rate_pct ASC NULLS LAST
                """)
                fulfillment_by_branch = [
                    {
                        "warehouse": r["warehouse"],
                        "total_orders": r["total_orders"],
                        "fulfilled_orders": r["fulfilled_orders"],
                        "fulfillment_rate_pct": float(r["fulfillment_rate_pct"] or 0),
                    }
                    for r in fulfillment_rows
                ]

                # Dispatch queue: confirmed orders with no delivery yet
                dispatch_queue_count = await conn.fetchval("""
                    SELECT COUNT(*)
                    FROM orders o
                    WHERE o.status = 'confirmed'
                      AND NOT EXISTS (
                          SELECT 1 FROM deliveries d WHERE d.order_id = o.id
                      )
                """)

                # Branch stock health: items below reorder point vs total per branch
                stock_rows = await conn.fetch("""
                    SELECT
                        w.name AS warehouse,
                        COUNT(*) AS total_items,
                        COUNT(*) FILTER (WHERE i.quantity <= i.reorder_point) AS low_stock_items,
                        ROUND(
                            100.0 * (1 - COUNT(*) FILTER (WHERE i.quantity <= i.reorder_point)::NUMERIC
                                     / NULLIF(COUNT(*), 0)),
                            1
                        ) AS stock_health_pct
                    FROM inventory i
                    JOIN warehouses w ON w.id = i.warehouse_id
                    GROUP BY w.name
                    ORDER BY stock_health_pct ASC NULLS LAST
                """)
                stock_health = [
                    {
                        "warehouse": r["warehouse"],
                        "total_items": r["total_items"],
                        "low_stock_items": r["low_stock_items"],
                        "stock_health_pct": float(r["stock_health_pct"] or 0),
                    }
                    for r in stock_rows
                ]

                # Overall fulfillment rate
                overall_fulfillment = await conn.fetchval("""
                    SELECT ROUND(
                        100.0 * COUNT(*) FILTER (WHERE status = 'fulfilled') / NULLIF(COUNT(*), 0),
                        1
                    )
                    FROM orders
                    WHERE created_at >= NOW() - INTERVAL '7 days'
                """)

            return {
                "overall_fulfillment_rate_pct": float(overall_fulfillment or 0),
                "fulfillment_by_branch": fulfillment_by_branch,
                "dispatch_queue_depth": dispatch_queue_count,
                "branch_stock_health": stock_health,
                "period": "last_7_days",
            }
        except Exception as e:
            return {"error": str(e)}

    @tool
    async def log_executive_decision(
        title: str,
        summary: str,
        recommendations: str,
        kpis_snapshot: str,
        risk_flags: str,
        priority: str = "medium",
    ) -> dict:
        """
        Log an executive decision to the executive_decisions table.
        recommendations, kpis_snapshot, risk_flags must be JSON strings.
        priority: critical | high | medium | low
        Returns the inserted decision id.
        """
        try:
            recs = json.loads(recommendations) if isinstance(recommendations, str) else recommendations
            kpis = json.loads(kpis_snapshot) if isinstance(kpis_snapshot, str) else kpis_snapshot
            flags = json.loads(risk_flags) if isinstance(risk_flags, str) else risk_flags

            async with pool.acquire() as conn:
                decision_id = await conn.fetchval("""
                    INSERT INTO executive_decisions
                        (decision_type, title, summary, recommendations,
                         kpis_snapshot, risk_flags, priority, status, briefing_date)
                    VALUES ('briefing', $1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, 'pending', CURRENT_DATE)
                    RETURNING id::text
                """,
                    title,
                    summary,
                    json.dumps(recs),
                    json.dumps(kpis),
                    json.dumps(flags),
                    priority,
                )

            return {
                "status": "logged",
                "decision_id": decision_id,
                "title": title,
                "priority": priority,
            }
        except Exception as e:
            return {"error": str(e)}

    return [get_executive_kpis, get_risk_summary, get_operations_pulse, log_executive_decision]
