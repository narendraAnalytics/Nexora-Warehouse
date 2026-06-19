"""
Phase 23 — Purchase Requisition tools.
Phase 25 — Supplier evaluation + PO generation functions.
Direct async DB functions (not @tool decorated) so the procurement API can call them directly.
"""
import json
from datetime import datetime, timedelta, timezone
from collections import Counter

import asyncpg


async def get_low_stock_items(warehouse_id: str, pool: asyncpg.Pool) -> list[dict]:
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                p.sku,
                p.name,
                p.category,
                p.brand,
                p.unit_cost,
                i.quantity       AS current_qty,
                i.reorder_point,
                i.reorder_qty,
                i.max_stock,
                i.avg_daily_sales,
                (i.reorder_point - i.quantity) AS deficit
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            WHERE i.warehouse_id = $1
              AND i.quantity <= i.reorder_point
              AND p.is_active = TRUE
            ORDER BY deficit DESC
        """, warehouse_id)
    return [dict(r) for r in rows]


async def _determine_approval_level(total_value: float, pool: asyncpg.Pool) -> dict:
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT approval_level, approver_role, description
            FROM approval_matrix
            WHERE min_value <= $1
              AND (max_value IS NULL OR $1 <= max_value)
            ORDER BY min_value DESC
            LIMIT 1
        """, total_value)
    if row:
        return dict(row)
    return {"approval_level": "L4", "approver_role": "CEO", "description": "Default — CEO approval"}


async def create_purchase_requisition(
    warehouse_id: str,
    reorder_alerts: list[dict],
    requested_by: str,
    inventory_analysis: dict,
    notes: str,
    pool: asyncpg.Pool,
) -> dict:
    async with pool.acquire() as conn:
        # Get warehouse city for PR number
        city = await conn.fetchval(
            "SELECT city FROM warehouses WHERE id = $1", warehouse_id
        )
        city_code = (city or "WH")[:3].upper()
        year = datetime.now(timezone.utc).year

        # Sequential PR number per warehouse
        seq = await conn.fetchval(
            "SELECT COUNT(*) + 1 FROM purchase_requisitions WHERE warehouse_id = $1",
            warehouse_id,
        )
        pr_number = f"PR-{year}-{city_code}-{seq:04d}"
        workflow_id = f"WF-{year}-{city_code}-{seq:05d}"

        # Build items from reorder_alerts
        items = []
        total_value = 0.0
        for alert in reorder_alerts:
            unit_cost           = float(alert.get("unit_cost", 0))
            unit_price          = float(alert.get("unit_price", 0))
            agent_suggested_qty = int(alert.get("reorder_qty", alert.get("agent_suggested_qty", 0)))
            manager_qty         = int(alert.get("manager_qty", agent_suggested_qty))
            line_total          = round(unit_cost * manager_qty, 2)
            total_value        += line_total
            items.append({
                "sku":                 alert.get("sku", ""),
                "name":                alert.get("name", ""),
                "category":            alert.get("category", ""),
                "brand":               alert.get("brand", ""),
                "current_qty":         int(alert.get("quantity", alert.get("current_qty", 0))),
                "reorder_point":       int(alert.get("reorder_point", 0)),
                "agent_suggested_qty": agent_suggested_qty,
                "manager_qty":         manager_qty,
                "unit_cost":           unit_cost,
                "unit_price":          unit_price,
                "line_total":          line_total,
                "manager_comment":     alert.get("manager_comment", ""),
            })

        # Determine approval level
        approval = await _determine_approval_level(total_value, pool)

        escalation_deadline_sql = "NOW() + INTERVAL '48 hours'"

        pr_id = await conn.fetchval("""
            INSERT INTO purchase_requisitions (
                pr_number, workflow_id, warehouse_id, status,
                total_estimated_value, requested_by, notes,
                approval_level, approver_role,
                inventory_analysis, items,
                escalation_deadline
            ) VALUES (
                $1, $2, $3, 'PENDING',
                $4, $5, $6,
                $7, $8,
                $9, $10,
                """ + escalation_deadline_sql + """
            )
            RETURNING id
        """,
            pr_number, workflow_id, warehouse_id,
            total_value, requested_by, notes,
            approval["approval_level"], approval["approver_role"],
            json.dumps(inventory_analysis), json.dumps(items),
        )

        # First approval history row
        await conn.execute("""
            INSERT INTO pr_approval_history (pr_id, action, acted_by, acted_by_role, notes)
            VALUES ($1, 'SUBMITTED', $2, 'BRANCH_MANAGER', 'PR auto-generated from inventory analysis')
        """, pr_id, requested_by)

        # Fetch the created row back
        row = await conn.fetchrow("""
            SELECT id, pr_number, workflow_id, warehouse_id, status,
                   total_estimated_value, approval_level, approver_role,
                   items, notes, escalation_deadline, created_at
            FROM purchase_requisitions WHERE id = $1
        """, pr_id)

    return dict(row)


