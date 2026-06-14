"""
Procurement tools — async @tool functions with asyncpg pool injected via closure.
One write tool: create_draft_po inserts into purchase_orders with status='draft'.
All POs require human approval (Phase 15 HITL) before execution.
"""
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import asyncpg
from langchain_core.tools import tool


def create_procurement_tools(pool: asyncpg.Pool) -> list:
    """Return the 4 procurement tools with pool captured in closure."""

    @tool
    async def get_reorder_candidates(warehouse_id: str) -> str:
        """Find products below reorder_point that need purchase orders, with open-PO flag to avoid duplicates.

        Args:
            warehouse_id: UUID of the warehouse to check.

        Returns JSON list with sku, name, category, deficit, estimated_po_cost, and has_open_po flag.
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    p.sku, p.name, p.category, p.brand,
                    i.quantity, i.reorder_point, i.reorder_qty,
                    (i.reorder_point - i.quantity)               AS deficit,
                    ROUND(p.unit_cost * i.reorder_qty, 2)::FLOAT AS estimated_po_cost,
                    EXISTS (
                        SELECT 1 FROM purchase_orders po2
                        JOIN inventory  i2 ON i2.warehouse_id = po2.warehouse_id
                        JOIN products   p2 ON p2.id = i2.product_id
                        WHERE po2.warehouse_id = $1::uuid
                          AND p2.sku = p.sku
                          AND po2.status IN ('draft', 'pending', 'approved')
                    )                                             AS has_open_po
                FROM inventory i
                JOIN products p ON p.id = i.product_id
                WHERE i.warehouse_id = $1::uuid
                  AND i.quantity <= i.reorder_point
                ORDER BY deficit DESC
                """,
                warehouse_id,
            )
            if not rows:
                return json.dumps({"status": "ok", "message": "No reorder candidates — all products above reorder point."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_suppliers_for_category(category: str) -> str:
        """Find active suppliers that carry a given product category, ranked by reliability.

        Args:
            category: Product category (e.g. 'TVs', 'Mobiles & Tablets', 'Gaming Consoles',
                      'Networking Equipment', 'Accessories & Peripherals').

        Returns JSON list with supplier id, name, city, reliability_score, risk_score, avg_lead_days,
        payment_terms. Sorted best-first (highest reliability, lowest risk).
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    id::TEXT, name, city, contact_person, email, phone,
                    categories,
                    ROUND(reliability_score, 2)::FLOAT AS reliability_score,
                    ROUND(risk_score, 2)::FLOAT        AS risk_score,
                    avg_lead_days, payment_terms
                FROM suppliers
                WHERE is_active = TRUE
                  AND categories @> ARRAY[$1]
                ORDER BY reliability_score DESC, risk_score ASC
                """,
                category,
            )
            if not rows:
                return json.dumps({"status": "no_suppliers", "message": f"No active suppliers found for category '{category}'."})
            result = []
            for r in rows:
                d = dict(r)
                d["categories"] = list(d["categories"]) if d["categories"] else []
                result.append(d)
            return json.dumps(result)
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def get_open_purchase_orders(warehouse_id: str) -> str:
        """Get existing draft/pending/approved purchase orders for a warehouse to avoid duplicate ordering.

        Args:
            warehouse_id: UUID of the warehouse to check.

        Returns JSON list with po_number, supplier, status, total_amount, expected_date, ai_reasoning.
        """
        try:
            rows = await pool.fetch(
                """
                SELECT
                    po.po_number,
                    s.name                               AS supplier,
                    po.status,
                    ROUND(po.total_amount, 2)::FLOAT     AS total_amount,
                    po.expected_date::TEXT               AS expected_date,
                    po.ai_reasoning,
                    po.created_at::TEXT                  AS created_at
                FROM purchase_orders po
                JOIN suppliers s ON s.id = po.supplier_id
                WHERE po.warehouse_id = $1::uuid
                  AND po.status IN ('draft', 'pending', 'approved')
                ORDER BY po.created_at DESC
                """,
                warehouse_id,
            )
            if not rows:
                return json.dumps({"status": "clear", "message": "No open purchase orders for this warehouse."})
            return json.dumps([dict(r) for r in rows])
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def create_draft_po(
        warehouse_id: str,
        supplier_id: str,
        product_sku: str,
        quantity: int,
        ai_reasoning: str,
    ) -> str:
        """Create a draft purchase order for a product. Requires human approval before execution.

        Looks up product by SKU, calculates total_amount from unit_cost × quantity,
        sets expected_date from supplier avg_lead_days. PO starts with status='draft'.

        Args:
            warehouse_id: UUID of the destination warehouse.
            supplier_id: UUID of the selected supplier (from get_suppliers_for_category).
            product_sku: Product SKU string (from get_reorder_candidates).
            quantity: Number of units to order.
            ai_reasoning: Brief explanation of why this PO is recommended.

        Returns JSON with po_number, total_amount, expected_date, status.
        """
        try:
            product = await pool.fetchrow(
                "SELECT id, name, unit_cost FROM products WHERE sku = $1 AND is_active = TRUE",
                product_sku,
            )
            if not product:
                return json.dumps({"error": f"Product with SKU '{product_sku}' not found or inactive."})

            supplier = await pool.fetchrow(
                "SELECT avg_lead_days FROM suppliers WHERE id = $1::uuid AND is_active = TRUE",
                supplier_id,
            )
            if not supplier:
                return json.dumps({"error": f"Supplier '{supplier_id}' not found or inactive."})

            total_amount = float(product["unit_cost"]) * quantity
            expected_date = (datetime.now(timezone.utc) + timedelta(days=supplier["avg_lead_days"])).date()
            po_number = f"PO-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"

            row = await pool.fetchrow(
                """
                INSERT INTO purchase_orders
                    (po_number, supplier_id, warehouse_id, status, total_amount,
                     initiated_by, expected_date, ai_reasoning)
                VALUES ($1, $2::uuid, $3::uuid, 'draft', $4, 'agent', $5, $6)
                RETURNING po_number, total_amount::FLOAT, expected_date::TEXT, status
                """,
                po_number,
                supplier_id,
                warehouse_id,
                total_amount,
                expected_date,
                ai_reasoning,
            )
            return json.dumps({
                "created": True,
                "po_number": row["po_number"],
                "product": product["name"],
                "quantity": quantity,
                "total_amount": row["total_amount"],
                "expected_date": row["expected_date"],
                "status": row["status"],
                "note": "Draft PO created — awaiting human approval.",
            })
        except Exception as e:
            return json.dumps({"error": str(e)})

    return [get_reorder_candidates, get_suppliers_for_category, get_open_purchase_orders, create_draft_po]
