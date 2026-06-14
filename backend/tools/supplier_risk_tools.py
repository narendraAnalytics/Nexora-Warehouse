"""
Supplier Risk tools — async @tool functions with asyncpg pool injected via closure.
Read-only: no write tools here. Risk remediation (PO replacement) is handled by Procurement.
"""
import json
from datetime import date

import asyncpg
from langchain_core.tools import tool


def create_supplier_risk_tools(pool: asyncpg.Pool) -> list:
    """Return the 4 supplier risk tools with pool captured in closure."""

    @tool
    async def get_supplier_risk_scores() -> str:
        """Get all active suppliers ranked by risk score — highest risk first.

        Returns JSON list with supplier id, name, city, categories, risk_score,
        reliability_score, avg_lead_days, payment_terms.
        risk_score 1-10: higher = riskier. reliability_score 1-10: higher = more reliable.
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    id::TEXT,
                    name,
                    city,
                    categories,
                    ROUND(risk_score, 2)::FLOAT        AS risk_score,
                    ROUND(reliability_score, 2)::FLOAT AS reliability_score,
                    avg_lead_days,
                    payment_terms,
                    is_active
                FROM suppliers
                WHERE is_active = TRUE
                ORDER BY risk_score DESC, reliability_score ASC
                """
            )
            if not rows:
                return json.dumps({"status": "no_suppliers", "message": "No active suppliers found."})
            result = []
            for r in rows:
                d = dict(r)
                d["categories"] = list(d["categories"]) if d["categories"] else []
                result.append(d)
            return json.dumps(result)
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_supplier_po_performance(supplier_id: str) -> str:
        """Analyse purchase order performance history for a specific supplier.

        Calculates on-time delivery rate, average delay days, overdue PO count,
        and total pending order value to assess supplier reliability.

        Args:
            supplier_id: UUID of the supplier to analyse.

        Returns JSON with supplier name, total_pos, received_on_time, overdue_pos,
        on_time_rate_pct, avg_delay_days, pending_value_inr.
        """
        try:
            row = await pool.fetchrow(
                """
                SELECT
                    s.name                                                          AS supplier_name,
                    s.city,
                    ROUND(s.risk_score, 2)::FLOAT                                  AS risk_score,
                    ROUND(s.reliability_score, 2)::FLOAT                           AS reliability_score,
                    COUNT(po.id)                                                    AS total_pos,
                    COUNT(po.id) FILTER (
                        WHERE po.status = 'received'
                          AND po.received_at::DATE <= po.expected_date
                    )                                                               AS received_on_time,
                    COUNT(po.id) FILTER (
                        WHERE po.status NOT IN ('received', 'cancelled')
                          AND po.expected_date < CURRENT_DATE
                    )                                                               AS overdue_pos,
                    ROUND(
                        AVG(
                            EXTRACT(EPOCH FROM (po.received_at - po.expected_date::TIMESTAMPTZ)) / 86400
                        ) FILTER (WHERE po.received_at IS NOT NULL),
                        1
                    )::FLOAT                                                        AS avg_delay_days,
                    ROUND(
                        COALESCE(SUM(po.total_amount) FILTER (
                            WHERE po.status IN ('draft', 'pending', 'approved')
                        ), 0),
                        2
                    )::FLOAT                                                        AS pending_value_inr
                FROM suppliers s
                LEFT JOIN purchase_orders po ON po.supplier_id = s.id
                WHERE s.id = $1::uuid
                GROUP BY s.id, s.name, s.city, s.risk_score, s.reliability_score
                """,
                supplier_id,
            )
            if not row:
                return json.dumps({"error": f"Supplier '{supplier_id}' not found."})

            d = dict(row)
            total = d["total_pos"] or 0
            on_time = d["received_on_time"] or 0
            d["on_time_rate_pct"] = round((on_time / total * 100), 1) if total > 0 else None
            return json.dumps(d)
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_overdue_purchase_orders() -> str:
        """Find all purchase orders where expected_date has passed but delivery is not complete.

        Identifies suppliers causing active delivery delays across all warehouses.
        Returns overdue POs sorted by days_overdue descending (worst first).

        Returns JSON list with po_number, supplier, warehouse, status, expected_date,
        days_overdue, total_amount.
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    po.po_number,
                    s.name                                   AS supplier,
                    s.id::TEXT                               AS supplier_id,
                    ROUND(s.risk_score, 2)::FLOAT            AS supplier_risk_score,
                    w.city                                   AS warehouse,
                    po.status,
                    po.expected_date::TEXT                   AS expected_date,
                    (CURRENT_DATE - po.expected_date)        AS days_overdue,
                    ROUND(po.total_amount, 2)::FLOAT         AS total_amount,
                    po.ai_reasoning
                FROM purchase_orders po
                JOIN suppliers      s ON s.id = po.supplier_id
                JOIN warehouses     w ON w.id = po.warehouse_id
                WHERE po.status NOT IN ('received', 'cancelled')
                  AND po.expected_date < CURRENT_DATE
                ORDER BY days_overdue DESC
                """
            )
            if not rows:
                return json.dumps({"status": "clear", "message": "No overdue purchase orders found."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_alternative_suppliers(category: str, exclude_supplier_id: str) -> str:
        """Find alternative suppliers for a product category, excluding a risky or underperforming supplier.

        Use this when a supplier is high-risk, overdue, or unreliable — to recommend a switch.
        Results ranked by reliability_score DESC, risk_score ASC (best alternatives first).

        Args:
            category: Product category string (e.g. 'TVs', 'Mobiles & Tablets').
            exclude_supplier_id: UUID of the supplier to exclude from results.

        Returns JSON list of alternative suppliers with scores and lead times.
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    id::TEXT,
                    name,
                    city,
                    contact_person,
                    email,
                    phone,
                    categories,
                    ROUND(reliability_score, 2)::FLOAT AS reliability_score,
                    ROUND(risk_score, 2)::FLOAT        AS risk_score,
                    avg_lead_days,
                    payment_terms
                FROM suppliers
                WHERE is_active = TRUE
                  AND categories @> ARRAY[$1]
                  AND id != $2::uuid
                ORDER BY reliability_score DESC, risk_score ASC
                """,
                category,
                exclude_supplier_id,
            )
            if not rows:
                return json.dumps({
                    "status": "no_alternatives",
                    "message": f"No alternative suppliers found for category '{category}'.",
                })
            result = []
            for r in rows:
                d = dict(r)
                d["categories"] = list(d["categories"]) if d["categories"] else []
                result.append(d)
            return json.dumps(result)
        except Exception as e:
            return json.dumps({"error": str(e)})

    return [
        get_supplier_risk_scores,
        get_supplier_po_performance,
        get_overdue_purchase_orders,
        get_alternative_suppliers,
    ]