async def get_pr_finance_analysis(pr_id: str, pool: asyncpg.Pool) -> dict:
    """
    Fetch PR value + trailing-3-month warehouse spend to compute budget impact.
    Called by the /finance-analysis endpoint — no LLM involved, deterministic.
    """
    async with pool.acquire() as conn:
        pr = await conn.fetchrow(
            "SELECT total_estimated_value, warehouse_id, approval_level FROM purchase_requisitions WHERE id = $1",
            pr_id,
        )
        if not pr:
            raise ValueError(f"PR {pr_id} not found")

        pr_value = float(pr["total_estimated_value"] or 0)
        warehouse_id = str(pr["warehouse_id"])

        # Trailing 3-month total spend for this warehouse from finance_records
        spend_row = await conn.fetchrow("""
            SELECT
                COALESCE(SUM(total_cost), 0)  AS total_spend_3m,
                COALESCE(SUM(net_profit), 0)  AS total_profit_3m,
                COUNT(*)                       AS record_count
            FROM finance_records
            WHERE warehouse_id = $1
              AND created_at >= NOW() - INTERVAL '3 months'
        """, warehouse_id)

        total_spend_3m = float(spend_row["total_spend_3m"] or 0)
        total_profit_3m = float(spend_row["total_profit_3m"] or 0)
        record_count = int(spend_row["record_count"] or 0)
        monthly_avg = round(total_spend_3m / 3, 2) if total_spend_3m > 0 else 0

        impact_pct = round((pr_value / monthly_avg * 100), 1) if monthly_avg > 0 else None

        if impact_pct is None:
            recommendation = "INSUFFICIENT_DATA — no spending history for this warehouse"
        elif impact_pct > 50:
            recommendation = "HIGH IMPACT — PR exceeds 50% of monthly avg spend. Requires careful budget review."
        elif impact_pct > 20:
            recommendation = "MODERATE IMPACT — PR is within normal procurement range."
        else:
            recommendation = "LOW IMPACT — routine procurement, well within budget."

        return {
            "pr_id":            pr_id,
            "pr_value":         pr_value,
            "approval_level":   pr["approval_level"],
            "monthly_avg_spend": monthly_avg,
            "total_spend_3m":   total_spend_3m,
            "total_profit_3m":  total_profit_3m,
            "finance_records":  record_count,
            "impact_pct":       impact_pct,
            "recommendation":   recommendation,
        }


async def update_pr_status(
    pr_id: str,
    new_status: str,
    acted_by: str,
    acted_by_role: str,
    notes: str,
    pool: asyncpg.Pool,
) -> dict:
    valid_transitions = {
        "FINANCE_APPROVED":  ["PENDING", "RESUBMITTED"],
        "APPROVED":          ["PENDING", "RESUBMITTED", "FINANCE_APPROVED"],
        "REJECTED":          ["PENDING", "RESUBMITTED", "FINANCE_APPROVED"],
        "CHANGES_REQUESTED": ["PENDING", "RESUBMITTED", "FINANCE_APPROVED"],
        "RESUBMITTED":       ["CHANGES_REQUESTED"],
        "PENDING":           ["RESUBMITTED"],
    }

    async with pool.acquire() as conn:
        current = await conn.fetchrow(
            "SELECT status FROM purchase_requisitions WHERE id = $1", pr_id
        )
        if not current:
            raise ValueError(f"PR {pr_id} not found")

        current_status = current["status"]
        allowed = valid_transitions.get(new_status, [])
        if current_status not in allowed:
            raise ValueError(
                f"Cannot transition from {current_status} to {new_status}"
            )

        update_fields = {
            "status":     new_status,
            "updated_at": "NOW()",
        }
        if new_status == "APPROVED":
            update_fields["approved_by"] = acted_by
            update_fields["approved_by_role"] = acted_by_role
        if new_status == "REJECTED":
            update_fields["rejection_reason"] = notes

        await conn.execute("""
            UPDATE purchase_requisitions
            SET status = $1,
                approved_by = CASE WHEN $1 = 'APPROVED' THEN $2 ELSE approved_by END,
                approved_by_role = CASE WHEN $1 = 'APPROVED' THEN $3 ELSE approved_by_role END,
                rejection_reason = CASE WHEN $1 = 'REJECTED' THEN $4 ELSE rejection_reason END,
                updated_at = NOW()
            WHERE id = $5
        """, new_status, acted_by, acted_by_role, notes, pr_id)

        await conn.execute("""
            INSERT INTO pr_approval_history (pr_id, action, acted_by, acted_by_role, notes)
            VALUES ($1, $2, $3, $4, $5)
        """, pr_id, new_status, acted_by, acted_by_role, notes)

        row = await conn.fetchrow(
            "SELECT id, pr_number, status, approved_by, approved_by_role FROM purchase_requisitions WHERE id = $1",
            pr_id,
        )
    return dict(row)


async def get_best_supplier_for_pr(pr_id: str, pool: asyncpg.Pool) -> dict:
    """
    Phase 25 — Supplier Risk Agent (deterministic).
    Reads PR items, finds best supplier per category (reliability DESC, risk ASC),
    returns the supplier that wins the most categories.
    """
    async with pool.acquire() as conn:
        pr = await conn.fetchrow(
            "SELECT items, warehouse_id FROM purchase_requisitions WHERE id = $1", pr_id
        )
        if not pr:
            raise ValueError(f"PR {pr_id} not found")

        items = pr["items"]
        if isinstance(items, str):
            items = json.loads(items)

        categories = list({item["category"] for item in items if item.get("category")})
        if not categories:
            raise ValueError("PR has no item categories to evaluate suppliers for")

        supplier_votes: Counter = Counter()
        supplier_data: dict = {}

        for cat in categories:
            row = await conn.fetchrow(
                """
                SELECT id::TEXT, name, city,
                       ROUND(reliability_score, 2)::FLOAT AS reliability_score,
                       ROUND(risk_score, 2)::FLOAT        AS risk_score,
                       avg_lead_days, payment_terms
                FROM suppliers
                WHERE is_active = TRUE
                  AND categories @> ARRAY[$1]
                ORDER BY reliability_score DESC, risk_score ASC
                LIMIT 1
                """,
                cat,
            )
            if row:
                sid = row["id"]
                supplier_votes[sid] += 1
                if sid not in supplier_data:
                    supplier_data[sid] = dict(row)

        if not supplier_votes:
            raise ValueError("No active suppliers found for the PR's product categories")

        best_id = supplier_votes.most_common(1)[0][0]
        best = supplier_data[best_id]
        best["categories_covered"] = supplier_votes[best_id]
        best["total_categories"] = len(categories)
        return best


async def create_po_from_pr(pr_id: str, supplier: dict, pool: asyncpg.Pool) -> dict:
    """
    Phase 25 — Procurement Agent (deterministic).
    Creates a draft PO for the PR's items sourced from the recommended supplier.
    One PO per PR (all items grouped under the best supplier).
    """
    async with pool.acquire() as conn:
        pr = await conn.fetchrow(
            "SELECT warehouse_id, items, workflow_id FROM purchase_requisitions WHERE id = $1", pr_id
        )
        if not pr:
            raise ValueError(f"PR {pr_id} not found")

        warehouse_id = str(pr["warehouse_id"])
        raw_items = pr["items"]
        if isinstance(raw_items, str):
            raw_items = json.loads(raw_items)

        # Build PO line items from PR items
        po_items = []
        total_amount = 0.0
        for item in raw_items:
            qty = int(item.get("manager_qty") or item.get("agent_suggested_qty") or 0)
            unit_cost = float(item.get("unit_cost") or 0)
            line_total = round(unit_cost * qty, 2)
            total_amount += line_total
            po_items.append({
                "sku":        item.get("sku", ""),
                "name":       item.get("name", ""),
                "category":   item.get("category", ""),
                "quantity":   qty,
                "unit_cost":  unit_cost,
                "line_total": line_total,
            })

        # Sequential PO number per warehouse
        year = datetime.now(timezone.utc).year
        city_code = await conn.fetchval(
            "SELECT city FROM warehouses WHERE id = $1::uuid", warehouse_id
        )
        city_code = (city_code or "WH")[:3].upper()
        seq = await conn.fetchval(
            "SELECT COUNT(*) + 1 FROM purchase_orders WHERE warehouse_id = $1::uuid", warehouse_id
        )
        po_number = f"PO-{year}-{city_code}-{seq:05d}"

        avg_lead = int(supplier.get("avg_lead_days") or 14)
        expected_date = (datetime.now(timezone.utc) + timedelta(days=avg_lead)).date()

        ai_reasoning = (
            f"Supplier Risk Agent selected {supplier['name']} ({supplier['city']}) "
            f"— reliability score {supplier['reliability_score']}/10, risk score {supplier['risk_score']}/10. "
            f"Best match for {supplier.get('categories_covered', 1)}/{supplier.get('total_categories', 1)} "
            f"item categories in this PR."
        )

        supplier_id = supplier["id"]
        row = await conn.fetchrow(
            """
            INSERT INTO purchase_orders
                (po_number, supplier_id, warehouse_id, status, total_amount,
                 initiated_by, expected_date, ai_reasoning, pr_id, items)
            VALUES ($1, $2::uuid, $3::uuid, 'draft', $4, 'supplier_risk_agent', $5, $6, $7::uuid, $8)
            RETURNING id::TEXT, po_number, supplier_id::TEXT, warehouse_id::TEXT,
                      status, total_amount::FLOAT, expected_date::TEXT, ai_reasoning,
                      pr_id::TEXT, items, created_at
            """,
            po_number, supplier_id, warehouse_id,
            round(total_amount, 2), expected_date,
            ai_reasoning, pr_id, json.dumps(po_items),
        )

    result = dict(row)
    result["supplier_name"]        = supplier["name"]
    result["supplier_city"]        = supplier["city"]
    result["supplier_reliability"] = supplier["reliability_score"]
    result["supplier_risk"]        = supplier["risk_score"]
    return result


async def log_agent_event(
    workflow_id: str,
    agent_name: str,
    event_type: str,
    payload: dict,
    pool: asyncpg.Pool,
    pr_id: str | None = None,
) -> None:
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO agent_events (workflow_id, pr_id, agent_name, event_type, payload)
            VALUES ($1, $2, $3, $4, $5)
        """, workflow_id, pr_id, agent_name, event_type, json.dumps(payload))
